/**
 * Cloudflare Worker — AI claim extraction (Bring Your Own AI).
 *
 * Implements the contract the Firefly web app expects
 * (see apps/web/src/lib/ai/types.ts):
 *
 *   POST /extract-claims
 *   request:  { "text": string }
 *   response: { "claims": ExtractedClaim[] }   (200)
 *             { "error": string }              (400 / 403 / 404 / 500)
 *
 * The OpenAI key is a Worker secret — never hardcoded here:
 *   wrangler secret put OPENAI_API_KEY
 *
 * Point the app at this worker with NEXT_PUBLIC_CLAIM_EXTRACTOR_URL=<worker url>.
 *
 * ── Protecting your spend ────────────────────────────────────────────────────
 * This worker calls OpenAI with YOUR key, so anyone who can call it spends your
 * money. Defenses (none is perfect for a public client app — layer them):
 *   1. ALLOWED_ORIGINS — an enforced allow-list. Requests whose Origin isn't on
 *      it get 403. This blocks other sites' browsers (the common abuse vector).
 *      Set it to your app's origin(s). CORS is NOT authentication (a non-browser
 *      caller can forge Origin), so also:
 *   2. Add Cloudflare rate limiting (dashboard → Security → Rate limiting) to cap
 *      cost from any single source.
 *   3. For stronger gating, put the worker behind Cloudflare Access / Turnstile,
 *      or require a per-user token your app obtains from the host identity.
 */

interface Env {
  /** OpenAI API key (set via `wrangler secret put OPENAI_API_KEY`). */
  OPENAI_API_KEY: string;
  /**
   * Comma-separated allow-list of origins permitted to call this worker, e.g.
   * "https://app.example,https://staging.example". Strongly recommended.
   * If unset, ALL origins are allowed (open — fine for local testing only).
   */
  ALLOWED_ORIGINS?: string;
}

interface ExtractedClaim {
  claim: string;
  checkable: boolean;
  topic: string;
  timeframe: string | null;
  entities: string[];
  original_text: string;
}

const MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT = [
  'You extract objective, verifiable, factual claims from a piece of text.',
  'Rules:',
  '- Extract ONLY objective, fact-checkable claims (things that can be verified with evidence).',
  '- IGNORE opinions, rhetoric, insults, vague statements, and predictions about the future.',
  '- Each claim must be concise and standalone (understandable without the surrounding text).',
  '- Preserve the original source phrase in `original_text`.',
  '- Set `checkable` to true only if the claim can realistically be fact-checked with evidence.',
  '- `topic` is a short category (e.g. "economy", "environment", "elections", "public-health").',
  '- `timeframe` is any time reference present (e.g. "since 2020"), otherwise null.',
  '- `entities` lists named people, organizations, or places mentioned (may be empty).',
  '- If there are no verifiable claims, return an empty array.',
].join('\n');

// JSON Schema for OpenAI Structured Outputs — guarantees the ExtractedClaim shape.
const CLAIMS_JSON_SCHEMA = {
  name: 'claim_extraction',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      claims: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            claim: { type: 'string' },
            checkable: { type: 'boolean' },
            topic: { type: 'string' },
            timeframe: { type: ['string', 'null'] },
            entities: { type: 'array', items: { type: 'string' } },
            original_text: { type: 'string' },
          },
          required: ['claim', 'checkable', 'topic', 'timeframe', 'entities', 'original_text'],
        },
      },
    },
    required: ['claims'],
  },
} as const;

/**
 * Resolve CORS headers and whether the request's Origin is allowed.
 * If ALLOWED_ORIGINS is set, only those origins are permitted (others -> 403).
 */
function resolveCors(
  request: Request,
  env: Env
): { headers: Record<string, string>; allowed: boolean } {
  const configured = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const origin = request.headers.get('Origin');

  let allowOrigin = '*';
  let allowed = true;
  if (configured.length > 0) {
    allowed = origin !== null && configured.includes(origin);
    allowOrigin = allowed && origin !== null ? origin : configured[0];
  }

  return {
    allowed,
    headers: {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  };
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { headers: cors, allowed } = resolveCors(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const { pathname } = new URL(request.url);
    if (request.method !== 'POST' || pathname !== '/extract-claims') {
      return json({ error: 'Not found. Use POST /extract-claims.' }, 404, cors);
    }

    // Enforce the origin allow-list (when configured) before doing any work.
    if (!allowed) {
      return json({ error: 'Origin not allowed.' }, 403, cors);
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: 'Server not configured: OPENAI_API_KEY is not set.' }, 500, cors);
    }

    let text: unknown;
    try {
      const body = (await request.json()) as { text?: unknown };
      text = body.text;
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400, cors);
    }
    if (typeof text !== 'string' || text.trim().length === 0) {
      return json({ error: 'Missing or empty "text".' }, 400, cors);
    }

    let openaiResponse: Response;
    try {
      openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: text.trim() },
          ],
          response_format: { type: 'json_schema', json_schema: CLAIMS_JSON_SCHEMA },
        }),
      });
    } catch {
      return json({ error: 'Upstream AI request failed.' }, 500, cors);
    }

    if (!openaiResponse.ok) {
      // Don't leak upstream error details/keys to the client; log the status.
      console.error(
        'OpenAI error',
        openaiResponse.status,
        await openaiResponse.text().catch(() => '')
      );
      return json({ error: 'Claim extraction failed.' }, 500, cors);
    }

    let content: string | undefined;
    try {
      const data = (await openaiResponse.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      content = data.choices?.[0]?.message?.content;
    } catch {
      return json({ error: 'Invalid AI response.' }, 500, cors);
    }
    if (content === undefined) {
      return json({ error: 'Empty AI response.' }, 500, cors);
    }

    let claims: ExtractedClaim[];
    try {
      const parsed = JSON.parse(content) as { claims?: unknown };
      if (!Array.isArray(parsed.claims)) throw new Error('claims missing');
      claims = parsed.claims as ExtractedClaim[];
    } catch {
      return json({ error: 'Could not parse extracted claims.' }, 500, cors);
    }

    return json({ claims }, 200, cors);
  },
};
