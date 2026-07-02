# @cocuyo/network-config

Single source of truth for Firefly Network chain/network configuration: one typed registry of
networks plus a pure resolver. Leaf package — **no app or sibling-package imports, no runtime
dependencies.**

## Why

Network specifics used to be scattered across `chain/config.ts`, `contracts/config.ts`, the
`@polkadot-apps/*` presets, a hardcoded DIM endpoint, and a dead `@cocuyo/bulletin` registry, with
two competing selector env vars. This package consolidates the _values_ and the _selection logic_
into one place.

## Usage

```ts
import { resolveNetwork, requireKnownNetworkId } from '@cocuyo/network-config';

// Build-time: pass process.env. (apps/web is a static export — values bake in at build.)
const network = resolveNetwork(process.env);

network.assetHub.evmRpc; // EVM HTTP JSON-RPC for ethers/contracts
network.bulletin.ipfsGateway; // IPFS gateway
network.contracts.bountyEscrow; // per-network contract address (or null)

// Optional build-time guard (e.g. a prebuild step): throw on an explicit, unknown selector.
requireKnownNetworkId(process.env);
```

`resolveNetwork(source)` is **pure**: same source → an equal, independent object. The app layer
owns any caching. A future runtime-config mechanism can pass a fetched object instead of
`process.env` without changing this package.

## Selection

`NEXT_PUBLIC_NETWORK` (`paseo` | `localhost`) selects the entry. An explicit value wins outright —
a known value is used; any other non-blank value falls back to `localhost` (not overridden by the
legacy variable). When `NEXT_PUBLIC_NETWORK` is absent, legacy `NEXT_PUBLIC_CHAIN_ENVIRONMENT`
(`paseo`/`localhost`) is honoured for one release. `selectNetworkId`/`resolveNetwork` are lenient
(never throw); `requireKnownNetworkId` throws on an explicit-but-unknown selector — use it in a
build guard so a typo fails the build instead of silently shipping the default. Per-field
build-time overrides (`NEXT_PUBLIC_ASSET_HUB_RPC` — routed to WS or EVM by protocol —
`NEXT_PUBLIC_PUSD_ASSET_ADDRESS`, `NEXT_PUBLIC_BULLETIN_ENDPOINT`, `NEXT_PUBLIC_IPFS_GATEWAY`,
`NEXT_PUBLIC_CHAIN_ID`) layer on top; blank values and malformed addresses/chain-ids are ignored.

## Caveat: live chain/Bulletin vs. the registry

The live chain + Bulletin connection is created by `@polkadot-apps/chain-client`
`getChainAPI(env)` / `@polkadot-apps/bulletin` `BulletinClient.create(env)`, which use upstream
**presets** keyed by `chainEnvironment` and accept no endpoint override. Inside the Triangle host
the host routes that connection (so the live network follows the host's configuration); the
registry's Substrate/Bulletin endpoints apply to standalone `pnpm dev`. The registry's `evmRpc`,
IPFS gateway, pUSD, DIM, and contract values are consumed by `apps/web` (`chain/config.ts`,
`contracts/config.ts`, `@cocuyo/identity`).
