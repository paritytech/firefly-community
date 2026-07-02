# AI Claim Extraction

Serverless AI-powered claim extraction using OpenAI.

## Setup

### 1. Set the API Key

Add your OpenAI API key to `.env.local`:

```bash
OPENAI_API_KEY=sk-...
```

**Important:** Never commit this file or expose the key in browser code.

### 2. For Production (Vercel)

Add the environment variable in your Vercel project settings:

- Settings → Environment Variables → Add `OPENAI_API_KEY`

## Usage

### Frontend Helper

```typescript
import { extractClaims, extractBestClaim } from '@/lib/ai';

// Extract all claims
const claims = await extractClaims('Gas prices have tripled since 2020');
// [{ claim: "Gas prices have tripled since 2020", checkable: true, topic: "economy", ... }]

// Extract best single claim (for one-click extraction)
const bestClaim = await extractBestClaim(postText);
// "Gas prices have tripled since 2020"
```

### Direct API Call

```bash
curl -X POST http://localhost:3000/api/extract-claims \
  -H "Content-Type: application/json" \
  -d '{"text": "Gas prices have tripled since 2020"}'
```

Response:

```json
{
  "claims": [
    {
      "claim": "Gas prices have tripled since 2020",
      "checkable": true,
      "topic": "economy",
      "timeframe": "since 2020",
      "entities": [],
      "original_text": "Gas prices have tripled since 2020"
    }
  ]
}
```

## Security

### Why the API key must not be in browser code

1. **Exposure:** Browser code is visible to anyone. API keys in client bundles can be extracted.
2. **Abuse:** Exposed keys can be used to make unlimited API calls at your expense.
3. **Revocation:** If compromised, you must rotate the key and redeploy.

### How this implementation keeps it secure

- The API key is only read in `route.ts` (server-side)
- The frontend calls `/api/extract-claims` without any credentials
- Next.js API routes run server-side, never in the browser
- Errors are sanitized - internal details are logged, not returned

## Architecture

```
Browser                    Server (Next.js API Route)           OpenAI
   │                                  │                            │
   │  POST /api/extract-claims        │                            │
   │  { text: "..." }                 │                            │
   │ ─────────────────────────────────>                            │
   │                                  │                            │
   │                                  │  Chat Completions API      │
   │                                  │  (with OPENAI_API_KEY)     │
   │                                  │ ───────────────────────────>
   │                                  │                            │
   │                                  │  Structured JSON response  │
   │                                  │ <───────────────────────────
   │                                  │                            │
   │  { claims: [...] }               │                            │
   │ <─────────────────────────────────                            │
   │                                  │                            │
```

## Model

Uses `gpt-4o-mini` for fast, cost-effective extraction (~$0.00015 per 1K input tokens).

## Extraction Behavior

- Extracts only objective, factual, verifiable claims
- Ignores opinions, insults, rhetoric, vague statements, predictions
- Returns empty array if no claims found
- Each claim is concise and standalone
- Preserves original source phrase

## Error Handling

| Status | Meaning                                     |
| ------ | ------------------------------------------- |
| 200    | Success                                     |
| 400    | Missing or empty text                       |
| 500    | API key not configured or extraction failed |

Errors never leak internal details or secrets.
