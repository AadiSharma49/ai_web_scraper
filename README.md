# AI Web Scraper

Paste a URL, click **Summarize**, and get a short AI-generated summary of the page.

- **Frontend:** React + Vite (`/frontend`)
- **Backend:** Node.js + Express (`/backend`)
- **Scraping:** `fetch` + [cheerio](https://cheerio.js.org/) (extracts the main readable text)
- **AI:** Google Gemini API (free tier) – `gemini-3.8-flash`

## How it works

```
Browser ──POST /api/summarize {url}──▶ Express ──▶ fetch page HTML ──▶ cheerio extracts text
                                                                  │
Browser ◀──── { title, summary } ◀──── Gemini API ◀── text ───────┘
```

## Prerequisites

- Node.js 18+
- A free Gemini API key: https://aistudio.google.com/apikey

## Run locally

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # Windows PowerShell: copy .env.example .env
```

Open **`backend/.env`** and paste your key:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

Start it:

```bash
npm start                 # runs on http://localhost:5000
```

### 2. Frontend (in a second terminal)

```bash
cd frontend
npm install
cp .env.example .env      # optional locally; defaults to http://localhost:5000
npm run dev               # runs on http://localhost:5173
```

Open http://localhost:5173, paste a URL and press **Summarize**.

## Environment variables

| File | Variable | Purpose |
| --- | --- | --- |
| `backend/.env` | `GEMINI_API_KEY` | **Required.** Your Gemini API key |
| `backend/.env` | `GEMINI_MODEL` | Optional, default `gemini-3.8-flash` |
| `backend/.env` | `PORT` | Optional, default `5000` |
| `backend/.env` | `CORS_ORIGIN` | Allowed frontend origin(s), comma-separated. Set to your deployed frontend URL in production |
| `frontend/.env` | `VITE_API_URL` | Backend base URL. Set to your deployed backend URL in production |

`.env` files are git-ignored – never commit your key.

## API

`POST /api/summarize`

```json
// request
{ "url": "https://example.com/article" }

// response 200
{ "title": "...", "url": "...", "summary": "...", "truncated": false }

// error (4xx/5xx)
{ "error": "Human readable message" }
```

## Deploying

- **Backend** (e.g. Render): root dir `backend`, build `npm install`, start `npm start`. Add `GEMINI_API_KEY` and `CORS_ORIGIN=<frontend url>` as environment variables.
- **Frontend** (e.g. Vercel): root dir `frontend`, build `npm run build`, output `dist`. Add `VITE_API_URL=<backend url>`.

## Limitations

- Only static HTML is scraped (no JavaScript rendering, no bot-protection bypass).
- Very long pages are truncated to ~30,000 characters before summarizing.
- Private/internal addresses (localhost, 10.x, 192.168.x …) are blocked to prevent SSRF.
