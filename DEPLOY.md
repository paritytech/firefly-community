# Deployment Guide

This guide covers two independent deployments:

1. **Smart contracts** → Paseo Next v2 Asset Hub (PolkaVM / revive EVM), via `packages/contracts`.
2. **The web app** → Bulletin Chain with a DotNS domain.

The app does not require freshly deployed contracts to run — addresses already ship in
`@cocuyo/network-config`. Deploy contracts only when you are changing them or standing up your own
testnet. The contract section is first because the app embeds the resulting addresses.

---

## Smart Contract Deployment (Paseo Next v2 Asset Hub)

Six UUPS-upgradeable proxies (BountyEscrow, FireflyReputation, CrowdstackingPool, OutletRegistry,
ContributorRegistry, AllianceGovernance) are deployed with Hardhat from `packages/contracts`.

### Prerequisites

- **An Ethereum-style deployer key.** Set **either** an `MNEMONIC` (BIP-44 secp256k1, derivation
  path `m/44'/60'/0'/0`) **or** a raw `PRIVATE_KEY` in `packages/contracts/.env`.
  - **A Substrate/Polkadot sr25519 seed will NOT work.** sr25519 cannot sign EVM transactions, and
    even if reused it derives a _different_ `0x` address than the one you funded — deployment will
    fail with an unfunded-account error.
- **Fund the deployer's `0x` address with Paseo PAS.** The deploy script prints the derived `0x`
  deployer address; send PAS to that exact address (faucet: https://faucet.polkadot.io, Paseo →
  Asset Hub).
- RPC: `https://eth-rpc-paseo-next.polkadot.io` (chain ID `420420417`). Override with
  `PASEO_RPC_URL` if needed.

### Steps

```bash
# from the repo root
pnpm --filter @cocuyo/contracts download:binaries   # fetch the resolc PolkaVM compiler -> ./bin/resolc
pnpm --filter @cocuyo/contracts compile             # hardhat compile (resolc, viaIR)
pnpm --filter @cocuyo/contracts deploy:paseo        # hardhat run scripts/deploy.ts --network paseo
```

### Notes & gotchas

- **`patches/allow-large-initcode.cjs`** is loaded first in `hardhat.config.ts`. It raises
  micro-eth-signer's EIP-3860 init-code size limit, which does not apply to PolkaVM but would
  otherwise reject the large compiled contracts. Do not remove it.
- **OpenZeppelin upgrades manifest:** deployment writes
  `.openzeppelin/unknown-<chainId>.json` (here `unknown-420420417.json`). It records proxy ↔
  implementation links for upgrade safety. To redeploy a _fresh_ set of contracts onto a chain that
  reuses the same chain ID (e.g. a reset local/testnet), **delete that file first**, otherwise the
  upgrades plugin will try to reuse the stale, now-nonexistent implementations.
- **Recording addresses:** the script writes proxy + implementation addresses to
  `packages/contracts/deployments/paseo.json`. After a redeploy, copy the six proxy addresses into
  `packages/network-config/src/index.ts` (the `contracts` block of the `paseo` config) so the app
  picks them up. The app reads `@cocuyo/network-config`, never `deployments/paseo.json` directly.
- **Local EVM dev:** `pnpm --filter @cocuyo/contracts deploy:local` targets a hardhat node
  (`http://127.0.0.1:8545`, chain ID `31337`).

---

## Web App Deployment

Deploy Cocuyo to Bulletin Chain with a DotNS domain.

## Quick Start

```bash
./scripts/deploy.sh
```

The interactive script will guide you through:

1. Installing dependencies
2. Building the project
3. Deploying to Bulletin Chain
4. Registering your DotNS domain

## Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org)
- **pnpm** - Installed automatically if missing
- **bulletin-deploy** - Installed automatically if missing
- **Funded wallet** - You need PAS tokens for deployment

### Getting Testnet Tokens

Get free PAS tokens from the [Polkadot Faucet](https://faucet.polkadot.io):

1. Select "Paseo" network
2. Select "Asset Hub" parachain
3. Enter your wallet address
4. Request tokens

## Deployment Options

### Interactive Mode (Recommended)

```bash
./scripts/deploy.sh
```

The script will prompt for:

- **Domain**: Your DotNS domain (default: `cocuyo.dot`)
- **Mnemonic**: Your wallet's 12-word seed phrase (not stored)

> The app derives its host wallet account from whatever DotNS domain it is served from (via the
> host's product-account path), so a single build works on any domain — no per-domain rebuild or
> `NEXT_PUBLIC_*` configuration is required.

### With Environment Variables

```bash
MNEMONIC="your twelve word seed phrase here" \
DOTNS_DOMAIN="mydomain.dot" \
./scripts/deploy.sh
```

### Skip Build (Use Existing)

```bash
./scripts/deploy.sh --skip-build
```

### Command Line Domain

```bash
./scripts/deploy.sh --domain mydomain.dot
```

## After Deployment

Your app will be available at:

```
https://<your-domain>.dot.li
```

For example, if you deployed to `myapp.dot`:

```
https://myapp.dot.li
```

## Troubleshooting

### "Insufficient balance"

Your wallet needs PAS tokens. Get them from the [faucet](https://faucet.polkadot.io).

### "Domain already registered"

The domain is taken. Choose a different domain name.

### Build fails

1. Delete `node_modules` and try again:

   ```bash
   rm -rf node_modules
   ./scripts/deploy.sh
   ```

2. Check Node.js version:
   ```bash
   node --version  # Should be 18+
   ```

## Manual Deployment

If you prefer to deploy manually:

```bash
# 1. Install dependencies
pnpm install

# 2. Build
pnpm build

# 3. Deploy (adjust dist path for your project)
MNEMONIC="your seed phrase" bulletin-deploy ./apps/web/dist mydomain.dot
```

## Security Notes

- Your mnemonic is used only to sign the deployment transaction
- It is never stored, logged, or transmitted anywhere except to the blockchain
- Use a dedicated deployment wallet, not your main holdings wallet
