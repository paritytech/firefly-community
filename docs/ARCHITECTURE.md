# Architecture Documentation

This document describes the technical architecture of the Firefly Network codebase.

## Overview

The Firefly Network is built as a pnpm monorepo with Turborepo for task orchestration. The architecture follows a clean separation between the web application and shared packages.

```
cocuyo/
├── apps/
│   └── web/                 # Next.js web application
├── packages/
│   ├── bulletin/            # Bulletin Chain client
│   ├── contracts/           # Solidity contracts + ABIs (BountyEscrow, FireflyReputation, …)
│   ├── identity/            # DIM identity integration
│   ├── individuality/       # Proof-of-personhood + DotNS directory
│   ├── network-config/      # Single network registry (addresses, RPC URLs, chain ids)
│   ├── types/               # Shared TypeScript types + Zod validators
│   └── ui/                  # Shared UI component library
├── workers/
│   └── claim-extractor/     # Standalone Cloudflare Worker (deployed independently)
└── docs/                    # Documentation
```

## Packages

### @cocuyo/types

Shared TypeScript type definitions and branded type utilities.

**Key exports:**

- `Signal`, `StoryChain`, `ChainPreview` — Core data structures
- `Post`, `PostPreview`, `Claim`, `ClaimPreview` — Content and verification types
- `FireflyProfile`, `FireflyAuthor` — Identity types
- `Corroboration`, `VerificationRequest` — Verification system types
- `Bounty`, `BountyPreview` — Bounty system types
- `Collective`, `CollectivePreview` — Collective types
- Brand creators: `createSignalId()`, `createChainId()`, `createPostId()`, `createClaimId()`, etc.

**Design decisions:**

- Uses branded types (nominal typing) for IDs to prevent mixing
- All timestamps are Unix timestamps in seconds
- Optional fields use explicit `undefined` rather than `null`

### @cocuyo/ui

Shared React component library with Firefly Network design system.

**Components:**

- `Button` — Primary, secondary, and illuminate variants
- `Navbar` — Site header with navigation and illuminate CTA
- `Footer` — Site footer with links and attribution
- `SignalCard` — Signal display component
- `VerificationBadge` — Status indicator for verification state
- `FireflySymbol` — The ✦ symbol used throughout the UI

**Design system:**

