# The Firefly Network

> Lights in the Dark — A surveillance-resistant network for collective intelligence.

## Project Overview

The Firefly Network is a decentralized, surveillance-resistant platform where verified humans share, corroborate, and build collective understanding of what is happening in their communities — without exposing their identities to governments, corporations, or each other.

It is **not** a social media platform. It is a collective intelligence network built on Polkadot infrastructure where every participant is both sensor and analyst, and where the value of information is determined by the cryptographic weight of human corroboration.

### Core Concept Document

The full product concept is defined in `docs/firefly-network-concept.md`. All development decisions should remain consistent with the vision, terminology, and architecture described in that document. Key concepts include:

- **Fireflies**: Verified human participants (via DIM proof-of-personhood). Anonymous but provably human.
- **Signals**: The fundamental unit of information — an observation, evidence, or data point contributed by a firefly. Not a "post."
- **Story Chains**: Emergent structures formed when multiple signals connect around a topic, event, or question.
- **Corroboration**: The core interaction. A structured, reputation-staked act of verification — not a "like."
- **Verification Trails**: Transparent, cryptographic records of all signals, corroborations, and challenges in a chain.
- **Topic-Weighted Reputation**: Multi-dimensional reputation scores across domains, earned through corroborated contributions.
- **Information Bounties**: Community-funded requests for specific information, paid directly to contributing fireflies.

### Core Action: "Illuminate"

The primary user action is **illuminate** — not "post," "share," or "submit." All UI copy, documentation, and code comments should use this language. The metaphor matters. We are building signal fires, not a feed.

### Terminology: the signal / post boundary

The codebase uses both "signal" and "post". This is **intentional**, with a strict boundary:

- **Signal** — the _conceptual_ unit and **all user-facing language**. The core action is _illuminate_. Use "signal" in UI copy, i18n message keys, docs, and user-facing component names.
- **Post** — the _data-layer entity_: `@cocuyo/types` (`post.ts`, `PostService`), Bulletin records, validators, storage. Use "post" in types, services, storage, and ABIs.

Rule: never introduce a _new_ user-facing "post" string, and never name a data/service type "signal". (Some legacy names like `signalService` remain as aliases for backward compatibility — the services barrel `index.ts` was removed in Phase 4, so instance selection now lives in `apps/web/src/lib/services/service-instances.ts`.)

---

## Architecture

### Monorepo Structure (pnpm)

```
cocuyo/
├── CLAUDE.md                    # This file
├── pnpm-workspace.yaml          # Workspaces: packages/*, apps/* (workers/* is standalone)
├── package.json                 # Root scripts + pnpm security overrides
├── tsconfig.base.json           # Shared strict TypeScript config (extended by packages)
├── eslint.config.js             # Shared flat ESLint config
├── .prettierrc
├── turbo.json                   # Turborepo pipeline (tasks depend on ^build)
├── vitest.workspace.ts          # Vitest workspace (types, bulletin, identity, individuality, ui, web)
├── docs/
│   ├── firefly-network-concept.md
│   ├── ARCHITECTURE.md
│   ├── CONTRIBUTING.md
│   ├── CLEANUP_AND_STANDARDS_PLAN.md
│   └── ADR/                     # Architecture Decision Records (000-template, 001..006)
├── packages/
│   ├── ui/                      # Shared UI component library (Button, Navbar, Footer, cards,
│   │   │                        #   badges, Toast, ErrorBoundary, …) + design tokens + hooks
│   │   └── src/{components,styles,hooks}/
│   ├── types/                   # Shared TS types + Zod validators (barrel index.ts is intentional)
│   │   └── src/                 #   brands.ts, services.ts, post.ts, claim.ts, chain.ts,
│   │                           #   corroboration.ts, governance.ts, … (+ co-located *.test.ts)
│   ├── identity/                # DIM identity client (proof-of-personhood credential)
│   ├── individuality/           # Personhood + dotns directory (sub-exports: ./dotns/*)
│   ├── contracts/               # Solidity (Hardhat) contracts + tests + TypeChain types
│   │   └── contracts/           #   BountyEscrow, FireflyReputation, CrowdstackingPool,
│   │                           #   AllianceGovernance, OutletRegistry, ContributorRegistry
│   ├── network-config/          # Single network registry (addresses, RPC URLs, chain ids)
│   └── bulletin/                # Bulletin Chain client (content storage, CID, indexes)
├── apps/
│   └── web/                     # Main Next.js app (App Router, static export)
│       ├── i18n/                # next-intl: routing.ts, request.ts, messages/{en,es}.json
│       ├── middleware.ts        # next-intl locale middleware
│       ├── e2e/                 # Playwright: smoke, accessibility, journeys/ + fixtures/
│       └── src/
│           ├── app/
│           │   ├── [locale]/    # Locale-scoped routes: about, explore, chain, claim, post,
│           │   │               #   posts, signal, campaign, bounties, profile, dashboard, join,
│           │   │               #   verify, workbench, newsroom, alliance/{governance,treasury}
│           │   ├── api/extract-claims/   # Route → claim-extractor worker
│           │   ├── layout.tsx · page.tsx # Root layout + redirect to /[defaultLocale]
│           │   └── globals.css
│           ├── components/      # App-specific components (sheets, modals, drawers, FAB, …)
│           ├── hooks/           # User-initiated interaction hooks (wallet, contracts, DOM)
│           └── lib/
│               ├── chain/       # On-chain access: client, config, asset-hub-provider, revive,
│               │   ├── abi/     #   revive ABIs (alliance-governance, crowdstacking, outlet, erc20)
│               │   ├── contracts/   # revive contract wrappers
│               │   └── evm/     #   direct EVM (ethers) contracts: config + abis/ (BountyEscrow,
│               │               #   FireflyReputation) — used by the EVM hooks
│               ├── services/    # Interface-first services (mock + on-chain impls); instance
│               │               #   selection in service-instances.ts (no barrel) + hooks/
│               ├── app-state/   # Decomposed AppStateProvider domain hooks (use-posts-state,
│               │               #   use-stories-state, use-campaigns-state, use-claims-state,
│               │               #   use-corroborations-state, use-verdicts-state, use-current-user)
│               ├── ai/ · context/ · host/ · hooks/ · utils/ · logging.ts · errors.ts
│               └── …
└── workers/
    └── claim-extractor/         # Standalone Cloudflare Worker (BYO-AI claim extraction).
                                 #   Not in the pnpm workspace; deployed independently via wrangler.
```

