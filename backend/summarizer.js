import { HttpError } from "./scraper.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

export async function summarize({ title, text }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError(500, "Server is missing GEMINI_API_KEY. See backend/.env.example.");

  const prompt =
    "Summarize the following web page for a busy reader.\n" +
    "Format:\n- One sentence overview\n- 3 to 5 bullet points with the key takeaways\n" +
    "Do not add headings or titles; start directly with the overview sentence, then the bullets.\n" +
    "Be factual and do not invent details.\n\n" +
    `Page title: ${title}\n\nPage content:\n${text}`;

  const callGemini = () =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
      }),
      signal: AbortSignal.timeout(45000),
    }).catch(() => {
      throw new HttpError(502, "Could not reach the AI service.");
    });

  // Gemini returns 503 during demand spikes; retry a few times with backoff.
  let res = await callGemini();
  for (let attempt = 1; res.status === 503 && attempt <= 3; attempt++) {
    await new Promise((r) => setTimeout(r, attempt * 1500));
    res = await callGemini();
  }

  if (!res.ok) {
    console.error("Gemini error", res.status, await res.text().catch(() => ""));
    if (res.status === 429) throw new HttpError(429, "AI rate limit reached. Please wait a moment and try again.");
    if (res.status === 503) throw new HttpError(503, "The AI service is busy right now. Please try again in a few seconds.");
    throw new HttpError(502, "The AI service returned an error.");
  }

  const data = await res.json();
  const summary = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("").trim();
  if (!summary) throw new HttpError(502, "The AI returned an empty response.");
  return summary;
}