- CSS custom properties for theming (light/dark)
- Tailwind CSS for utility styling
- Unbounded font for headings (Polkadot ecosystem)
- Inter font for body text
- Firefly gold (#E8B931) as primary accent

### @cocuyo/identity

DIM (Decentralized Identity Module) integration for proof-of-personhood.

**Current state:** Mock implementation for development

**Key exports:**

- `createDIMClient()` — Factory for DIM client
- `generatePseudonym()` — Deterministic pseudonym from credential
- `DIMClient` interface — Status checking and verification

**Future integration:**

- Real DIM pallet interaction via polkadot-api
- Zero-knowledge credential verification
- Pseudonym derivation from on-chain data

### @cocuyo/bulletin

Bulletin Chain client for decentralized content storage.

**Key exports:**

- `calculateCID()` — Compute content identifier for data
- `BulletinClient` — Upload and retrieve content
- `ContentIndex` — Index structure for content discovery

**CID calculation:**

- Uses SHA-256 hashing
- Multihash encoding for compatibility
- Deterministic: same content always produces same CID

## Web Application

### Routing

Uses Next.js 15+ App Router with locale-based routing:

```
src/app/
├── [locale]/
│   ├── page.tsx              # Landing page
│   ├── about/page.tsx        # About page
│   ├── explore/page.tsx      # Explore signals/chains
│   ├── chain/[id]/page.tsx   # Story chain detail
│   ├── signal/[id]/page.tsx  # Signal detail
│   ├── bounties/page.tsx     # Bounty listing
│   ├── bounty/[id]/page.tsx  # Bounty detail
│   ├── posts/page.tsx        # Posts listing
│   ├── post/[id]/page.tsx    # Post detail
│   ├── claim/[id]/page.tsx   # Claim detail with evidence
│   ├── campaign/             # Sponsored fact-checking campaigns
│   ├── verify/page.tsx       # DIM personhood verification flow
│   ├── join/page.tsx         # Onboarding / join
│   ├── dashboard/page.tsx    # Authenticated dashboard
│   ├── newsroom/             # Newsroom / outlet views
│   ├── alliance/             # Alliance governance + treasury
│   ├── workbench/page.tsx    # Verification workbench (collective members)
│   └── profile/page.tsx      # Private reputation dashboard
├── layout.tsx
└── error.tsx
```

### Internationalization

Uses next-intl for localization:

- English (`en`) — Default
- Spanish (`es`) — Latin American Spanish

Messages stored in `i18n/messages/{locale}.json`.

### State Management

Minimal state management approach:

- **URL state** for navigation and filters
- **React Context** for global concerns (theme, illuminate modal)
- **Hooks** for feature-specific state (useIdentity, useBulletin)

No external state library (Redux, Zustand) is used.

### Service Layer

All data access goes through interface-first service abstractions in `src/lib/services/`
(~25 services). Each domain exposes an interface (defined in `@cocuyo/types`) with one or more
implementations — typically an in-memory mock plus an on-chain implementation. There is **no
barrel `index.ts`** (it was removed in Phase 4). Concrete instance selection lives in a single
module:

```
src/lib/services/
├── service-instances.ts           # Selects mock vs chain impls (replaces the old index.ts barrel)
├── chain-service.ts               # Story chain operations (interface + mock)
├── chain-service.onchain.ts       # Chain-backed chain service
├── chain-signal-service.ts        # Chain-backed signal/post service
├── signal-service.ts              # Signal/post operations
├── campaign-service.ts            # Campaign operations
├── claim-service.ts               # Claim operations
├── verdict-service.ts             # Verdict operations
├── crowdstacking-service.ts       # Crowdstacking pool
├── bounty / treasury / governance / alliance-governance / outlet-registry / firefly / …
├── chain-personhood-service.ts    # On-chain (PeopleLite) personhood
├── personhood-service.ts          # Mock personhood
├── pusd-payment-service.ts        # pUSD payments (simulated by default)
├── coin-payment-service.ts        # Coinage payments (mock + hosted)
├── native-payment (lib/chain)     # Native PAS transfer — the one real on-chain payment
└── hooks/                         # React hooks bound to the selected service instances
```

**Environment switching:** Set `NEXT_PUBLIC_USE_CHAIN=true` to use chain-backed data services, and
`NEXT_PUBLIC_USE_CHAIN_CONTRACTS=true` to enable the EVM contract paths. Both default to **off**, so
the default build is mock-driven.

**Current state:** Mocks by default; chain-backed implementations exist and are selectable via the
flags above. Native PAS transfer is the only fully real on-chain payment; on-chain contract _write_
paths are not yet host-verified.

### Chain Layer

`src/lib/chain/` is the on-chain access layer:

- **`client.ts` / `config.ts`** — Firefly chain API + resolved network config (from
  `@cocuyo/network-config`, including the `NEXT_PUBLIC_USE_CHAIN_CONTRACTS` flag).
- **`revive.ts`** — PolkaVM/revive access: `callContract` (read) and `sendContractTx` (write) against
  the Asset Hub revive pallet, plus H160 ↔ SS58 address helpers and `mapAccount`.
- **`evm/`** — a direct ethers/EVM JSON-RPC read path (config + ABIs) used by the EVM contract hooks.
- **`asset-hub-provider.ts`, `native-payment.ts`, `bounty-escrow.ts`** — Asset Hub provider, the
  native PAS transfer primitive, and the bounty-escrow wrapper.
- **`abi/`, `contracts/`** — revive ABIs and typed contract wrappers (AllianceGovernance,
  CrowdstackingPool, OutletRegistry, ERC-20).

These talk to the six UUPS proxies deployed on Paseo Next v2 Asset Hub (see README / DEPLOY.md for
addresses).

### Host Integration

Triangle SDK integration for wallet connection:

```
src/lib/host/
├── detect.ts     # Host environment detection
├── storage.ts    # HostAPI-compliant storage
└── wallet.ts     # Wallet connection utilities
```

The app can run in two modes:

1. **Standalone** — Direct browser access, localStorage
2. **Hosted** — Running inside Triangle, uses HostAPI

## Data Flow

### Signal Creation (Illuminate)

```
User Input
    ↓
IlluminateForm validates
    ↓
useIlluminate.submit()
    ↓
signalService.illuminate()
    ↓
calculateCID() for content
    ↓
Write to Bulletin Chain (via @polkadot-apps/bulletin) — live
    ↓
Return Signal with CID
```

### Identity Verification

```
User connects wallet
    ↓
useTriangleAccount detects connection
    ↓
useIdentity initializes
    ↓
createDIMClient()
    ↓
client.getStatus()
    ↓
[Future: Verify against DIM pallet]
    ↓
client.getCredential()
    ↓
User creates profile (pseudonym, disclosure level)
    ↓
saveProfile() to storage
```

## Security Architecture

### Threat Model

Primary threats:

1. **Identity exposure** — Revealing firefly's real identity
2. **Censorship** — Removing or suppressing signals
3. **Manipulation** — Fake signals, sybil attacks
4. **Surveillance** — Tracking user activity

### Mitigations

1. **DIM proof-of-personhood** — Proves humanity without revealing identity
2. **Bulletin Chain** — Censorship-resistant storage
3. **Reputation staking** — Economic cost to manipulation
4. **Minimal data collection** — No PII stored anywhere

### Content Security Policy

Strict CSP enforced:

- No inline scripts
- No eval()
- HTTPS only
- SRI for external resources

## Build and Deploy

### Development

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server
pnpm build            # Build all packages
pnpm check            # Run all checks
```

### Production Build

```bash
pnpm build            # Build packages then app
# Output: apps/web/dist/
```

Static export (`output: 'export'`) for deployment to:

- GitHub Pages (demo)
- Triangle/Bulletin (production)
- Any static host

### CI/CD

GitHub Actions workflows:

- `deploy-pages.yml` — Deploy to GitHub Pages on push to main
- `deploy-bulletin.yml` — Deploy to Bulletin Chain

## Status & Remaining Work

### Already shipped

- **Bulletin Chain writes** — signals/posts are written to the Bulletin Chain (live), not mocked.
- **Deployed contracts** — six UUPS proxies on Paseo Next v2 Asset Hub (BountyEscrow,
  FireflyReputation, CrowdstackingPool, OutletRegistry, ContributorRegistry, AllianceGovernance).
- **Chain read paths + bounty escrow wrapper** — selectable via `NEXT_PUBLIC_USE_CHAIN_CONTRACTS`.
- **Native PAS transfer** — a real signed extrinsic.
- **Host-attested personhood** — 'lite' personhood inside the Triangle host container.

### Still pending

- **DIM on-chain attestation** — `PeopleLite.attest` needs an attestation verifier service holding
  `AttestationAllowance`; the candidate cannot self-attest, so `/verify` honestly reports
  "not available yet" (see `docs/identity-guide.md`).
- **Host-verified contract writes** — on-chain contract _write_ paths exist but are not yet verified
  against the host signer.
- **pUSD + Coinage payments** — simulated by default; only native PAS is a real payment today.
- **Full indexing / queries** — currently session-cache only.
