# pUSD Integration Guide

> [!WARNING]
> **Experimental concept/design document.** This code is developed and published by Parity as a prototype and proof-of-concept — it is **not** a Parity product or an operated service, and Parity does not run or take responsibility for any deployment. The design here is experimental and unaudited; all figures, timelines, and named systems are **illustrative only**.

> Implementing stablecoin payments for the Firefly Network and Cocuyo Alliance

> **Status: simulated.** The pUSD payment paths described here are **not live**. In the current
> build they run against in-memory mock services by default — no real pUSD extrinsic is submitted.
> The only fully real on-chain payment today is the **native PAS transfer**. Treat this document as
> the integration design/plan, not a description of shipped behavior.

## Table of Contents

1. [Overview](#overview)
2. [How pUSD Drives Usage](#how-pusd-drives-usage)
3. [Architecture](#architecture)
4. [Implementation Phases](#implementation-phases)
5. [Phase 1: Currency Foundation](#phase-1-currency-foundation)
6. [Phase 2: Bounty Payments](#phase-2-bounty-payments)
7. [Phase 3: Treasury Infrastructure](#phase-3-treasury-infrastructure)
8. [Phase 4: Contributor Payments](#phase-4-contributor-payments)
9. [Phase 5: Membership & Premium](#phase-5-membership--premium)
10. [Volume Projections](#volume-projections)
11. [On/Off Ramp Strategy](#onoff-ramp-strategy)

---

## Overview

pUSD is a Polkadot-native stablecoin that enables censorship-resistant payments for independent journalism. This guide documents how to integrate pUSD throughout the Firefly Network ecosystem.

### Why pUSD?

| Challenge                       | Traditional Finance             | pUSD Solution                     |
| ------------------------------- | ------------------------------- | --------------------------------- |
| Bank account frozen             | Outlet loses all funds          | Funds in user-controlled wallets  |
| Payment processor blocks region | No way to receive donations     | Direct wallet-to-wallet transfers |
| Hyperinflation                  | Local currency worthless        | Stable USD-pegged value           |
| Wire transfer fees              | 3-5% fees + delays              | <$0.01 fees, instant settlement   |
| Diaspora contributions          | Complex international transfers | Simple wallet transfer            |

### Core Principle

> "No intermediary takes a cut, no payment processor can block the transaction."
> — From `/packages/types/src/bounty.ts`

---

## How pUSD Drives Usage

The Firefly Network creates **real, recurring demand** for pUSD through multiple integrated use cases:

### 1. Information Bounties (Primary Driver)

```
┌─────────────────────────────────────────────────────────────────┐
│                    BOUNTY LIFECYCLE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   FUNDER                    ESCROW                  FIREFLY      │
│   (Diaspora,               (On-chain)              (Journalist)  │
│    NGO, Donor)                                                   │
│                                                                  │
│      │                         │                        │        │
│      │─── Creates bounty ─────▶│                        │        │
│      │    + deposits pUSD      │                        │        │
│      │                         │                        │        │
│      │                         │◀── Illuminates ────────│        │
│      │                         │    signal addressing   │        │
│      │                         │    bounty              │        │
│      │                         │                        │        │
│      │                         │─── Collective ────────▶│        │
│      │                         │    verifies signal     │        │
│      │                         │                        │        │
│      │                         │─── pUSD payout ───────▶│        │
│      │                         │                        │        │
└─────────────────────────────────────────────────────────────────┘
```

**pUSD Flow:**

- Funder deposits pUSD to create bounty
- pUSD held in escrow until fulfillment
- On verification, pUSD released to contributing firefly(s)
- Unfulfilled bounties return pUSD to funder on expiry

**Volume Driver:** Each bounty cycles pUSD through the system. Active bounties create constant demand.

### 2. Crowdstacking Treasury (Capital Accumulation)

```
┌─────────────────────────────────────────────────────────────────┐
│                    TREASURY MODEL                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   SUPPORTERS          ALLIANCE TREASURY         OPERATIONS       │
│   (Recurring          (Multi-sig vault)         (Newsrooms)      │
│    contributors)                                                 │
│                                                                  │
│      │                         │                        │        │
│      │─── Monthly pUSD ───────▶│                        │        │
│      │    contribution         │                        │        │
│      │                         │                        │        │
│      │                         │─── Operating ─────────▶│        │
│      │                         │    budget (yield)      │        │
│      │                         │                        │        │
│      │                         │◀── Principal ──────────│        │
│      │                         │    preserved           │        │
│      │                         │                        │        │
│   [Optional]                   │                        │        │
│      │                         │                        │        │
│      │              ┌──────────┴──────────┐             │        │
│      │              │   DeFi Yield        │             │        │
│      │              │   (Hydration, etc)  │             │        │
│      │              └──────────┬──────────┘             │        │
│      │                         │                        │        │
│      │                         │─── Yield income ──────▶│        │
│      │                         │                        │        │
└─────────────────────────────────────────────────────────────────┘
```

**pUSD Flow:**

- Supporters contribute pUSD monthly (crowdstacking)
- Treasury holds pUSD as stable reserve
- Optional: Deploy pUSD in DeFi for yield
- Operating income distributed to member outlets

**Volume Driver:** Accumulating treasury creates large pUSD holdings. 50,000 contributors × $25/month = $1.25M monthly inflow.

### 3. Journalist Compensation (Recurring Payments)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PAYMENT RAILS                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   OUTLET               JOURNALIST             LOCAL ECONOMY      │
│   (Efecto Cocuyo,     (Contributor)          (When off-ramps    │
│    El Faro, etc)                              available)         │
│                                                                  │
│      │                         │                        │        │
│      │─── Monthly pUSD ───────▶│                        │        │
│      │    salary/stipend       │                        │        │
│      │                         │                        │        │
│      │─── Per-piece ──────────▶│                        │        │
│      │    payment              │                        │        │
│      │                         │                        │        │
│      │                         │─── Off-ramp ──────────▶│        │
│      │                         │    (future)            │        │
│      │                         │                        │        │
│      │                         │─── Direct spend ──────▶│        │
│      │                         │    (pUSD merchants)    │        │
│      │                         │                        │        │
└─────────────────────────────────────────────────────────────────┘
```

**pUSD Flow:**

- Outlets pay journalists in pUSD
- Cross-border payments without banking friction
- Stable value protects purchasing power

**Volume Driver:** Regular payroll creates predictable pUSD velocity. 100 outlets × 10 journalists × $500/month = $500K monthly.

### 4. Alliance Settlements (Inter-Outlet Commerce)

```
┌─────────────────────────────────────────────────────────────────┐
│                    ALLIANCE COMMERCE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   EL FARO            SHARED INVESTIGATION       EFECTO COCUYO   │
│   (El Salvador)      (Cross-border story)       (Venezuela)     │
│                                                                  │
│      │                         │                        │        │
│      │─── Co-investigation ───▶│◀───────────────────────│        │
│      │    funding              │                        │        │
│      │                         │                        │        │
│      │◀── Local sourcing ──────│                        │        │
│      │    pUSD payment         │                        │        │
│      │                         │                        │        │
│      │─── Content licensing ───│───────────────────────▶│        │
│      │    pUSD settlement      │                        │        │
│      │                         │                        │        │
└─────────────────────────────────────────────────────────────────┘
```

**pUSD Flow:**

- Outlets pay each other for collaboration
- No SWIFT fees or correspondent banking
- Instant settlement

**Volume Driver:** Alliance of 100 outlets creates N×N payment relationships.

### 5. Membership & Verification Staking (Future)

```
┌─────────────────────────────────────────────────────────────────┐
│                    MEMBERSHIP & STAKING                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   MEMBER                FIREFLY NETWORK         REWARDS POOL    │
│   (Verified                                                      │
│    firefly)                                                      │
│                                                                  │
│      │                         │                        │        │
│      │─── Membership fee ─────▶│                        │        │
│      │    (pUSD/month)         │                        │        │
│      │                         │                        │        │
│      │◀── Premium access ──────│                        │        │
│      │                         │                        │        │
│      │─── Corroboration ──────▶│                        │        │
│      │    stake (pUSD)         │                        │        │
│      │                         │                        │        │
│      │◀── Stake + rewards ─────│◀───────────────────────│        │
│      │    (if accurate)        │    (from slashed       │        │
│      │                         │     stakes)            │        │
│      │                         │                        │        │
└─────────────────────────────────────────────────────────────────┘
```

**pUSD Flow:**

- Monthly membership fees in pUSD
- Verification staking locks pUSD
- Accurate corroborators earn from slashed stakes

**Volume Driver:** Economic skin-in-the-game for truth-telling.

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     FIREFLY NETWORK                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Web App   │  │  Treasury   │  │   Bulletin Chain        │  │
│  │  (Next.js)  │  │   Portal    │  │   (Signal Storage)      │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                      │                │
│         └────────────────┼──────────────────────┘                │
│                          │                                       │
│                  ┌───────▼───────┐                               │
│                  │   Services    │                               │
│                  │  - Bounty     │                               │
│                  │  - Payment    │                               │
│                  │  - Treasury   │                               │
│                  └───────┬───────┘                               │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                   POLKADOT ECOSYSTEM                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Asset Hub      │  │  Bulletin       │  │   DIM Chain     │  │
│  │  (pUSD home)    │  │  Parachain      │  │   (Identity)    │  │
│  │                 │  │                 │  │                 │  │
│  │  - pUSD token   │  │  - Signal data  │  │  - Proof of     │  │
│  │  - Escrow       │  │  - Chain data   │  │    personhood   │  │
│  │  - Treasury     │  │  - Metadata     │  │                 │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                  │
│                          XCM                                     │
│              (Cross-chain messaging)                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Package Structure

```
packages/
├── types/
│   └── src/
│       ├── currency.ts      # NEW: pUSD definitions
│       ├── treasury.ts      # NEW: Treasury types
│       ├── payment.ts       # NEW: Payment types
│       └── bounty.ts        # EXTEND: Add payout logic
│
├── treasury/                # NEW PACKAGE
│   └── src/
│       ├── client.ts        # Treasury operations
│       ├── escrow.ts        # Bounty escrow logic
│       └── multi-sig.ts     # Multi-sig management
│
└── payments/                # NEW PACKAGE
    └── src/
        ├── asset-hub.ts     # Asset Hub integration
        ├── transfer.ts      # pUSD transfers
        └── balance.ts       # Balance queries
```

---

## Implementation Phases

### Phase Overview

| Phase | Focus                   | Duration  | Prerequisite |
| ----- | ----------------------- | --------- | ------------ |
| 1     | Currency Foundation     | 1-2 weeks | —            |
| 2     | Bounty Payments         | 3-4 weeks | Phase 1      |
| 3     | Treasury Infrastructure | 4-6 weeks | Phase 2      |
| 4     | Contributor Payments    | 2-3 weeks | Phase 3      |
| 5     | Membership & Premium    | 3-4 weeks | Phase 4      |

### Dependency Graph

```
Phase 1: Currency Foundation
    │
    ▼
Phase 2: Bounty Payments ────────────────────┐
    │                                         │
    ▼                                         ▼
Phase 3: Treasury ◀─────────────────▶ On/Off Ramps
    │                                  (External)
    ▼
Phase 4: Contributor Payments
    │
    ▼
Phase 5: Membership & Premium
```

---

## Phase 1: Currency Foundation

**Goal:** Establish pUSD type definitions and utility functions.

### Step 1.1: Create Currency Types

Create `/packages/types/src/currency.ts`:

```typescript
/**
 * Currency definitions for pUSD integration.
 *
 * pUSD is a Polkadot-native stablecoin used for all financial
 * operations within the Firefly Network.
 */

import type { PolkadotAddress } from './brands';

/**
 * pUSD asset configuration.
 *
 * Amounts are stored as bigint in the smallest unit (6 decimals).
 * 1 pUSD = 1_000_000 units
 */
export const PUSD = {
  /** Display symbol */
  symbol: 'pUSD',
  /** Decimal places (matches USDC convention) */
  decimals: 6,
  /** Asset Hub asset ID (to be configured) */
  assetId: 0, // TODO: Set actual asset ID
  /** Chain where pUSD lives */
  chain: 'polkadot-asset-hub',
  /** Minimum transfer amount (to avoid dust) */
  minimumTransfer: 100_000n, // 0.1 pUSD
} as const;

/**
 * Branded type for pUSD amounts.
 * Ensures compile-time safety when handling currency.
 */
export type PUSDAmount = bigint & { readonly __brand: 'PUSDAmount' };

/**
 * Create a validated pUSD amount from a bigint.
 */
export function createPUSDAmount(value: bigint): PUSDAmount {
  if (value < 0n) {
    throw new Error('pUSD amount cannot be negative');
  }
  return value as PUSDAmount;
}

/**
 * Parse a human-readable string into pUSD amount.
 * @example parsePUSD("100.50") => 100_500_000n
 */
export function parsePUSD(amount: string): PUSDAmount {
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid pUSD amount: ${amount}`);
  }
  return createPUSDAmount(BigInt(Math.round(parsed * 10 ** PUSD.decimals)));
}

/**
 * Format pUSD amount for display.
 * @example formatPUSD(100_500_000n) => "100.50 pUSD"
 */
export function formatPUSD(
  amount: PUSDAmount,
  options?: {
    includeSymbol?: boolean;
    minimumFractionDigits?: number;
  }
): string {
  const { includeSymbol = true, minimumFractionDigits = 2 } = options ?? {};
  const value = Number(amount) / 10 ** PUSD.decimals;
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits,
    maximumFractionDigits: PUSD.decimals,
  });
  return includeSymbol ? `${formatted} ${PUSD.symbol}` : formatted;
}

/**
 * Add two pUSD amounts safely.
 */
export function addPUSD(a: PUSDAmount, b: PUSDAmount): PUSDAmount {
  return createPUSDAmount(a + b);
}

/**
 * Subtract pUSD amounts safely.
 * @throws If result would be negative
 */
export function subtractPUSD(a: PUSDAmount, b: PUSDAmount): PUSDAmount {
  if (b > a) {
    throw new Error('Subtraction would result in negative amount');
  }
  return createPUSDAmount(a - b);
}

/**
 * A wallet balance in pUSD.
 */
export interface PUSDBalance {
  /** Wallet address */
  readonly address: PolkadotAddress;
  /** Available balance */
  readonly available: PUSDAmount;
  /** Locked/reserved balance (in escrow, staking, etc.) */
  readonly locked: PUSDAmount;
  /** Total balance (available + locked) */
  readonly total: PUSDAmount;
}
```

### Step 1.2: Create Branded Type for pUSD

Update `/packages/types/src/brands.ts`:

```typescript
// Add to existing branded types:

/** pUSD amount in smallest unit (6 decimals) */
export type PUSDAmount = bigint & { readonly __brand: 'PUSDAmount' };

/** Transaction hash for pUSD transfers */
export type TransactionHash = string & { readonly __brand: 'TransactionHash' };

/** Escrow ID for bounty funds */
export type EscrowId = string & { readonly __brand: 'EscrowId' };
```

### Step 1.3: Export from Package

Update `/packages/types/src/index.ts`:

```typescript
// Add export:
export * from './currency';
```

### Step 1.4: Add Tests

Create `/packages/types/src/currency.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parsePUSD, formatPUSD, addPUSD, subtractPUSD, createPUSDAmount } from './currency';

describe('pUSD Currency', () => {
  describe('parsePUSD', () => {
    it('parses whole numbers', () => {
      expect(parsePUSD('100')).toBe(100_000_000n);
    });

    it('parses decimals', () => {
      expect(parsePUSD('100.50')).toBe(100_500_000n);
    });

    it('parses small amounts', () => {
      expect(parsePUSD('0.01')).toBe(10_000n);
    });

    it('throws on negative amounts', () => {
      expect(() => parsePUSD('-100')).toThrow('Invalid pUSD amount');
    });

    it('throws on invalid strings', () => {
      expect(() => parsePUSD('abc')).toThrow('Invalid pUSD amount');
    });
  });

  describe('formatPUSD', () => {
    it('formats with symbol', () => {
      expect(formatPUSD(createPUSDAmount(100_500_000n))).toBe('100.50 pUSD');
    });

    it('formats without symbol', () => {
      expect(formatPUSD(createPUSDAmount(100_500_000n), { includeSymbol: false })).toBe('100.50');
    });

    it('formats large amounts with commas', () => {
      expect(formatPUSD(createPUSDAmount(1_000_000_000_000n))).toBe('1,000,000.00 pUSD');
    });
  });

  describe('arithmetic', () => {
    it('adds amounts', () => {
      const a = createPUSDAmount(100_000_000n);
      const b = createPUSDAmount(50_000_000n);
      expect(addPUSD(a, b)).toBe(150_000_000n);
    });

    it('subtracts amounts', () => {
      const a = createPUSDAmount(100_000_000n);
      const b = createPUSDAmount(30_000_000n);
      expect(subtractPUSD(a, b)).toBe(70_000_000n);
    });

    it('throws on negative subtraction result', () => {
      const a = createPUSDAmount(30_000_000n);
      const b = createPUSDAmount(100_000_000n);
      expect(() => subtractPUSD(a, b)).toThrow('negative');
    });
  });
});
```

---

## Phase 2: Bounty Payments

**Goal:** Implement pUSD escrow and payout for the bounty system.

### Step 2.1: Extend Bounty Types

Update `/packages/types/src/bounty.ts`:

```typescript
import type { PUSDAmount, TransactionHash, EscrowId } from './currency';

// Update Bounty interface:
export interface Bounty {
  // ... existing fields ...

  /** Total funding in pUSD */
  readonly fundingAmount: PUSDAmount;

  /** Escrow ID holding the funds */
  readonly escrowId: EscrowId;

  /** Transaction hash of the funding deposit */
  readonly fundingTxHash: TransactionHash;
}

/**
 * Payout distribution for a fulfilled bounty.
 */
export interface BountyPayout {
  /** Bounty that was fulfilled */
  readonly bountyId: BountyId;

  /** Total payout amount */
  readonly totalAmount: PUSDAmount;

  /** Distribution to contributors */
  readonly distributions: readonly PayoutDistribution[];

  /** Transaction hash of the payout */
  readonly txHash: TransactionHash;

  /** When payout was executed */
  readonly executedAt: number;
}

/**
 * Individual payout to a bounty contributor.
 */
export interface PayoutDistribution {
  /** Signal that contributed to fulfillment */
  readonly signalId: SignalId;

  /** Contributor's wallet address */
  readonly recipientAddress: PolkadotAddress;

  /** Amount paid */
  readonly amount: PUSDAmount;

  /** Percentage of total bounty */
  readonly percentage: number;
}
```

### Step 2.2: Create Escrow Service Interface

Create `/packages/types/src/escrow.ts`:

```typescript
/**
 * Escrow service for bounty fund management.
 */

import type { Result } from './result';
import type { BountyId, EscrowId, PolkadotAddress, SignalId } from './brands';
import type { PUSDAmount, TransactionHash } from './currency';

/**
 * Escrow state for a bounty.
 */
export interface EscrowState {
  /** Escrow identifier */
  readonly id: EscrowId;

  /** Associated bounty */
  readonly bountyId: BountyId;

  /** Funder's address */
  readonly funderAddress: PolkadotAddress;

  /** Total escrowed amount */
  readonly amount: PUSDAmount;

  /** Current status */
  readonly status: 'active' | 'released' | 'refunded';

  /** Deposit transaction */
  readonly depositTxHash: TransactionHash;

  /** Release/refund transaction (if completed) */
  readonly settlementTxHash?: TransactionHash;
}

/**
 * Service interface for escrow operations.
 */
export interface EscrowService {
  /**
   * Create a new escrow for a bounty.
   * Locks pUSD from funder until bounty is fulfilled or expires.
   */
  createEscrow(params: {
    bountyId: BountyId;
    funderAddress: PolkadotAddress;
    amount: PUSDAmount;
  }): Promise<Result<EscrowState, EscrowError>>;

  /**
   * Get escrow state.
   */
  getEscrow(escrowId: EscrowId): Promise<EscrowState | null>;

  /**
   * Release funds to bounty contributors.
   * Called when collective verifies bounty fulfillment.
   */
  releaseFunds(params: {
    escrowId: EscrowId;
    distributions: readonly {
      recipientAddress: PolkadotAddress;
      amount: PUSDAmount;
    }[];
  }): Promise<Result<TransactionHash, EscrowError>>;

  /**
   * Refund funds to funder.
   * Called when bounty expires unfulfilled or is cancelled.
   */
  refundFunds(escrowId: EscrowId): Promise<Result<TransactionHash, EscrowError>>;
}

/**
 * Escrow operation errors.
 */
export type EscrowError =
  | { type: 'INSUFFICIENT_BALANCE'; available: PUSDAmount; required: PUSDAmount }
  | { type: 'ESCROW_NOT_FOUND'; escrowId: EscrowId }
  | { type: 'ESCROW_ALREADY_SETTLED'; escrowId: EscrowId }
  | { type: 'INVALID_DISTRIBUTION'; reason: string }
  | { type: 'TRANSACTION_FAILED'; reason: string };
```

### Step 2.3: Create Payments Package

Create `/packages/payments/package.json`:

```json
{
  "name": "@cocuyo/payments",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@cocuyo/types": "workspace:*",
    "polkadot-api": "^1.23.1",
    "@polkadot-apps/signer": "^0.1.2"
  },
  "devDependencies": {
    "vitest": "^2.1.8"
  }
}
```

Create `/packages/payments/src/asset-hub-client.ts`:

```typescript
/**
 * Polkadot Asset Hub client for pUSD operations.
 */

import type { PolkadotAddress } from '@cocuyo/types';
import type { PUSDAmount, PUSDBalance } from '@cocuyo/types';
import { PUSD, createPUSDAmount } from '@cocuyo/types';

export interface AssetHubConfig {
  /** WebSocket endpoint */
  endpoint: string;
  /** pUSD asset ID on Asset Hub */
  assetId: number;
}

export const ASSET_HUB_ENDPOINTS = {
  polkadot: 'wss://polkadot-asset-hub-rpc.polkadot.io',
  kusama: 'wss://kusama-asset-hub-rpc.polkadot.io',
  westend: 'wss://westend-asset-hub-rpc.polkadot.io',
  paseo: 'wss://paseo-asset-hub-rpc.polkadot.io',
} as const;

/**
 * Create Asset Hub client for pUSD operations.
 */
export function createAssetHubClient(config: AssetHubConfig) {
  // TODO: Implement with polkadot-api
  // This is the interface - implementation depends on pUSD asset ID

  return {
    /**
     * Get pUSD balance for an address.
     */
    async getBalance(address: PolkadotAddress): Promise<PUSDBalance> {
      // TODO: Query Asset Hub pallet
      // Assets.account(assetId, address)
      throw new Error('Not implemented');
    },

    /**
     * Transfer pUSD between addresses.
     */
    async transfer(params: {
      from: PolkadotAddress;
      to: PolkadotAddress;
      amount: PUSDAmount;
    }): Promise<{ txHash: string }> {
      // TODO: Submit Assets.transfer extrinsic
      throw new Error('Not implemented');
    },

    /**
     * Watch for incoming transfers to an address.
     */
    watchTransfers(
      address: PolkadotAddress,
      callback: (transfer: { from: PolkadotAddress; amount: PUSDAmount; txHash: string }) => void
    ): () => void {
      // TODO: Subscribe to transfer events
      throw new Error('Not implemented');
    },
  };
}
```

### Step 2.4: Implement Escrow Logic

Create `/packages/payments/src/escrow.ts`:

```typescript
/**
 * Escrow implementation for bounty payments.
 *
 * Escrow can be implemented in two ways:
 * 1. Multi-sig account (simpler, current approach)
 * 2. Smart contract (more flexible, future)
 */

import type {
  EscrowService,
  EscrowState,
  EscrowError,
  BountyId,
  EscrowId,
  PolkadotAddress,
  PUSDAmount,
  TransactionHash,
} from '@cocuyo/types';
import type { Result } from '@cocuyo/types';
import { createAssetHubClient } from './asset-hub-client';

interface EscrowConfig {
  /** Asset Hub endpoint */
  endpoint: string;
  /** pUSD asset ID */
  assetId: number;
  /** Escrow treasury address (multi-sig) */
  treasuryAddress: PolkadotAddress;
}

/**
 * Create escrow service backed by multi-sig treasury.
 *
 * Flow:
 * 1. Funder transfers pUSD to treasury address with memo (bountyId)
 * 2. Service tracks escrow state in local storage
 * 3. On fulfillment, treasury multi-sig signs payout transactions
 * 4. On expiry, treasury multi-sig signs refund transaction
 */
export function createEscrowService(config: EscrowConfig): EscrowService {
  const assetHub = createAssetHubClient({
    endpoint: config.endpoint,
    assetId: config.assetId,
  });

  // In-memory storage (replace with persistent storage)
  const escrows = new Map<EscrowId, EscrowState>();

  return {
    async createEscrow({ bountyId, funderAddress, amount }) {
      // Generate escrow ID
      const escrowId = `escrow-${bountyId}-${Date.now()}` as EscrowId;

      // Check funder balance
      const balance = await assetHub.getBalance(funderAddress);
      if (balance.available < amount) {
        return {
          success: false,
          error: {
            type: 'INSUFFICIENT_BALANCE',
            available: balance.available,
            required: amount,
          },
        };
      }

      // Transfer to treasury (in production, this would be a multi-sig)
      const { txHash } = await assetHub.transfer({
        from: funderAddress,
        to: config.treasuryAddress,
        amount,
      });

      const escrow: EscrowState = {
        id: escrowId,
        bountyId,
        funderAddress,
        amount,
        status: 'active',
        depositTxHash: txHash as TransactionHash,
      };

      escrows.set(escrowId, escrow);

      return { success: true, data: escrow };
    },

    async getEscrow(escrowId) {
      return escrows.get(escrowId) ?? null;
    },

    async releaseFunds({ escrowId, distributions }) {
      const escrow = escrows.get(escrowId);
      if (!escrow) {
        return {
          success: false,
          error: { type: 'ESCROW_NOT_FOUND', escrowId },
        };
      }

      if (escrow.status !== 'active') {
        return {
          success: false,
          error: { type: 'ESCROW_ALREADY_SETTLED', escrowId },
        };
      }

      // Verify distribution amounts sum to escrow amount
      const totalDistribution = distributions.reduce((sum, d) => sum + d.amount, 0n);
      if (totalDistribution !== escrow.amount) {
        return {
          success: false,
          error: {
            type: 'INVALID_DISTRIBUTION',
            reason: `Distribution total ${totalDistribution} does not match escrow amount ${escrow.amount}`,
          },
        };
      }

      // Execute transfers (in production, batch transaction)
      // TODO: Implement batch transfer from treasury
      const txHash = `0x${Date.now().toString(16)}` as TransactionHash;

      escrows.set(escrowId, {
        ...escrow,
        status: 'released',
        settlementTxHash: txHash,
      });

      return { success: true, data: txHash };
    },

    async refundFunds(escrowId) {
      const escrow = escrows.get(escrowId);
      if (!escrow) {
        return {
          success: false,
          error: { type: 'ESCROW_NOT_FOUND', escrowId },
        };
      }

      if (escrow.status !== 'active') {
        return {
          success: false,
          error: { type: 'ESCROW_ALREADY_SETTLED', escrowId },
        };
      }

      // Transfer back to funder
      const { txHash } = await assetHub.transfer({
        from: config.treasuryAddress,
        to: escrow.funderAddress,
        amount: escrow.amount,
      });

      escrows.set(escrowId, {
        ...escrow,
        status: 'refunded',
        settlementTxHash: txHash as TransactionHash,
      });

      return { success: true, data: txHash as TransactionHash };
    },
  };
}
```

### Step 2.5: Update Bounty Service

Create `/packages/types/src/services.ts` additions:

```typescript
// Add to existing BountyService interface:

export interface BountyService {
  // ... existing methods ...

  /**
   * Create a bounty with pUSD funding.
   * Deposits funds into escrow.
   */
  createBounty(params: {
    bounty: NewBounty;
    funderAddress: PolkadotAddress;
  }): Promise<Result<BountyId, BountyError>>;

  /**
   * Fulfill a bounty and distribute payout.
   * Called after collective verification.
   */
  fulfillBounty(params: {
    bountyId: BountyId;
    contributingSignals: readonly SignalId[];
    distributions: readonly {
      signalId: SignalId;
      recipientAddress: PolkadotAddress;
      percentage: number;
    }[];
  }): Promise<Result<BountyPayout, BountyError>>;

  /**
   * Cancel a bounty and refund funder.
   */
  cancelBounty(bountyId: BountyId): Promise<Result<TransactionHash, BountyError>>;
}

export type BountyError =
  | { type: 'BOUNTY_NOT_FOUND' }
  | { type: 'ESCROW_FAILED'; escrowError: EscrowError }
  | { type: 'ALREADY_FULFILLED' }
  | { type: 'ALREADY_EXPIRED' };
```

---

## Phase 3: Treasury Infrastructure

**Goal:** Implement alliance treasury for crowdstacking contributions.

### Step 3.1: Create Treasury Types

Create `/packages/types/src/treasury.ts`:

```typescript
/**
 * Treasury types for the Cocuyo Alliance crowdstacking model.
 *
 * The treasury holds pooled capital from supporters, with investment
 * returns funding newsroom operations while preserving principal.
 */

import type { PolkadotAddress } from './brands';
import type { PUSDAmount, TransactionHash } from './currency';

/**
 * Treasury state snapshot.
 */
export interface TreasuryState {
  /** Total assets under management */
  readonly totalAssets: PUSDAmount;

  /** Available liquid balance (not deployed) */
  readonly liquidBalance: PUSDAmount;

  /** Amount deployed in yield strategies */
  readonly deployedBalance: PUSDAmount;

  /** Pending withdrawals */
  readonly pendingWithdrawals: PUSDAmount;

  /** Number of active contributors */
  readonly contributorCount: number;

  /** Last updated timestamp */
  readonly updatedAt: number;
}

/**
 * A contribution to the alliance treasury.
 */
export interface Contribution {
  /** Unique contribution ID */
  readonly id: string;

  /** Contributor's wallet address */
  readonly contributorAddress: PolkadotAddress;

  /** Contribution amount */
  readonly amount: PUSDAmount;

  /** Transaction hash */
  readonly txHash: TransactionHash;

  /** Whether this is a recurring contribution */
  readonly isRecurring: boolean;

  /** Timestamp */
  readonly createdAt: number;
}

/**
 * Treasury allocation to a member outlet.
 */
export interface TreasuryAllocation {
  /** Receiving outlet's treasury address */
  readonly recipientAddress: PolkadotAddress;

  /** Outlet name */
  readonly outletName: string;

  /** Allocated amount */
  readonly amount: PUSDAmount;

  /** Allocation period (e.g., "2026-Q1") */
  readonly period: string;

  /** Transaction hash */
  readonly txHash: TransactionHash;

  /** Timestamp */
  readonly allocatedAt: number;
}

/**
 * Treasury governance action.
 */
export interface TreasuryProposal {
  /** Proposal ID */
  readonly id: string;

  /** Type of action */
  readonly type: 'allocation' | 'strategy_change' | 'emergency_withdrawal';

  /** Human-readable description */
  readonly description: string;

  /** Proposed by */
  readonly proposer: PolkadotAddress;

  /** Required approvals (multi-sig threshold) */
  readonly requiredApprovals: number;

  /** Current approvals */
  readonly approvals: readonly PolkadotAddress[];

  /** Status */
  readonly status: 'pending' | 'approved' | 'rejected' | 'executed';

  /** Timestamps */
  readonly createdAt: number;
  readonly expiresAt: number;
}

/**
 * Treasury service interface.
 */
export interface TreasuryService {
  /** Get current treasury state */
  getState(): Promise<TreasuryState>;

  /** Record a contribution */
  recordContribution(params: {
    contributorAddress: PolkadotAddress;
    amount: PUSDAmount;
    txHash: TransactionHash;
    isRecurring: boolean;
  }): Promise<Contribution>;

  /** Get contribution history */
  getContributions(params: {
    contributorAddress?: PolkadotAddress;
    limit?: number;
    offset?: number;
  }): Promise<readonly Contribution[]>;

  /** Get allocations to outlets */
  getAllocations(params: {
    period?: string;
    outletAddress?: PolkadotAddress;
  }): Promise<readonly TreasuryAllocation[]>;

  /** Submit a governance proposal */
  submitProposal(
    proposal: Omit<TreasuryProposal, 'id' | 'approvals' | 'status' | 'createdAt'>
  ): Promise<TreasuryProposal>;

  /** Approve a proposal */
  approveProposal(proposalId: string, approver: PolkadotAddress): Promise<TreasuryProposal>;
}
```

### Step 3.2: Create Treasury Multi-Sig Setup

Create `/packages/treasury/src/multi-sig.ts`:

```typescript
/**
 * Multi-sig treasury management.
 *
 * The alliance treasury is controlled by a multi-sig account
 * requiring N-of-M signatures for operations.
 */

import type { PolkadotAddress } from '@cocuyo/types';

export interface MultiSigConfig {
  /** Required number of signatures */
  threshold: number;

  /** Authorized signers */
  signers: readonly PolkadotAddress[];

  /** Treasury account address (derived from signers) */
  treasuryAddress: PolkadotAddress;
}

/**
 * Multi-sig proposal for treasury operations.
 */
export interface MultiSigProposal {
  /** Unique call hash */
  callHash: string;

  /** Encoded call data */
  callData: Uint8Array;

  /** When the proposal was created */
  when: {
    height: number;
    index: number;
  };

  /** Deposit paid by proposer */
  deposit: bigint;

  /** Current approvals */
  approvals: readonly PolkadotAddress[];
}

/**
 * Create multi-sig treasury configuration.
 *
 * Uses Polkadot's native multisig pallet for security.
 */
export function createMultiSigConfig(params: {
  signers: readonly PolkadotAddress[];
  threshold: number;
}): MultiSigConfig {
  // Validate threshold
  if (params.threshold < 1) {
    throw new Error('Threshold must be at least 1');
  }
  if (params.threshold > params.signers.length) {
    throw new Error('Threshold cannot exceed number of signers');
  }

  // Sort signers (required for deterministic address derivation)
  const sortedSigners = [...params.signers].sort();

  // TODO: Derive multi-sig address using @polkadot/util-crypto
  const treasuryAddress = 'TREASURY_ADDRESS' as PolkadotAddress;

  return {
    threshold: params.threshold,
    signers: sortedSigners,
    treasuryAddress,
  };
}

/**
 * Create a multi-sig treasury client.
 */
export function createMultiSigClient(config: MultiSigConfig) {
  return {
    /**
     * Propose a treasury operation.
     */
    async propose(params: {
      callData: Uint8Array;
      proposer: PolkadotAddress;
    }): Promise<MultiSigProposal> {
      // TODO: Submit multisig.asMulti extrinsic
      throw new Error('Not implemented');
    },

    /**
     * Approve a pending proposal.
     */
    async approve(params: {
      callHash: string;
      approver: PolkadotAddress;
    }): Promise<MultiSigProposal> {
      // TODO: Submit multisig.approveAsMulti extrinsic
      throw new Error('Not implemented');
    },

    /**
     * Get pending proposals.
     */
    async getPendingProposals(): Promise<readonly MultiSigProposal[]> {
      // TODO: Query multisig.multisigs storage
      throw new Error('Not implemented');
    },
  };
}
```

### Step 3.3: Create Contribution Flow

Create `/packages/treasury/src/contributions.ts`:

```typescript
/**
 * Contribution handling for crowdstacking.
 *
 * Supporters contribute pUSD to the alliance treasury.
 * Contributions are tracked on-chain and in our indexer.
 */

import type { PolkadotAddress, PUSDAmount, TransactionHash } from '@cocuyo/types';
import type { Contribution, TreasuryService } from '@cocuyo/types';
import { createAssetHubClient } from '@cocuyo/payments';

interface ContributionFlowConfig {
  /** Asset Hub endpoint */
  endpoint: string;
  /** pUSD asset ID */
  assetId: number;
  /** Treasury address */
  treasuryAddress: PolkadotAddress;
}

/**
 * Create contribution handler.
 *
 * Flow:
 * 1. Supporter initiates contribution via wallet
 * 2. pUSD transferred to treasury address
 * 3. Transfer event indexed and recorded
 * 4. Contribution confirmed to supporter
 */
export function createContributionHandler(config: ContributionFlowConfig) {
  const assetHub = createAssetHubClient({
    endpoint: config.endpoint,
    assetId: config.assetId,
  });

  return {
    /**
     * Generate contribution transaction params.
     * Returns data for wallet to sign.
     */
    prepareContribution(params: { contributorAddress: PolkadotAddress; amount: PUSDAmount }) {
      return {
        to: config.treasuryAddress,
        amount: params.amount,
        // Memo could include contributor metadata
        memo: `contribution:${params.contributorAddress}`,
      };
    },

    /**
     * Watch for contributions to treasury.
     * Called by indexer to record incoming contributions.
     */
    watchContributions(
      onContribution: (contribution: Omit<Contribution, 'id'>) => void
    ): () => void {
      return assetHub.watchTransfers(config.treasuryAddress, (transfer) => {
        onContribution({
          contributorAddress: transfer.from,
          amount: transfer.amount,
          txHash: transfer.txHash as TransactionHash,
          isRecurring: false, // Determined by off-chain logic
          createdAt: Date.now(),
        });
      });
    },
  };
}
```

---

## Phase 4: Contributor Payments

**Goal:** Enable outlets to pay journalists in pUSD.

### Step 4.1: Create Payment Types

Create `/packages/types/src/payment.ts`:

```typescript
/**
 * Payment types for journalist compensation.
 */

import type { PolkadotAddress } from './brands';
import type { PUSDAmount, TransactionHash } from './currency';

/**
 * A payment to a contributor (journalist, source, etc.).
 */
export interface Payment {
  /** Unique payment ID */
  readonly id: string;

  /** Paying outlet's address */
  readonly fromAddress: PolkadotAddress;

  /** Recipient's address */
  readonly toAddress: PolkadotAddress;

  /** Payment amount */
  readonly amount: PUSDAmount;

  /** Payment type */
  readonly type: PaymentType;

  /** Optional reference (e.g., article ID) */
  readonly reference?: string;

  /** Optional memo */
  readonly memo?: string;

  /** Transaction hash */
  readonly txHash: TransactionHash;

  /** Status */
  readonly status: 'pending' | 'confirmed' | 'failed';

  /** Timestamp */
  readonly createdAt: number;
}

export type PaymentType =
  | 'salary' // Regular payroll
  | 'stipend' // Recurring support
  | 'per_piece' // Payment per article/investigation
  | 'bounty_payout' // Bounty fulfillment
  | 'expense' // Expense reimbursement
  | 'grant'; // Grant distribution

/**
 * Batch payment for payroll.
 */
export interface BatchPayment {
  /** Batch ID */
  readonly id: string;

  /** Paying entity */
  readonly fromAddress: PolkadotAddress;

  /** Individual payments in batch */
  readonly payments: readonly Omit<Payment, 'id' | 'txHash' | 'status' | 'createdAt'>[];

  /** Total amount */
  readonly totalAmount: PUSDAmount;

  /** Batch transaction hash */
  readonly txHash: TransactionHash;

  /** Status */
  readonly status: 'pending' | 'confirmed' | 'partial' | 'failed';

  /** Timestamp */
  readonly createdAt: number;
}

/**
 * Payment service interface.
 */
export interface PaymentService {
  /** Send a single payment */
  sendPayment(params: {
    fromAddress: PolkadotAddress;
    toAddress: PolkadotAddress;
    amount: PUSDAmount;
    type: PaymentType;
    reference?: string;
    memo?: string;
  }): Promise<Payment>;

  /** Send batch payment (payroll) */
  sendBatchPayment(params: {
    fromAddress: PolkadotAddress;
    payments: readonly {
      toAddress: PolkadotAddress;
      amount: PUSDAmount;
      type: PaymentType;
      reference?: string;
    }[];
  }): Promise<BatchPayment>;

  /** Get payment history */
  getPayments(params: {
    address: PolkadotAddress;
    direction?: 'sent' | 'received' | 'both';
    type?: PaymentType;
    limit?: number;
    offset?: number;
  }): Promise<readonly Payment[]>;

  /** Get payment by ID */
  getPayment(id: string): Promise<Payment | null>;
}
```

### Step 4.2: Create Payment Service Implementation

Create `/packages/payments/src/payment-service.ts`:

```typescript
/**
 * Payment service implementation.
 */

import type {
  Payment,
  BatchPayment,
  PaymentService,
  PaymentType,
  PolkadotAddress,
  PUSDAmount,
  TransactionHash,
} from '@cocuyo/types';
import { createAssetHubClient } from './asset-hub-client';

interface PaymentServiceConfig {
  endpoint: string;
  assetId: number;
}

export function createPaymentService(config: PaymentServiceConfig): PaymentService {
  const assetHub = createAssetHubClient({
    endpoint: config.endpoint,
    assetId: config.assetId,
  });

  // In-memory storage (replace with persistent storage)
  const payments = new Map<string, Payment>();

  return {
    async sendPayment(params) {
      const id = `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const { txHash } = await assetHub.transfer({
        from: params.fromAddress,
        to: params.toAddress,
        amount: params.amount,
      });

      const payment: Payment = {
        id,
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        amount: params.amount,
        type: params.type,
        reference: params.reference,
        memo: params.memo,
        txHash: txHash as TransactionHash,
        status: 'confirmed', // Simplified; real impl would wait for finalization
        createdAt: Date.now(),
      };

      payments.set(id, payment);
      return payment;
    },

    async sendBatchPayment(params) {
      // TODO: Use batch transaction for efficiency
      // For now, sequential transfers
      const completedPayments: Payment[] = [];
      let totalSent = 0n;

      for (const p of params.payments) {
        const payment = await this.sendPayment({
          fromAddress: params.fromAddress,
          toAddress: p.toAddress,
          amount: p.amount,
          type: p.type,
          reference: p.reference,
        });
        completedPayments.push(payment);
        totalSent += p.amount;
      }

      const batch: BatchPayment = {
        id: `batch-${Date.now()}`,
        fromAddress: params.fromAddress,
        payments: params.payments,
        totalAmount: totalSent as PUSDAmount,
        txHash: completedPayments[0]?.txHash ?? ('' as TransactionHash),
        status: 'confirmed',
        createdAt: Date.now(),
      };

      return batch;
    },

    async getPayments(params) {
      const results: Payment[] = [];
      for (const payment of payments.values()) {
        const matchesAddress =
          params.direction === 'sent'
            ? payment.fromAddress === params.address
            : params.direction === 'received'
              ? payment.toAddress === params.address
              : payment.fromAddress === params.address || payment.toAddress === params.address;

        const matchesType = !params.type || payment.type === params.type;

        if (matchesAddress && matchesType) {
          results.push(payment);
        }
      }

      return results
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 50));
    },

    async getPayment(id) {
      return payments.get(id) ?? null;
    },
  };
}
```

---

## Phase 5: Membership & Premium

**Goal:** Implement pUSD-based membership tiers.

### Step 5.1: Create Membership Types

Create `/packages/types/src/membership.ts`:

```typescript
/**
 * Membership types for the Firefly Network.
 *
 * Members pay pUSD for premium features and governance rights.
 */

import type { DIMCredential, PolkadotAddress } from './brands';
import type { PUSDAmount, TransactionHash } from './currency';

/**
 * Membership tier.
 */
export type MembershipTier =
  | 'free' // Basic access, no pUSD required
  | 'supporter' // $5/month - early access, badge
  | 'patron' // $25/month - voting rights, private channels
  | 'guardian'; // $100/month - governance, direct bounty creation

/**
 * Membership tier configuration.
 */
export const MEMBERSHIP_TIERS: Record<
  MembershipTier,
  {
    name: string;
    monthlyFee: PUSDAmount;
    features: readonly string[];
  }
> = {
  free: {
    name: 'Observer',
    monthlyFee: 0n as PUSDAmount,
    features: ['Read all public signals', 'Basic corroboration'],
  },
  supporter: {
    name: 'Supporter',
    monthlyFee: 5_000_000n as PUSDAmount, // 5 pUSD
    features: [
      'All Observer features',
      'Early access to investigations',
      'Verified Supporter badge',
      'Priority notification queue',
    ],
  },
  patron: {
    name: 'Patron',
    monthlyFee: 25_000_000n as PUSDAmount, // 25 pUSD
    features: [
      'All Supporter features',
      'Vote on bounty priorities',
      'Access to patron-only channels',
      'Direct messaging to outlets',
    ],
  },
  guardian: {
    name: 'Guardian',
    monthlyFee: 100_000_000n as PUSDAmount, // 100 pUSD
    features: [
      'All Patron features',
      'Create information bounties directly',
      'Alliance governance voting',
      'Quarterly briefings with editors',
    ],
  },
};

/**
 * A membership subscription.
 */
export interface Membership {
  /** Member's DIM credential */
  readonly credential: DIMCredential;

  /** Member's wallet address */
  readonly walletAddress: PolkadotAddress;

  /** Current tier */
  readonly tier: MembershipTier;

  /** Subscription status */
  readonly status: 'active' | 'expired' | 'cancelled';

  /** Current period start */
  readonly periodStart: number;

  /** Current period end */
  readonly periodEnd: number;

  /** Last payment transaction */
  readonly lastPaymentTxHash?: TransactionHash;

  /** When membership was created */
  readonly createdAt: number;
}

/**
 * Membership service interface.
 */
export interface MembershipService {
  /** Get membership for a credential */
  getMembership(credential: DIMCredential): Promise<Membership | null>;

  /** Subscribe to a tier */
  subscribe(params: {
    credential: DIMCredential;
    walletAddress: PolkadotAddress;
    tier: MembershipTier;
  }): Promise<Membership>;

  /** Upgrade/downgrade tier */
  changeTier(params: { credential: DIMCredential; newTier: MembershipTier }): Promise<Membership>;

  /** Cancel subscription */
  cancel(credential: DIMCredential): Promise<Membership>;

  /** Process recurring payments (called by scheduler) */
  processRenewals(): Promise<
    readonly {
      credential: DIMCredential;
      success: boolean;
      error?: string;
    }[]
  >;
}
```

---

## Volume Projections

### Year 1 (Conservative)

| Use Case               | Monthly Volume                    | Annual Volume |
| ---------------------- | --------------------------------- | ------------- |
| Bounty Creation        | 50-100 bounties × $200 avg        | $120K-240K    |
| Bounty Payouts         | 80% fulfillment rate              | $96K-192K     |
| Treasury Contributions | 5,000 contributors × $20          | $1.2M         |
| Journalist Payments    | 5 outlets × 10 journalists × $400 | $240K         |
| Membership Fees        | 2,000 paid members × $15 avg      | $360K         |
| **Total pUSD Volume**  |                                   | **$2M-2.2M**  |

### Year 3 (Growth)

| Use Case               | Monthly Volume                     | Annual Volume |
| ---------------------- | ---------------------------------- | ------------- |
| Bounty Creation        | 500-1000 bounties × $300 avg       | $1.8M-3.6M    |
| Bounty Payouts         | 80% fulfillment rate               | $1.4M-2.9M    |
| Treasury Contributions | 50,000 contributors × $25          | $15M          |
| Journalist Payments    | 50 outlets × 15 journalists × $600 | $5.4M         |
| Membership Fees        | 20,000 paid members × $20 avg      | $4.8M         |
| Alliance Settlements   | 100 outlets × $5K/month            | $6M           |
| **Total pUSD Volume**  |                                    | **$35M-38M**  |

### Key Metrics to Track

```typescript
interface PUSDMetrics {
  // Volume metrics
  totalVolumeAllTime: PUSDAmount;
  volumeLast30Days: PUSDAmount;
  volumeLast7Days: PUSDAmount;

  // User metrics
  uniqueWalletsHoldingPUSD: number;
  averageBalancePerWallet: PUSDAmount;
  newWalletsLast30Days: number;

  // Use case breakdown
  bountyVolume: PUSDAmount;
  treasuryContributions: PUSDAmount;
  journalistPayments: PUSDAmount;
  membershipFees: PUSDAmount;
  allianceSettlements: PUSDAmount;
}
```

---

## On/Off Ramp Strategy

### Current State (No Ramps)

Without on/off ramps, early adoption will be limited to:

- Crypto-native diaspora members
- NGOs/foundations comfortable with crypto
- Journalists already using crypto for security

### Phase 1: Crypto-Native Onboarding

```
Fiat → CEX (Kraken, Coinbase) → DOT → Asset Hub → Swap to pUSD
```

- Documentation for this path
- Video tutorials in Spanish
- Support channel for onboarding

### Phase 2: Partner Integrations (When Available)

```
┌─────────────────────────────────────────────────────────────────┐
│                    ON-RAMP PARTNERS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   LATAM-FOCUSED                    GLOBAL                        │
│                                                                  │
│   - Mercado Pago integration       - MoonPay                     │
│   - Local bank transfers           - Transak                     │
│   - Remittance corridors           - Ramp Network                │
│     (USA→VEN, USA→COL)                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    OFF-RAMP PARTNERS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   - Local P2P networks             - Crypto ATMs                 │
│   - Merchant acceptance            - Prepaid crypto cards        │
│     (pUSD → goods directly)        - Bank withdrawal partners    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 3: Direct Integration

When ramps are available:

- Embed ramp widgets in Firefly Network app
- One-click contribution from bank account
- Automatic conversion to pUSD on deposit

### Interim Solutions

1. **Stable Holdings for Outlets**
   - Outlets receive pUSD
   - Hold stable value until ramps available
   - Better than depreciating local currency

2. **P2P Networks**
   - Local crypto communities in Venezuela, Colombia
   - Telegram groups for pUSD ↔ local currency
   - Trust-based trading among journalists

3. **Partial Compensation**
   - Pay portion in pUSD (savings)
   - Pay portion through traditional rails (immediate expenses)
   - Gradually increase pUSD percentage

---

## Summary

This integration plan positions pUSD as the **native currency of independent journalism** in the Polkadot ecosystem. By starting with bounties and expanding to treasury, payments, and membership, we create multiple reinforcing use cases that drive sustainable pUSD demand.

The key insight: **journalists need stable, censorship-resistant money more than almost anyone**. pUSD solves a real, urgent problem for a community that cannot rely on traditional finance.

When on/off ramps arrive, the infrastructure will be ready. Until then, early adopters among the diaspora and crypto-native supporters can begin building the treasury and funding the first bounties.

---

## Related Documents

- [ADR-001: pUSD Integration](/docs/ADR/001-pusd-integration.md)
- [Firefly Network Concept](/docs/firefly-network-concept.md)
- [Architecture Overview](/docs/ARCHITECTURE.md)