### Technology Stack

| Layer           | Technology                                        | Rationale                                  |
| --------------- | ------------------------------------------------- | ------------------------------------------ |
| Framework       | Next.js (App Router, static export)               | SSR/RSC DX; static export for the host     |
| Language        | TypeScript (strict mode)                          | Type safety is non-negotiable              |
| Styling         | Tailwind CSS + CSS custom properties              | Utility-first with design token control    |
| Font            | Unbounded (Polkadot ecosystem font)               | Polkadot brand alignment                   |
| Body Font       | Inter                                             | Clean, readable, pairs well with Unbounded |
| i18n            | next-intl (`en`, `es`)                            | Locale-scoped `[locale]` routes            |
| Monorepo        | pnpm workspaces + Turborepo                       | Fast, strict, deterministic                |
| Package builds  | tsup (CJS+ESM+dts)                                | Dual-format published `@cocuyo/*` packages |
| Smart contracts | Solidity + Hardhat + TypeChain                    | UUPS proxies; ethers-v6 typed bindings     |
| Contract sec.   | solhint + Slither (`--fail-on high`) + coverage   | Security is the foundation                 |
| Chain access    | ethers (EVM JSON-RPC) + revive/PolkaVM + Bulletin | Asset Hub contracts + content storage      |
| Worker          | Cloudflare Worker (`wrangler`) — BYO-AI           | Standalone claim extraction, own lifecycle |
| Testing         | Vitest + React Testing Library + Playwright       | Unit, component, and E2E                   |
| Linting         | ESLint (strict) + Prettier                        | Strict TS rules; warnings tracked          |
| CI              | GitHub Actions                                    | Standard, Polkadot ecosystem norm          |
| Web3            | `@polkadot/*`, Asset Hub, Bulletin Chain          | Native Polkadot integration                |

---

## Design System

### Philosophy

The Firefly Network's visual identity draws from the Polkadot ecosystem's black-and-white aesthetic with a single warm accent — firefly gold — used sparingly to represent moments of illumination.

The design is **minimal, high-contrast, and intentionally anti-social-media.** No infinite scrolls. No notification badges. No engagement metrics. The interface communicates purpose and substance.

### Color Tokens

