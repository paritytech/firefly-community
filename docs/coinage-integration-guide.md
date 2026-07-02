# Coinage Integration Guide

> [!WARNING]
> **Experimental concept/design document.** This code is developed and published by Parity as a prototype and proof-of-concept — it is **not** a Parity product or an operated service, and Parity does not run or take responsibility for any deployment. The design here is experimental and unaudited; all figures, timelines, and named systems are **illustrative only**.

> Private payments for the Firefly Network using Polkadot's Coinage system

> **Status: simulated.** The Coinage payment paths described here are **not live**. The
> `CoinPaymentService` ships a mock implementation that is used by default; no real Coinage
> transaction is submitted. The only fully real on-chain payment today is the **native PAS
> transfer**. Treat this document as the integration design/plan, not shipped behavior.

## Table of Contents

1. [Overview](#overview)
2. [Why Coinage Matters for Journalism](#why-coinage-matters-for-journalism)
3. [How Coinage Works](#how-coinage-works)
4. [Integration Architecture](#integration-architecture)
5. [Payment Flow Patterns](#payment-flow-patterns)
6. [Implementation Guide](#implementation-guide)
7. [Privacy Considerations](#privacy-considerations)

---

## Overview

Coinage is Polkadot's native private payment system that enables anonymous transactions denominated in pUSD. It complements the public pUSD integration (see [pUSD Integration Guide](/docs/pusd-integration-guide.md)) by adding a **privacy layer** for sensitive payments.

### The Two-Layer Payment Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    FIREFLY PAYMENT SYSTEM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│   │     PUBLIC LAYER        │  │      PRIVATE LAYER          │  │
│   │       (pUSD)            │  │       (Coinage)             │  │
│   ├─────────────────────────┤  ├─────────────────────────────┤  │
│   │                         │  │                             │  │
│   │  • Treasury holdings    │  │  • Bounty payouts           │  │
│   │  • Membership fees      │  │  • Journalist salaries      │  │
│   │  • Governance votes     │  │  • Diaspora contributions   │  │
│   │  • Off-ramp to fiat     │  │  • Source payments          │  │
│   │  • Compliance flows     │  │  • Anonymous tips           │  │
│   │                         │  │                             │  │
│   │  Transparent            │  │  Anonymous                  │  │
│   │  Auditable              │  │  Untraceable                │  │
│   │                         │  │                             │  │
│   └─────────────────────────┘  └─────────────────────────────┘  │
│                                                                  │
│                    ↕ Seamless Conversion ↕                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Properties

| Property         | Public pUSD | Private Coinage               |
| ---------------- | ----------- | ----------------------------- |
| Balances         | Visible     | Hidden                        |
| Transfers        | Traceable   | Anonymous                     |
| Sender/Receiver  | Known       | Unknown                       |
| Transaction Fees | Standard    | Free for verified humans      |
| Denomination     | Any amount  | Powers of 2 ($0.01 - $163.84) |
| Compliance       | Easy        | Requires design               |

---

## Why Coinage Matters for Journalism

### The Surveillance Threat Model

Journalists in hostile environments face multiple adversaries:

```
┌─────────────────────────────────────────────────────────────────┐
│                    THREAT ACTORS                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   STATE ACTORS                    NON-STATE ACTORS              │
│   ────────────                    ────────────────              │
│   • Government surveillance       • Criminal organizations      │
│   • Tax authorities               • Corporate adversaries       │
│   • Intelligence agencies         • Politically-aligned hackers │
│   • Sanctions enforcement         • Doxxing campaigns           │
│                                                                  │
│   WHAT THEY CAN DO WITH PUBLIC BLOCKCHAIN DATA:                 │
│   ──────────────────────────────────────────────                │
│   • Identify who funds independent media                        │
│   • Target journalists receiving payments                       │
│   • Trace diaspora contributions to family members              │
│   • Build network graphs of the journalism ecosystem            │
│   • Freeze or seize funds at off-ramp points                    │
│   • Prosecute for "foreign funding" violations                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Real-World Scenarios

**Scenario 1: Bounty Payout**

```
WITHOUT COINAGE:
  Bounty escrow (public) → Journalist wallet (public)

  Risk: Government sees journalist received $500 for
        documenting corruption at state-owned company.
        Journalist arrested for "foreign interference."

WITH COINAGE:
  Bounty escrow → Recycler → Private coins → Journalist

  Protection: No on-chain link between bounty and journalist.
              Government cannot prove journalist received funds.
```

**Scenario 2: Diaspora Contribution**

```
WITHOUT COINAGE:
  Diaspora wallet (USA) → Treasury (public)

  Risk: Venezuelan government sees María in Miami
        contributed to Efecto Cocuyo. María's parents
        in Caracas harassed by authorities.

WITH COINAGE:
  María → Recycler → Private coins → Treasury contribution

  Protection: No link between María's wallet and contribution.
              Family in Venezuela remains safe.
```

**Scenario 3: Source Payment**

```
WITHOUT COINAGE:
  Outlet wallet → Source wallet (public)

  Risk: Source's identity exposed on-chain.
        Source faces retaliation or prosecution.

WITH COINAGE:
  Outlet → Off-chain key sharing → Source pulls coins

  Protection: No on-chain transaction between outlet and source.
              Only the source knows they received payment.
```

---

## How Coinage Works

### Core Concepts

#### 1. Private Coins

Coins are held in single-use public keys derived from the user's mnemonic:

```
User Mnemonic
    │
    ├── //coin-0  →  $4.00 coin (age: 2)
    ├── //coin-1  →  $2.00 coin (age: 0)
    ├── //coin-2  →  $1.00 coin (age: 3)
    ├── //coin-3  →  (spent - empty)
    ├── //coin-4  →  $0.50 coin (age: 1)
    └── ...

Each public key holds exactly one coin.
Keys are never reused after spending.
```

#### 2. Coin Denominations

Values follow powers of 2 for efficient splitting:

```
Exponent  Value
   0      $0.01
   1      $0.02
   2      $0.04
   3      $0.08
   4      $0.16
   5      $0.32
   6      $0.64
   7      $1.28
   8      $2.56
   9      $5.12
  10      $10.24
  11      $20.48
  12      $40.96
  13      $81.92
  14      $163.84
```

#### 3. Coin Age

Each coin has an "age" that increments with each transfer:

```
Age 0: Fresh coin (just minted or recycled)
Age 1-N: Has been transferred N times
Age > A1: Can be recycled
Age > A2: Must be recycled (cannot transfer)
```

#### 4. The Recycler

The recycler is the anonymization mechanism:

```
┌─────────────────────────────────────────────────────────────────┐
│                    RECYCLER FLOW                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   LOADING (many users)              UNLOADING (later)            │
│                                                                  │
│   Alice's $4 coin ──┐                                            │
│   Bob's $4 coin ────┼──▶ Recycler Ring ──▶ New $4 coin (age 0)  │
│   Carol's $4 coin ──┤    (for $4 value)    (to any address)     │
│   Dave's $4 coin ───┘                                            │
│                                                                  │
│   When Alice unloads, observers only know:                       │
│   "One of {Alice, Bob, Carol, Dave} minted a new coin"          │
│                                                                  │
│   The larger the ring, the stronger the privacy.                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 5. Transfers (Pull Mechanic)

Transfers happen in two steps:

```
Step 1: OFF-CHAIN
  Alice sends private key of coin to Bob via encrypted chat

Step 2: ON-CHAIN
  Bob derives new key (bob//coin-X)
  Bob calls transfer(alice_coin_key, bob_new_key)
  Coin ownership changes, age increments
```

This "pull" mechanic means:

- Receiver doesn't need to be online when sender initiates
- Receiver can refuse payment (just don't pull)
- Sender can cancel by transferring to self if receiver doesn't claim

### Free Usage for Verified Humans

Coinage leverages DIM (proof-of-personhood) for free transactions:

```
┌─────────────────────────────────────────────────────────────────┐
│                    FREE USAGE TIERS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   PEOPLE (Full DIM Credential)                                   │
│   • N free recycler claim tokens per period T                    │
│   • Higher allocation than Lite People                           │
│   • Can participate in governance                                │
│                                                                  │
│   LITE PEOPLE (Lite DIM Credential)                              │
│   • N free recycler claim tokens per period T                    │
│   • Lower allocation than full People                            │
│   • Sufficient for normal daily usage                            │
│                                                                  │
│   NON-VERIFIED USERS                                             │
│   • Must pay for recycler claim tokens                           │
│   • Can pay with pUSD, DOT, or coins                             │
│   • Limited to 20% of system usage (Sybil resistance)            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Alignment with Firefly Network:**

- Fireflies are already verified via DIM
- Free Coinage usage is automatic for verified fireflies
- Non-verified users can still participate (paid tier)

---

## Integration Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    FIREFLY + COINAGE STACK                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Web App (Next.js)                        ││
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────────┐   ││
│  │  │  Bounty   │  │  Payment  │  │  Wallet Dashboard     │   ││
│  │  │    UI     │  │    UI     │  │  (Public + Private)   │   ││
│  │  └─────┬─────┘  └─────┬─────┘  └───────────┬───────────┘   ││
│  └────────┼──────────────┼────────────────────┼────────────────┘│
│           │              │                    │                 │
│  ┌────────▼──────────────▼────────────────────▼────────────────┐│
│  │                    Services Layer                           ││
│  │  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐ ││
│  │  │ PaymentRouter │  │ CoinageClient │  │  AssetHubClient │ ││
│  │  │ (mode select) │  │ (private ops) │  │  (public ops)   │ ││
│  │  └───────┬───────┘  └───────┬───────┘  └────────┬────────┘ ││
│  └──────────┼──────────────────┼───────────────────┼───────────┘│
│             │                  │                   │            │
│  ┌──────────▼──────────────────▼───────────────────▼───────────┐│
│  │                    Polkadot Ecosystem                       ││
│  │                                                             ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ ││
│  │  │ People Chain│  │ Asset Hub   │  │  Bulletin Chain     │ ││
│  │  │ (Coinage)   │  │ (pUSD)      │  │  (Content)          │ ││
│  │  │             │  │             │  │                     │ ││
│  │  │ • Coins     │  │ • Balances  │  │  • Signals          │ ││
│  │  │ • Recyclers │  │ • Transfers │  │  • Verifications    │ ││
│  │  │ • Rings     │  │ • Escrow    │  │  • Chains           │ ││
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘ ││
│  │                                                             ││
│  │                         XCM                                 ││
│  │              (Cross-chain messaging)                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Package Structure

```
packages/
├── types/
│   └── src/
│       ├── currency.ts      # pUSD definitions (existing)
│       ├── coinage.ts       # NEW: Coinage types
│       └── payment-mode.ts  # NEW: Payment routing types
│
├── coinage/                 # NEW PACKAGE
│   └── src/
│       ├── client.ts        # Coinage operations
│       ├── coin.ts          # Coin management
│       ├── recycler.ts      # Recycler operations
│       ├── transfer.ts      # Private transfers
│       └── derivation.ts    # Key derivation helpers
│
└── payments/
    └── src/
        ├── asset-hub.ts     # Public pUSD (existing)
        ├── coinage.ts       # NEW: Private payments
        └── router.ts        # NEW: Mode selection
```

---

## Payment Flow Patterns

### Pattern 1: Private Bounty Payout

```
┌─────────────────────────────────────────────────────────────────┐
│              PRIVATE BOUNTY PAYOUT FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. BOUNTY CREATION (Public)                                     │
│     Funder → pUSD to Bounty Escrow (visible)                     │
│                                                                  │
│  2. BOUNTY FULFILLMENT (Verified)                                │
│     Collective verifies signal addresses bounty                  │
│                                                                  │
│  3. PAYOUT INITIATION (Transition to Private)                    │
│     Escrow → pUSD to Recycler                                    │
│     Escrow receives vouchers for journalist's amount             │
│                                                                  │
│  4. VOUCHER TRANSFER (Off-chain)                                 │
│     Escrow shares voucher secrets with journalist via chat       │
│     (Uses existing Firefly chat infrastructure)                  │
│                                                                  │
│  5. COIN CLAIM (Private)                                         │
│     Journalist uses vouchers to mint private coins               │
│     Uses free recycler claim token (DIM-verified)                │
│                                                                  │
│  6. JOURNALIST HOLDS PRIVATE COINS                               │
│     Balance invisible on-chain                                   │
│     Can spend, hold, or off-ramp later                           │
│                                                                  │
│  PRIVACY ACHIEVED:                                               │
│  • Bounty creation is public (funder's choice)                   │
│  • Payout recipient is anonymous                                 │
│  • No on-chain link between bounty and journalist                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Pattern 2: Private Journalist Salary

```
┌─────────────────────────────────────────────────────────────────┐
│              PRIVATE SALARY PAYMENT FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. OUTLET PREPARES PAYROLL                                      │
│     Outlet converts pUSD → private coins (via recycler)          │
│     Waits for ring to fill (privacy)                             │
│                                                                  │
│  2. SALARY CALCULATION                                           │
│     $800 salary = $512 + $256 + $32 coins                        │
│     (Powers of 2 decomposition)                                  │
│                                                                  │
│  3. TRANSFER INITIATION (Off-chain)                              │
│     Outlet shares private keys for salary coins via chat         │
│     Journalist receives encrypted message                        │
│                                                                  │
│  4. JOURNALIST CLAIMS (On-chain, anonymous)                      │
│     Journalist pulls coins to fresh addresses                    │
│     Transfer is free (DIM-verified)                              │
│                                                                  │
│  5. MONTHLY RECYCLING                                            │
│     Journalist periodically recycles old coins                   │
│     Resets age, consolidates denominations                       │
│                                                                  │
│  PRIVACY ACHIEVED:                                               │
│  • No on-chain link between outlet and journalist                │
│  • Salary amount not visible                                     │
│  • Payment timing obscured by recycler                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Pattern 3: Anonymous Diaspora Contribution

```
┌─────────────────────────────────────────────────────────────────┐
│              ANONYMOUS CONTRIBUTION FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CONTRIBUTOR ONBOARDS (Public → Private)                      │
│     María in Miami: pUSD → Recycler                              │
│     Waits for ring to fill                                       │
│                                                                  │
│  2. CONTRIBUTOR MINTS COINS (Private)                            │
│     María claims private coins from recycler                     │
│     Uses free claim token (DIM Lite People)                      │
│                                                                  │
│  3. CONTRIBUTION (Private → Alliance)                            │
│     María transfers coins to Alliance contribution address       │
│     Off-chain: shares keys via Firefly app                       │
│     On-chain: Alliance pulls coins (anonymous transfer)          │
│                                                                  │
│  4. ALLIANCE PROCESSES (Private → Treasury)                      │
│     Alliance recycles received coins                             │
│     Consolidates into treasury holdings                          │
│     Can off-ramp to public pUSD for operations                   │
│                                                                  │
│  PRIVACY ACHIEVED:                                               │
│  • María's identity not linked to contribution                   │
│  • Venezuelan government cannot trace funds                      │
│  • María's family in Caracas remains safe                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Guide

### Step 1: Add Coinage Types

Create `/packages/types/src/coinage.ts`:

```typescript
/**
 * Coinage types for private payments.
 *
 * Coinage is Polkadot's native private payment system,
 * enabling anonymous transactions denominated in pUSD.
 */

import type { DIMCredential, PolkadotAddress } from './brands';

/**
 * Coin denomination exponent (0-14).
 * Actual value = $0.01 * 2^exponent
 */
export type CoinExponent = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

/**
 * Coin denomination values in cents.
 */
export const COIN_VALUES: Record<CoinExponent, number> = {
  0: 1, // $0.01
  1: 2, // $0.02
  2: 4, // $0.04
  3: 8, // $0.08
  4: 16, // $0.16
  5: 32, // $0.32
  6: 64, // $0.64
  7: 128, // $1.28
  8: 256, // $2.56
  9: 512, // $5.12
  10: 1024, // $10.24
  11: 2048, // $20.48
  12: 4096, // $40.96
  13: 8192, // $81.92
  14: 16384, // $163.84
};

/**
 * A private coin.
 */
export interface Coin {
  /** Denomination exponent (value = $0.01 * 2^exponent) */
  readonly exponent: CoinExponent;
  /** Transfer count (age) */
  readonly age: number;
  /** Public key holding this coin */
  readonly owner: CoinPublicKey;
  /** Derivation index in user's keychain */
  readonly derivationIndex: number;
}

/**
 * Branded type for coin public keys.
 * These are single-use keys, never reused.
 */
export type CoinPublicKey = string & { readonly __brand: 'CoinPublicKey' };

/**
 * Recycler voucher for claiming coins.
 */
export interface RecyclerVoucher {
  /** Recycler value exponent */
  readonly recyclerExponent: CoinExponent;
  /** Ring index */
  readonly ringIndex: number;
  /** Alias in the ring (proof of membership) */
  readonly alias: Uint8Array;
}

/**
 * Recycler claim token types.
 */
export type RecyclerClaimToken =
  | { type: 'free_person'; ringIndex: number; counter: number; period: number; proof: Uint8Array }
  | {
      type: 'free_lite_person';
      ringIndex: number;
      counter: number;
      period: number;
      proof: Uint8Array;
    }
  | { type: 'paid'; paidRingIndex: number; proof: Uint8Array };

/**
 * User's private coin wallet state.
 */
export interface CoinWallet {
  /** Total balance in cents */
  readonly totalBalance: number;
  /** Individual coins */
  readonly coins: readonly Coin[];
  /** Next derivation index to use */
  readonly nextDerivationIndex: number;
  /** Pending incoming transfers */
  readonly pendingIncoming: readonly PendingTransfer[];
}

/**
 * A pending incoming transfer (keys received, not yet claimed).
 */
export interface PendingTransfer {
  /** Sender's DIM pseudonym (for display) */
  readonly senderPseudonym: string;
  /** Private keys to claim */
  readonly keys: readonly string[];
  /** Expected values */
  readonly values: readonly CoinExponent[];
  /** When keys were received */
  readonly receivedAt: number;
  /** Expiration (sender can reclaim after this) */
  readonly expiresAt: number;
}

/**
 * Decompose an amount into coin denominations.
 * Uses greedy algorithm (largest denominations first).
 *
 * @example
 * decomposeAmount(800) // $8.00
 * // Returns: [9, 8] // $5.12 + $2.56 + $0.32 = $8.00
 * // Actually: [9, 8, 5] for exact $8.00
 */
export function decomposeAmount(cents: number): CoinExponent[] {
  const result: CoinExponent[] = [];
  let remaining = cents;

  // Start from largest denomination
  for (let exp = 14; exp >= 0; exp--) {
    const value = COIN_VALUES[exp as CoinExponent];
    while (remaining >= value) {
      result.push(exp as CoinExponent);
      remaining -= value;
    }
  }

  if (remaining > 0) {
    throw new Error(`Cannot exactly represent ${cents} cents with coin denominations`);
  }

  return result;
}

/**
 * Format coin value for display.
 */
export function formatCoinValue(exponent: CoinExponent): string {
  const cents = COIN_VALUES[exponent];
  return `$${(cents / 100).toFixed(2)}`;
}
```

### Step 2: Create Coinage Client

Create `/packages/coinage/src/client.ts`:

```typescript
/**
 * Coinage client for private payment operations.
 */

import type {
  Coin,
  CoinExponent,
  CoinPublicKey,
  CoinWallet,
  RecyclerClaimToken,
  RecyclerVoucher,
} from '@cocuyo/types';

export interface CoinageConfig {
  /** People Chain endpoint */
  endpoint: string;
  /** User's mnemonic (for key derivation) */
  mnemonic: string;
}

/**
 * Create a Coinage client for private payments.
 */
export function createCoinageClient(config: CoinageConfig) {
  // Key derivation state
  let nextDerivationIndex = 0;

  return {
    /**
     * Scan chain for user's coins.
     * Iterates through derivation indices to find owned coins.
     */
    async scanForCoins(): Promise<CoinWallet> {
      // TODO: Implement chain scanning
      // Iterate //coin-0, //coin-1, ... until gap of N empty slots
      throw new Error('Not implemented');
    },

    /**
     * Derive a fresh coin public key.
     */
    deriveFreshKey(): { publicKey: CoinPublicKey; derivationIndex: number } {
      const index = nextDerivationIndex++;
      // TODO: Implement hard derivation from mnemonic
      // path: //coin-{index}
      throw new Error('Not implemented');
    },

    /**
     * Onboard: Convert pUSD to private coins.
     */
    async onboard(params: {
      amount: number; // in cents
      sourceAddress: string; // pUSD source
    }): Promise<RecyclerVoucher[]> {
      // 1. Decompose amount into denominations
      // 2. For each denomination, load recycler
      // 3. Return vouchers for claiming
      throw new Error('Not implemented');
    },

    /**
     * Claim coins from recycler vouchers.
     */
    async claimCoins(params: {
      vouchers: RecyclerVoucher[];
      claimToken: RecyclerClaimToken;
    }): Promise<Coin[]> {
      // 1. Derive fresh keys for each coin
      // 2. Submit claim transactions
      // 3. Return minted coins
      throw new Error('Not implemented');
    },

    /**
     * Split a coin into smaller denominations.
     */
    async splitCoin(params: { coin: Coin; into: CoinExponent[] }): Promise<Coin[]> {
      // 1. Validate split (sum must equal original)
      // 2. Derive fresh keys for new coins
      // 3. Submit split transaction
      // 4. Return new coins
      throw new Error('Not implemented');
    },

    /**
     * Initiate transfer (off-chain key sharing).
     * Returns private keys to send to recipient.
     */
    prepareTransfer(coins: Coin[]): {
      keysToShare: string[];
      expiresAt: number;
    } {
      // Return private keys for the coins
      // Recipient will use these to claim
      throw new Error('Not implemented');
    },

    /**
     * Claim incoming transfer.
     */
    async claimTransfer(params: { keys: string[] }): Promise<Coin[]> {
      // 1. Derive fresh destination keys
      // 2. Submit transfer transactions
      // 3. Return claimed coins
      throw new Error('Not implemented');
    },

    /**
     * Cancel pending transfer (reclaim to self).
     */
    async cancelTransfer(coins: Coin[]): Promise<Coin[]> {
      // Transfer to fresh keys owned by self
      throw new Error('Not implemented');
    },

    /**
     * Recycle coins to reset age.
     */
    async recycleCoin(params: { coins: Coin[]; claimToken: RecyclerClaimToken }): Promise<Coin[]> {
      // 1. Load coins into recycler
      // 2. Wait for ring to fill (privacy)
      // 3. Claim new coins with age 0
      throw new Error('Not implemented');
    },

    /**
     * Offboard: Convert private coins to pUSD.
     */
    async offboard(params: {
      coins: Coin[];
      destinationAddress: string;
      claimToken: RecyclerClaimToken;
    }): Promise<{ amount: number; txHash: string }> {
      // 1. Load coins into recycler
      // 2. Claim as pUSD to destination
      throw new Error('Not implemented');
    },

    /**
     * Get free claim tokens available (for DIM-verified users).
     */
    async getFreeClaimTokens(credential: string): Promise<{
      available: number;
      period: number;
      nextRefresh: number;
    }> {
      throw new Error('Not implemented');
    },
  };
}
```

### Step 3: Create Payment Router

Create `/packages/payments/src/router.ts`:

```typescript
/**
 * Payment router - selects between public and private payment modes.
 */

import type { PUSDAmount } from '@cocuyo/types';
import { createAssetHubClient } from './asset-hub-client';
import { createCoinageClient } from '@cocuyo/coinage';

export type PaymentMode = 'public' | 'private';

export interface PaymentRouterConfig {
  assetHubEndpoint: string;
  peopleChainEndpoint: string;
  defaultMode: PaymentMode;
}

/**
 * Determines appropriate payment mode based on context.
 */
export function selectPaymentMode(context: {
  useCase: 'bounty_payout' | 'salary' | 'contribution' | 'membership' | 'settlement' | 'offboard';
  senderPreference?: PaymentMode;
  receiverPreference?: PaymentMode;
  complianceRequired?: boolean;
}): PaymentMode {
  // Compliance always requires public
  if (context.complianceRequired) {
    return 'public';
  }

  // Off-boarding requires public (to get pUSD)
  if (context.useCase === 'offboard') {
    return 'public';
  }

  // Sensitive use cases default to private
  const sensitiveCases = ['bounty_payout', 'salary', 'contribution'];
  if (sensitiveCases.includes(context.useCase)) {
    // Respect receiver preference if they want public
    if (context.receiverPreference === 'public') {
      return 'public';
    }
    return 'private';
  }

  // Other cases use sender preference or default
  return context.senderPreference ?? 'public';
}

/**
 * Create a unified payment router.
 */
export function createPaymentRouter(config: PaymentRouterConfig) {
  const publicClient = createAssetHubClient({
    endpoint: config.assetHubEndpoint,
    assetId: 0, // TODO: pUSD asset ID
  });

  return {
    /**
     * Execute a payment with automatic mode selection.
     */
    async pay(params: {
      from: string;
      to: string;
      amount: PUSDAmount;
      mode: PaymentMode;
      memo?: string;
    }): Promise<{ txHash: string; mode: PaymentMode }> {
      if (params.mode === 'public') {
        const result = await publicClient.transfer({
          from: params.from as any,
          to: params.to as any,
          amount: params.amount,
        });
        return { txHash: result.txHash, mode: 'public' };
      } else {
        // Private payment via Coinage
        // This requires off-chain key exchange
        throw new Error('Private payments require interactive flow');
      }
    },

    /**
     * Initiate private payment (returns keys to share).
     */
    async initiatePrivatePayment(params: {
      mnemonic: string;
      amount: number; // cents
    }): Promise<{
      keysToShare: string[];
      expiresAt: number;
    }> {
      const coinageClient = createCoinageClient({
        endpoint: config.peopleChainEndpoint,
        mnemonic: params.mnemonic,
      });

      // Scan for available coins
      const wallet = await coinageClient.scanForCoins();

      // Select coins for payment
      // TODO: Implement coin selection algorithm
      throw new Error('Not implemented');
    },
  };
}
```

---

## Privacy Considerations

### Information Leakage Points

Even with Coinage, some information can leak:

| Operation      | Information Leaked                                               |
| -------------- | ---------------------------------------------------------------- |
| Onboarding     | Someone with this pUSD address converted to private coins        |
| Split          | Someone split a coin of value X into Y coins (likely same owner) |
| Transfer       | A coin was transferred (but sender/receiver unknown)             |
| Recycler Load  | Someone with this coin loaded the recycler                       |
| Recycler Claim | One of N ring members claimed coins                              |
| Offboarding    | Someone converted private coins to this pUSD address             |

### Privacy Best Practices

1. **Wait Before Claiming**: Don't claim from recycler immediately; wait for more entries
2. **Avoid Distinctive Amounts**: $7.77 is more traceable than $8.00
3. **Batch Operations**: Combine operations with other users when possible
4. **Use Multiple Recyclers**: Spread operations across time and denominations
5. **Minimize On/Off Ramps**: Stay in private coins as long as possible

### Ring Size Requirements

Privacy strength depends on recycler ring size:

```
Ring Size    Privacy Level    Recommendation
─────────────────────────────────────────────
< 10         Weak             Avoid if possible
10-50        Moderate         Acceptable for low-risk
50-200       Good             Recommended
> 200        Strong           Ideal for high-risk
```

The system tracks ring sizes; users should wait for sufficient anonymity set.

---

## Summary

Coinage integration transforms the Firefly Network from "censorship-resistant payments" to "truly private payments." This is critical for:

- **Journalists** receiving payments without government surveillance
- **Diaspora** contributing without exposing family to retaliation
- **Sources** receiving compensation anonymously
- **Outlets** paying staff without creating traceable records

The integration leverages existing infrastructure:

- **DIM credentials** enable free Coinage usage
- **Firefly chat** enables off-chain key exchange
- **pUSD foundation** provides stable value

Combined with public pUSD for transparency-required flows, this creates a complete payment system that serves journalism's unique needs.

---

## Related Documents

- [ADR-002: Coinage Integration](/docs/ADR/002-coinage-integration.md)
- [ADR-001: pUSD Integration](/docs/ADR/001-pusd-integration.md)
- [pUSD Integration Guide](/docs/pusd-integration-guide.md)
