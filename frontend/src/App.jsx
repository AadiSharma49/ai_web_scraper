import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Turns the "- bullet" lines returned by the AI into a lead sentence + list.
function Summary({ text }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const isBullet = (l) => /^[-*•]\s+/.test(l);
  const clean = (l) => l.replace(/^[-*•]\s+/, "").replace(/\*\*(.+?)\*\*/g, "$1");
  const lead = lines.filter((l) => !isBullet(l));
  const bullets = lines.filter(isBullet);

  return (
    <>
      {lead.map((l, i) => (
        <p key={i} className="lead">{clean(l)}</p>
      ))}
      {bullets.length > 0 && (
        <ul>
          {bullets.map((b, i) => (
            <li key={i}>{clean(b)}</li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!url.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`${API_URL}/api/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setResult(data);
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Cannot reach the backend. Is it running?" : err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>AI Web Scraper</h1>
      <p className="subtitle">Paste a link and get a short AI summary of the page.</p>

      <form onSubmit={handleSubmit} className="form">
        <input
          type="url"
          placeholder="https://example.com/article"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
          required
        />
        <button type="submit" disabled={loading || !url.trim()}>
          {loading ? "Loading..." : "Summarize"}
        </button>
      </form>

      {loading && (
        <div className="status" role="status">
          <span className="spinner" /> Loading... scraping the page and generating a summary
        </div>
      )}

      {error && <div className="error" role="alert">{error}</div>}

      {result && (
        <article className="card">
          <h2>{result.title}</h2>
          <a href={result.url} target="_blank" rel="noreferrer" className="source">{result.url}</a>
          <Summary text={result.summary} />
          {result.truncated && (
            <p className="note">Note: the page was long, so only the first part was summarized.</p>
          )}
        </article>
      )}
    </main>
  );
}
