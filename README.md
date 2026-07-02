> [!WARNING]
> The following is a prototype, reference implementation, and proof-of-concept. This open source code is provided for research, experimentation, and developer education only. This code has not been audited, is actively experimental, and may contain bugs, vulnerabilities, or incomplete features. Use at your own risk.

# Cocuyo — The Firefly Network

> Lights in the Dark — A surveillance-resistant network for collective intelligence.

## What is This?

The Firefly Network (codenamed Cocuyo, after the Caribbean bioluminescent beetle) is a decentralized platform where verified humans share, corroborate, and build collective understanding — without exposing their identities.

This is **not** a social media platform. It is a collective intelligence network built on Polkadot infrastructure where:

- **Fireflies** are verified human participants (via DIM proof-of-personhood)
- **Posts** are observations, evidence, or data points shared by fireflies
- **Story Chains** emerge when posts connect around topics or events
- **Corroboration** is the core interaction — a reputation-staked act of verification, not a "like"
- **Campaigns** are sponsored fact-checking efforts with funded rewards

## Features

### Core Features

- **Posts** — Illuminate observations with photos (up to 3), topics, and location
- **Story Chains** — Emergent structures formed when posts connect around topics
- **Corroboration** — Reputation-staked verification with evidence (witness, expertise, challenge)
- **Campaigns** — Sponsored fact-checking efforts with funded rewards for contributors

### Content & Verification

- **Claims** — Verifiable truth targets extracted from posts with evidence bundles
- **Verdicts** — Collective decisions on claim veracity (confirmed, disputed, false, synthetic, inconclusive)
- **Trust Drawer** — View all evidence, corroborations, and verdicts for a post
- **Collectives** — Fact-checking groups that verify posts collaboratively

### User Experience

- **Explore View** — Browse posts and story chains in list or map view
- **Illuminate Modal** — Universal post creation with smart chain/campaign suggestions
- **Profile Dashboard** — Private view of your topic-weighted reputation
- **Wallet Connection** — Connect via Triangle SDK or browser extensions
- **Light/Dark Theme** — Toggle between light and dark modes
- **Localization** — English and Latin American Spanish (next-intl)
- **Responsive Design** — Works on desktop and mobile

## Web3 Integration

### Network configuration

All chain specifics — Asset Hub (Substrate WS + EVM RPC), pUSD, Bulletin/IPFS, DIM, and contract
addresses — live in one registry, **`@cocuyo/network-config`**. Select the active network with a
single build-time variable:

```bash
NEXT_PUBLIC_NETWORK=paseo      # Paseo Next v2 testnet (deploy target)
# NEXT_PUBLIC_NETWORK=localhost  # local hardhat node for EVM contract work
```

