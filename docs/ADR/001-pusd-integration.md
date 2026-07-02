# ADR-001: pUSD Stablecoin Integration

## Status

Proposed

## Context

The Firefly Network and Cocuyo Alliance face a fundamental challenge: independent media outlets in repressive or economically collapsed environments (Venezuela, Nicaragua, Cuba, etc.) cannot rely on traditional financial rails.

**Current problems:**

- Bank accounts can be frozen by hostile governments
- Payment processors (PayPal, Stripe) block transactions to sanctioned regions
- Local currencies are worthless due to hyperinflation
- Wire transfers have high fees and multi-day delays
- Grant funding is unpredictable and short-term

**The Cocuyo Alliance vision** requires:

- Censorship-resistant contribution rails for diaspora supporters
- Stable-value payments for journalists
- Transparent treasury management
- Cross-border settlement between alliance outlets

**pUSD (Polkadot USD)** is a native Polkadot stablecoin that can solve these problems:

- Lives on Polkadot Asset Hub — same ecosystem as our infrastructure
- Cannot be frozen by banks or payment processors
- Stable value (pegged to USD)
- Low transaction fees
- Transparent on-chain accounting
- Native XCM integration for cross-parachain transfers

## Decision

We will integrate pUSD as the primary currency for all financial operations within the Firefly Network:

1. **Information Bounties** — Bounties will be funded and paid out in pUSD
2. **Treasury Holdings** — Alliance treasury will hold reserves in pUSD
3. **Contributor Payments** — Crowdstacking contributions accepted in pUSD
4. **Journalist Compensation** — Outlets can pay contributors in pUSD
5. **Membership Fees** — Premium features paid in pUSD (future)

We will implement this in phases, starting with the bounty system as the MVP.

### Technical Approach

- Use Polkadot Asset Hub as the settlement layer
- Integrate with `@polkadot-apps/signer` (already implemented) for transaction signing
- Store pUSD amounts as `bigint` in smallest unit (6 decimals, matching USDC convention)
- Create escrow mechanisms using multi-sig or simple smart contracts
- Build payout triggers tied to collective verification workflow

### pUSD Asset Configuration

```typescript
// packages/types/src/currency.ts
export const PUSD = {
  symbol: 'pUSD',
  decimals: 6,
  assetId: TBD, // Asset Hub asset ID
  chain: 'polkadot-asset-hub',
} as const;

// Helper functions
export function formatPUSD(amount: bigint): string {
  return `${(Number(amount) / 1_000_000).toFixed(2)} pUSD`;
}

export function parsePUSD(amount: string): bigint {
  return BigInt(Math.round(parseFloat(amount) * 1_000_000));
}
```

## Consequences

### Positive

- **Censorship resistance** — No government can freeze pUSD held in user wallets
- **Stable value** — Journalists receive predictable compensation
- **Low fees** — More money goes to journalism, less to intermediaries
- **Transparency** — All treasury movements visible on-chain
- **Diaspora reach** — 60M+ Latin Americans abroad can contribute without SWIFT
- **Polkadot alignment** — Drives real utility for Polkadot ecosystem
- **Future-proof** — On/off ramps coming; infrastructure ready when they arrive

### Negative

- **On/off ramp dependency** — Until ramps exist, adoption limited to crypto-native users
- **Wallet UX** — Journalists must learn to use Polkadot wallets
- **Volatility perception** — Users may confuse pUSD with volatile crypto
- **Regulatory uncertainty** — Stablecoin regulations still evolving

### Neutral

- Requires education materials for non-crypto-native journalists
- May need fallback payment methods during ramp buildout
- Treasury management becomes more complex (multi-sig, key security)

## References

- [Firefly Network Concept](/docs/firefly-network-concept.md)
- [Bounty Type Definitions](/packages/types/src/bounty.ts)
- [Polkadot Asset Hub Documentation](https://wiki.polkadot.network/docs/learn-assets)
