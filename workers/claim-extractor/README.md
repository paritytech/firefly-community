# claim-extractor (reference Cloudflare Worker)

A minimal, **bring-your-own-AI** worker that implements the claim-extraction
contract the Firefly web app expects. It calls OpenAI with **your** key (held as
a Cloudflare secret) and returns the exact `ExtractedClaim[]` shape the app
parses. The Firefly project ships **no shared/credentialed extraction backend** —
deploy your own with this, or any service that honors the same contract.

## Contract

```
POST /extract-claims
request:  { "text": "Gas prices have tripled since 2020" }
response: { "claims": [
  {
    "claim": "Gas prices have tripled since 2020",
    "checkable": true,
    "topic": "economy",
    "timeframe": "since 2020",
    "entities": [],
    "original_text": "Gas prices have tripled since 2020"
  }
] }
errors:   { "error": "..." }   (400 invalid input, 404 wrong path/method, 500 upstream/config)
```

The app posts to `<worker-url>/extract-claims`, so set
`NEXT_PUBLIC_CLAIM_EXTRACTOR_URL` to the worker's **base** URL (no `/extract-claims` suffix).

## Deploy

```bash
cd workers/claim-extractor
npm install

# 1. Provide your OpenAI key as a secret (never committed):
npx wrangler secret put OPENAI_API_KEY

# 2. Lock it to your app's origin(s) so others can't spend your quota.
#    Edit wrangler.toml -> [vars] ALLOWED_ORIGINS, e.g.
#    ALLOWED_ORIGINS = "https://your-app.example,http://localhost:3000"

# 3. Deploy
npx wrangler deploy
```

Then point the app at it:

```bash
# apps/web/.env.local
NEXT_PUBLIC_CLAIM_EXTRACTOR_URL=https://claim-extractor.<your-subdomain>.workers.dev
```

## Protecting your spend (important)

This worker calls OpenAI with **your** key, so anyone who can call it spends your
money. No single control is perfect for a public client app — layer them:

1. **`ALLOWED_ORIGINS` (enforced allow-list).** The worker returns `403` for any
   request whose `Origin` isn't listed. This blocks other websites' browsers —
   the common abuse path. Set it to your app's origin(s).
2. **CORS is not authentication.** A non-browser caller (curl/server) can forge
   the `Origin` header, so the allow-list alone won't stop a determined abuser.
3. **Add Cloudflare rate limiting** (dashboard → Security → Rate limiting) to cap
   cost from any one source.
4. **Stronger gating** (optional): put the worker behind Cloudflare Access /
   Turnstile, or require a per-user token your app obtains from the host identity.

The repo itself ships **no default worker URL**, so forks won't call yours — your
real URL lives only in your `apps/web/.env.local`.

## Why this is standalone (not in the pnpm workspace)

This worker is intentionally **not** a member of the pnpm workspace (`pnpm-workspace.yaml`
globs only `packages/*` and `apps/*`) and keeps its own `package-lock.json`:

- It is deployed independently to Cloudflare via `wrangler`, on its own lifecycle — not built
  or released with the web app.
- It depends on **no `@cocuyo/*` packages**; it only implements the wire contract above, so it
  has no reason to share the monorepo's dependency graph or build pipeline.
- It is a **reference** for the bring-your-own-AI model — forks copy/deploy it standalone, so
  self-containment (its own lockfile, Cloudflare-specific `tsconfig.json`) is a feature.

If a future worker needs to share code with `@cocuyo/*`, fold `workers/*` into the pnpm
workspace at that point and drop the npm lockfile.

## Notes

- **No secrets in this repo.** `OPENAI_API_KEY` lives only in your Cloudflare
  account (`wrangler secret put`). The worker code reads it from `env`.
  Secrets set via `wrangler secret put` are remote-only — they are **not**
  available to `wrangler dev`. For local dev, put the key in a `.dev.vars` file
  in this directory (`OPENAI_API_KEY=sk-...`); it is gitignored and must never
  be committed.
- Model: `gpt-4o-mini` via OpenAI Chat Completions with Structured Outputs
  (JSON schema), so responses always match the `ExtractedClaim` shape.
- Local dev: `npx wrangler dev` runs it at `http://localhost:8787` (reading
  `OPENAI_API_KEY` from `.dev.vars`, see above); set
  `NEXT_PUBLIC_CLAIM_EXTRACTOR_URL=http://localhost:8787` to use it from the app.