Because the app is a static export, this is **baked in at build time** — one build targets one
network; switching means rebuild + redeploy. Inside the Triangle host the host routes the chain
connection (so the live network follows the host's configuration); the registry endpoints apply to
standalone `pnpm dev`. Per-field overrides (`NEXT_PUBLIC_ASSET_HUB_RPC`, `NEXT_PUBLIC_CHAIN_ID`,
`NEXT_PUBLIC_BULLETIN_ENDPOINT`, …) are optional — see [`apps/web/.env.example`](./apps/web/.env.example).

### Bulletin Chain (Content Storage)

Posts are stored on the Bulletin Chain via `@polkadot-apps/bulletin`:

- **Host mode** (Triangle): Uses preimageManager API for signing
- **Standalone**: Uses dev signer (//Alice) for development

Content is fetchable via IPFS gateways:

- `https://ipfs.dotspark.app/ipfs/{cid}`
- `https://dweb.link/ipfs/{cid}`
- `https://ipfs.io/ipfs/{cid}`

### Smart Contracts (Paseo Next v2 Asset Hub)

Six UUPS-upgradeable proxies are deployed to Paseo Asset Hub (chain ID `420420417`, EVM RPC
`https://eth-rpc-paseo-next.polkadot.io`). These are the proxy addresses applications call; they
match `packages/contracts/deployments/paseo.json` and `@cocuyo/network-config`.

| Contract            | Proxy address                                |
| ------------------- | -------------------------------------------- |
| BountyEscrow        | `0x276DA2f00730E98c621832919153ca84eC4981eD` |
| FireflyReputation   | `0xCD455CCb96Ed177609Daedcb4ec9884ECcC9688c` |
| CrowdstackingPool   | `0x9C18b15B8875ee2134d3BDD95277D406e38eACF8` |
| OutletRegistry      | `0x1f50918664B5a1e2FAD7044dC4Ccf3A3f2e878A1` |
| ContributorRegistry | `0x0B5b2c18f7C631DBe5544CFAC933ecCd80A28567` |
| AllianceGovernance  | `0x21Be8596A58852AE871a49A2B21e0342036cfec3` |

> **What is real vs. mock today.** The contracts above are deployed, but most contract flows are
> **mock-driven by default**: data services use in-memory mocks unless `NEXT_PUBLIC_USE_CHAIN=true`,
> and the EVM contract paths are off unless `NEXT_PUBLIC_USE_CHAIN_CONTRACTS=true`. Today the only
> fully real on-chain payment is the **native PAS transfer**; the wired chain-flag read paths talk to
> the deployed contracts, but the chain **write** paths are not yet host-verified. Treat on-chain
> writes as experimental.

### Wallet Support

- **Triangle SDK** — Auto-connects via host product accounts in Host mode
- **Browser extensions** — Polkadot.js, Talisman, SubWallet, etc.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build all packages
pnpm build

# Run all checks (lint, typecheck, test)
pnpm check
```

## Project Structure

```
cocuyo/
├── apps/
│   └── web/              # Next.js 15+ web application
│       ├── src/app/[locale]/  # Locale-based routing (en, es)
│       ├── e2e/          # Playwright end-to-end tests
│       └── i18n/         # Internationalization config
├── packages/
│   ├── bulletin/         # Bulletin chain client (CID calculation)
│   ├── contracts/        # Solidity smart contracts (Hardhat)
│   ├── identity/         # DIM identity integration
│   ├── individuality/    # Proof-of-personhood + DotNS directory
│   ├── network-config/   # Single network registry (addresses, RPC, chain ids)
│   ├── types/            # Shared TypeScript types + Zod validators
│   └── ui/               # Shared UI component library
├── workers/
│   └── claim-extractor/  # Standalone Cloudflare Worker (deployed independently)
└── docs/                 # Documentation
```

## Technology Stack

| Layer           | Technology                             |
| --------------- | -------------------------------------- |
| Framework       | Next.js 15+ (App Router)               |
| Language        | TypeScript (strict mode)               |
| Styling         | Tailwind CSS + CSS custom properties   |
| Fonts           | Unbounded (Polkadot ecosystem) + Inter |
| Maps            | Leaflet + D3 + TopoJSON                |
| Localization    | next-intl                              |
| Wallet          | @polkadot-apps/signer + Triangle SDK   |
| Blockchain      | @polkadot-apps/bulletin, polkadot-api  |
| Smart Contracts | Solidity 0.8.28, Hardhat, OpenZeppelin |
| Monorepo        | pnpm workspaces + Turborepo            |
| Testing         | Vitest + React Testing Library         |
| CI/CD           | GitHub Actions                         |

## Localization

The app supports multiple locales via next-intl:

- **English** (`/en/`) — Default
- **Spanish** (`/es/`) — Latin American Spanish

Translation files are in `apps/web/i18n/messages/`.

## Deploying

For deployment instructions, see [DEPLOY.md](./DEPLOY.md).

## Design System

The visual identity is rooted in the Polkadot ecosystem's black-and-white aesthetic with a single warm accent — **firefly gold (#E8B931)** — used sparingly for moments of illumination.

Key principles:

- Minimal, high-contrast, anti-social-media
- No infinite scroll, no notification badges, no engagement metrics
- The primary action is "Illuminate" — not "post" or "share"

## Development

See [CLAUDE.md](./CLAUDE.md) for comprehensive development guidelines, coding standards, and architecture documentation.

## Built on Polkadot

The Firefly Network is built on and for the Polkadot ecosystem, leveraging:

- **DIM** — Decentralized identity for proof-of-personhood
- **Bulletin Chain** — Censorship-resistant storage
- **Paseo Asset Hub** — Smart contracts for campaigns and reputation

[Learn more about Polkadot](https://polkadot.com)

## Security

### Security status

> [!WARNING]
> The following is a prototype, reference implementation, and proof-of-concept. This open source code is provided for research, experimentation, and developer education only. This code has not been audited, is actively experimental, and may contain bugs, vulnerabilities, or incomplete features. Use at your own risk.

This repository contains reference / proof-of-concept code and patterns, intended for reference and experimentation, not as a production-ready artefact. Unless a specific release states otherwise, it has **not** received a full security audit; production or production-like use should follow an independent security review.

Before deploying for real use cases, you are responsible for:

- Reviewing the code yourself — we publish a reference, not a hardened production build
- Checking that dependencies are up to date and free of known vulnerabilities
- Securing your own fork or deployment environment (keys, secrets, network configuration)
- Tracking the latest tagged releases/commits for security fixes; older releases are not backported (exceptions might apply)

For Parity's security disclosure process and Bug Bounty program, visit: https://parity.io/bug-bounty

## License

GPL-3.0 — see [LICENSE](./LICENSE) for details.

---

_Millions of tiny sparks can illuminate an entire nation._
