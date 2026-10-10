import "dotenv/config";
import express from "express";
import cors from "cors";
import { scrapePage, HttpError } from "./scraper.js";
import { summarize } from "./summarizer.js";

const app = express();
const PORT = process.env.PORT || 5000;

const origins = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map((s) => s.trim());
app.use(cors({ origin: origins.includes("*") ? true : origins }));
app.use(express.json({ limit: "10kb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/summarize", async (req, res, next) => {
  try {
    const { url } = req.body ?? {};
    if (typeof url !== "string" || !url.trim()) throw new HttpError(400, "Please provide a URL.");

    const page = await scrapePage(url.trim());
    const summary = await summarize(page);

    res.json({
      title: page.title,
      url: url.trim(),
      summary,
      truncated: page.truncated,
      charsAnalyzed: page.text.length,
    });
  } catch (err) {
    next(err);
  }
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err instanceof HttpError ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 && !(err instanceof HttpError) ? "Something went wrong." : err.message });
});

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
