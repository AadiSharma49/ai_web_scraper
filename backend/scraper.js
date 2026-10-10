import * as cheerio from "cheerio";
import dns from "node:dns/promises";
import net from "node:net";

const MAX_HTML_BYTES = 3 * 1024 * 1024; // 3 MB
const MAX_TEXT_CHARS = 30000; // keeps the prompt small and fast
const FETCH_TIMEOUT_MS = 12000;

function isPrivateIp(ip) {
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    return l === "::1" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("::ffff:127.");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

// Basic SSRF guard: only http(s), and never resolve to a private/internal address.
async function assertPublicUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HttpError(400, "That doesn't look like a valid URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new HttpError(400, "Only http:// and https:// URLs are supported.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (addrs.length === 0) throw new HttpError(400, "Could not resolve that domain.");
  if (addrs.some((a) => isPrivateIp(a.address))) {
    throw new HttpError(400, "Private or internal addresses are not allowed.");
  }
  return url;
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function scrapePage(rawUrl) {
  const url = await assertPublicUrl(rawUrl);

  let res;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AIWebScraper/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (err) {
    const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
    throw new HttpError(502, timedOut ? "The page took too long to respond." : "Could not reach that URL.");
  }

  if (!res.ok) throw new HttpError(502, `The page returned an error (HTTP ${res.status}).`);
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/html") && !type.includes("application/xhtml")) {
    throw new HttpError(415, "That URL is not an HTML page.");
  }

  const html = (await res.text()).slice(0, MAX_HTML_BYTES);
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || $("h1").first().text().trim() || url.hostname;

  // Remove everything that isn't readable content.
  $("script, style, noscript, nav, header, footer, aside, form, iframe, svg, [role=navigation]").remove();

  // Prefer the main content container when the page has one.
  const root = ["article", "main", "[role=main]", "body"].map((s) => $(s).first()).find((el) => el.length);

  const text = root
    .text()
    .replace(/\s+/g, " ")
    .trim();

  if (text.length < 80) {
    throw new HttpError(422, "Couldn't find enough text on that page (it may need JavaScript to render).");
  }

  return {
    title,
    text: text.slice(0, MAX_TEXT_CHARS),
    truncated: text.length > MAX_TEXT_CHARS,
  };
}