```css
/* Primary palette — black and white, Polkadot style */
--color-bg-primary: #000000; /* Deep black background */
--color-bg-secondary: #0a0a0a; /* Slightly lifted black */
--color-bg-tertiary: #141414; /* Card/surface background */
--color-bg-elevated: #1a1a1a; /* Elevated surfaces */

--color-text-primary: #ffffff; /* Primary text */
--color-text-secondary: #a0a0a0; /* Secondary/muted text */
--color-text-tertiary: #666666; /* Tertiary/disabled text */

--color-border-default: #222222; /* Default borders */
--color-border-subtle: #1a1a1a; /* Subtle borders */
--color-border-emphasis: #333333; /* Emphasized borders */

/* Accent — firefly gold, used sparingly for illumination moments */
--color-accent: #e8b931; /* Firefly gold */
--color-accent-dim: #c49a1c; /* Dimmed accent */
--color-accent-glow: rgba(232, 185, 49, 0.15); /* Glow effect */

/* Semantic */
--color-corroborated: #4ade80; /* Corroboration indicators (green) */
--color-challenged: #f87171; /* Challenge indicators (red) */
--color-pending: #a0a0a0; /* Pending/unverified (gray) */

/* Polkadot ecosystem nod */
--color-polkadot-pink: #e6007a; /* Used ONLY for Polkadot branding/attribution */
```

### Typography

```css
/* Headings — Unbounded (Polkadot ecosystem font) */
--font-display: 'Unbounded', sans-serif;

/* Body — Inter */
--font-body: 'Inter', sans-serif;

/* Monospace — for verification trails, hashes, technical data */
--font-mono: 'JetBrains Mono', monospace;

/* Scale */
--text-xs: 0.75rem; /* 12px — metadata, timestamps */
--text-sm: 0.875rem; /* 14px — secondary text */
--text-base: 1rem; /* 16px — body text */
--text-lg: 1.125rem; /* 18px — emphasis */
--text-xl: 1.25rem; /* 20px — section headers */
--text-2xl: 1.5rem; /* 24px — page headers */
--text-3xl: 2rem; /* 32px — hero text */
--text-4xl: 2.5rem; /* 40px — landing hero */
```

### Component Guidelines

- **Navbar**: Fixed top. Black background. Firefly Network wordmark in Unbounded. Minimal nav items. No user avatar (there are no profiles). Firefly gold accent on active state only.
- **Footer**: Black background. Links to About, Documentation, GitHub, Polkadot ecosystem. "Built on Polkadot" attribution with Polkadot pink logo. Copyright.
- **Buttons**: High contrast. Primary = white text on black border, hover inverts. Accent buttons = firefly gold, used only for the "Illuminate" action.
- **Cards**: Dark surfaces (#141414) with subtle borders. No shadows. Clean typography hierarchy.
- **No emojis in UI**. No reaction buttons. No share buttons. No follower counts.

### Accessibility

- WCAG 2.1 AA minimum, target AAA for text contrast
- All interactive elements must be keyboard navigable
- Screen reader support with proper ARIA labels
- Reduced motion support via `prefers-reduced-motion`
- Minimum touch target 44x44px

---

## Coding Standards

### TypeScript

- **Strict mode always** (`"strict": true` in tsconfig)
- **No `any`** — use `unknown` and narrow with type guards
- **No `as` type assertions** unless absolutely necessary and documented with a comment explaining why
- **No non-null assertions** (`!`) — handle null/undefined explicitly
- **Prefer interfaces** for object shapes, types for unions/intersections
- **All exports must be typed** — no implicit return types on exported functions
- **Use branded types** for domain identifiers (SignalId, ChainId, FireflyCredential)

```typescript
// Branded types for domain safety
type SignalId = string & { readonly __brand: 'SignalId' };
type ChainId = string & { readonly __brand: 'ChainId' };

// Explicit return types on exports
export function getSignal(id: SignalId): Promise<Signal | null> { ... }

// Never
export function getSignal(id: any): any { ... }
```

### React / Next.js

- **Server Components by default** — use `'use client'` only when necessary
- **No barrel exports** from large directories — import specific files
- **Co-locate** tests, styles, and types with their component
- **Component file structure**:

```
Button/
├── Button.tsx           # Component implementation
├── Button.test.tsx      # Tests
├── Button.types.ts      # Types (if complex)
└── index.ts             # Re-export
```

### Error Handling

- **Never swallow errors** — always log and surface meaningfully
- **Use Result types** for operations that can fail (not try/catch everywhere)
- **Boundary errors** at the edge — ErrorBoundary components in React, middleware in API routes
- **Structured logging** — never `console.log` in production code

### Git Conventions

- **Conventional commits**: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`
- **Branch naming**: `feat/signal-creation`, `fix/chain-display-overflow`
- **PR template** with checklist: tests, lint, accessibility, documentation
- **No direct commits to main** — all changes through PRs

---

## Testing Standards

### Coverage Requirements

- **Minimum 80% line coverage** for all packages
- **100% coverage** for cryptographic/security-critical code
- **Every component** must have at least: renders without crashing, renders expected content, handles empty/error states

### Test Structure

```typescript
describe('SignalCard', () => {
  describe('rendering', () => {
    it('renders signal content', () => { ... });
    it('renders corroboration count', () => { ... });
    it('renders verification trail indicator', () => { ... });
  });

  describe('accessibility', () => {
    it('has proper ARIA labels', () => { ... });
    it('is keyboard navigable', () => { ... });
  });

  describe('edge cases', () => {
    it('handles missing optional fields', () => { ... });
    it('truncates very long content', () => { ... });
  });
});
```

### Testing Commands

```bash
pnpm test              # Run all tests
pnpm test:unit         # Unit tests (Vitest)
pnpm test:e2e          # E2E tests (Playwright)
pnpm test:coverage     # Coverage report
```

---

## Security Standards

This is a surveillance-resistant platform. Security is not a feature — it is the foundation.

### Principles

1. **Zero trust architecture** — never trust, always verify
2. **Minimal data collection** — collect nothing you don't need. If you don't have it, it can't be subpoenaed.
3. **No PII in logs** — ever. Not in dev. Not in staging. Not anywhere.
4. **Defense in depth** — multiple layers, no single point of failure
5. **Fail secure** — if something breaks, it should break toward privacy, not exposure

### Web Security Baseline

- **CSP headers** — strict Content Security Policy on all pages
- **No inline scripts** — all JS from trusted sources
- **HTTPS only** — HSTS with long max-age
- **No third-party tracking** — no Google Analytics, no Facebook Pixel, no ad networks, nothing
- **Subresource Integrity** — SRI hashes on all external resources
- **X-Frame-Options: DENY**
- **Referrer-Policy: no-referrer**

### Dependency Security

- **Audit on every install** — `pnpm audit` must pass with zero critical/high vulnerabilities
- **Lockfile committed** — `pnpm-lock.yaml` always in source control
- **Minimal dependencies** — every dependency must justify its inclusion. Prefer standard library.
- **No dependency should require network access at build time** beyond package registry

### Future: Cryptographic Standards (when Web3 integration begins)

- All cryptographic operations use audited libraries (e.g., `@polkadot/util-crypto`)
- No custom cryptographic implementations
- Key material never touches disk unencrypted
- All signatures verified server-side, never trusted from client alone

---

## Documentation Standards

### Code Documentation

- **All exported functions/types** must have JSDoc comments
- **All components** must have a brief description of purpose and usage
- **Complex logic** must have inline comments explaining _why_, not _what_
- **ADRs** (Architecture Decision Records) for significant decisions in `docs/ADR/`

### Project Documentation

- `README.md` — Project overview, quick start, architecture summary
- `docs/ARCHITECTURE.md` — Detailed architecture documentation
- `docs/CONTRIBUTING.md` — How to contribute, coding standards, PR process
- `apps/web/src/app/about/page.tsx` — Public-facing About page explaining the project's mission, the firefly metaphor, and the Polkadot foundation

### About Page Content

The About page should cover:

- The Firefly metaphor and its origin (Efecto Cocuyo / Caribbean cocuyos)
- What the network is (and explicitly what it is NOT — not social media)
- How story chains and corroboration work (plain language)
- The surveillance resistance architecture (plain language)
- Built on Polkadot — with proper attribution and links
- Open source commitment

---

## Web3 Values

Every technical and product decision should be evaluated against these principles:

1. **Decentralization** — No single point of control or failure. If the founding team disappeared tomorrow, the network should continue.
2. **User sovereignty** — Users own their identity, their reputation, and their data. No platform lock-in.
3. **Privacy by default** — The system is designed so that privacy is the default state, not an opt-in feature.
4. **Censorship resistance** — No entity, including the development team, can remove content or silence a participant.
5. **Transparency** — All code is open source. All governance is public. All verification trails are auditable.
6. **Interoperability** — Built on Polkadot for cross-chain compatibility. Not a walled garden.
7. **Minimal extraction** — The network exists to serve its participants, not to extract value from them.

---

## Development Commands

```bash
# Setup
pnpm install                    # Install all dependencies
pnpm build                      # Build all packages and apps
pnpm dev                        # Start development server

# Quality
pnpm lint                       # Lint all packages (must pass with zero warnings)
pnpm lint:fix                   # Auto-fix lint issues
pnpm format                     # Format with Prettier
pnpm format:check               # Check formatting
pnpm typecheck                  # TypeScript type checking

# Testing
pnpm test                       # Run all tests
pnpm test:unit                  # Unit tests only
pnpm test:e2e                   # E2E tests only
pnpm test:coverage              # Generate coverage report

# All checks (run before committing)
pnpm check                      # lint + typecheck + test + format:check
```
