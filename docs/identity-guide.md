# Identity & Verification Guide

This guide explains how identity verification works in the Firefly Network, including the DIM (Decentralized Identity Mechanism) system, personhood levels, and reputation decay.

## Overview

The Firefly Network uses proof-of-personhood to ensure every participant is a verified human being — without revealing their identity. This is achieved through integration with the **Individuality** chain's PeopleLite pallet.

Key principles:

- **Anonymous but Human**: Prove you're real without revealing who you are
- **Verified but Private**: Cryptographic verification without personal data collection
- **Reputation-Based**: Build topic-weighted reputation through contributions

## What is DIM?

DIM (Decentralized Identity Mechanism) is a privacy-preserving proof-of-personhood system built on Polkadot. It uses ring VRF (Verifiable Random Function) cryptography to enable:

1. **Proof of Uniqueness**: Each person can only register once
2. **Unlinkability**: Your actions cannot be linked to your real identity
3. **Pseudonymous Aliases**: Optional privacy-preserving aliases for different contexts

### How It Works

1. A **verifier** (trusted attestation service) confirms you are a unique human
2. You generate a **ring VRF key** — a cryptographic key that proves membership in the verified humans ring
3. Your key is added to the **lite people collection** on-chain
4. From then on, you can prove you're in the ring without revealing which key is yours

## Personhood Levels

The Firefly Network has three personhood levels:

### None (Unverified)

- Cannot participate in the network
- Can browse public content only
- No reputation, no capabilities

### Lite (Basic Verification)

The standard verification level for most users.

**Capabilities:**

- ✅ Illuminate (create) posts
- ✅ Corroborate observations
- ✅ Challenge claims
- ✅ Fund bounties (up to $1,000)
- ✅ Claim payouts (up to $500 per post)
- ✅ Receive private payments

**Requirements:**

- Connect a Polkadot wallet
- Complete DIM attestation
- Sign proof of account ownership

### Full (Enhanced Verification)

Advanced verification for high-stakes participation.

**Additional capabilities:**

- ✅ Unlimited bounty funding
- ✅ Unlimited payout claims
- ✅ Create governance proposals
- ✅ Join fact-checking collectives

**Requirements:**

- Lite verification complete
- Additional verification steps (varies by implementation)

## Two paths to 'lite' personhood

There are two distinct ways an account becomes a 'lite' person today. Only one of them is fully
wired end-to-end right now.

### Path A — Host-attested (works today)

When the app runs **inside the Triangle host container**, the host only issues a product account to
a signed-in, verified human. Running inside the container is therefore treated as an attestation of
personhood: the account is granted `verificationMethod: 'host-attested'` at the `'lite'` level, even
if it is not (yet) registered in the on-chain `PeopleLite` collection or the chain lookup is
unavailable. This is the path that actually yields personhood in practice today. See
`apps/web/src/lib/services/chain-personhood-service.ts` (`cacheHostAttestedLite`).

### Path B — On-chain DIM attestation (PeopleLite — pending a verifier)

The full DIM flow below registers a ring VRF key on the Individuality chain's `PeopleLite` pallet.
**This path is not self-service today** (see "How to Verify"): the candidate cannot self-attest, and
the `/verify` flow honestly surfaces a "not available yet" state rather than faking success.

## How to Verify

> **Status: pending an attestation verifier.** The on-chain flow below describes the intended DIM
> attestation. In the current build `/verify` cannot complete it: `PeopleLite.attest` must be
> submitted by a **verifier** account that holds an on-chain `AttestationAllowance`, and the
> candidate cannot self-attest. The `SignStep` produces a _real_ candidate signature over the
> attestation message, then the flow shows an honest "not available yet" state — and
> `chainPersonhoodService.startVerification` returns a real not-available error rather than a
> fabricated verification URL or success. The path that grants personhood today is the
> host-attested one (Path A above).

### Step 1: Connect Wallet

Connect your Polkadot-compatible wallet (e.g., Polkadot.js extension, Talisman, SubWallet).

```typescript
// The app creates a DIM credential from your address
const credential = createCredentialForAccount(walletAddress);
```

### Step 2: Check Eligibility

The system checks if you're eligible for verification:

```typescript
const { eligible, reason } = await service.canBeAttested(address);
```

You're **not eligible** if:

- Already registered as a lite person
- PeopleLite collection not initialized
- Account already has an active alias

### Step 3: Sign Attestation Message

Sign a message proving you control your account:

```
I verify that I am a unique human and wish to be
registered as a lite person on the Firefly Network.

Account: [your address]
```

This signature proves account ownership without transferring any funds.

### Step 4: Attestation

The attestation service verifies your request and submits the `attest` extrinsic:

```rust
PeopleLite::attest(
    verifier,           // Attestation service
    candidate,          // Your account
    candidate_signature,
    ring_vrf_key,
    proof_of_ownership,
)
```

### Step 5: Confirmation

When (and only when) a verifier's `PeopleLite.attest` extrinsic is finalized on-chain and the
account appears in `PeopleLite.LitePeople`, the `PersonAttested` event is emitted and the account is
verified. The app observes this directly from on-chain state — `subscribePersonhood` /
`getPersonhood` pick it up; there is no off-chain token to redeem and no fake "you're verified"
shortcut. Until a verifier service is available, the candidate cannot reach this step on their own;
inside the host container the account is already host-attested 'lite' regardless (Path A).

## Privacy Guarantees

### What We Store

- Your ring VRF public key (32 bytes)
- Recognition method (who attested you)

### What We Don't Store

- Your real identity
- Personal information
- Biometric data
- IP addresses
- Device fingerprints

### Ring VRF Privacy

The ring VRF system provides:

1. **Membership Proofs**: Prove you're in the verified humans ring
2. **Unlinkability**: Different proofs cannot be linked to each other
3. **Pseudonymous Aliases**: Create context-specific identifiers
4. **Revocability**: Aliases can be unset without affecting base identity

## Reputation & Decay

### How Reputation Works

Reputation is earned through:

- **Illuminating** posts that get corroborated
- **Corroborating** posts that prove accurate
- **Challenging** false claims successfully

Reputation is lost through:

- **Failed challenges** against accurate posts
- **Inactivity decay** over time

### Topic-Weighted Reputation

Reputation is tracked per topic:

- Economy
- Health
- Politics
- Infrastructure
- Human Rights
- Environment
- Security
- Education

Your corroborations carry more weight in topics where you have high reputation.

### Inactivity Decay

To ensure reputation reflects current engagement, scores decay over time:

| Parameter     | Default | Aggressive | Lenient |
| ------------- | ------- | ---------- | ------- |
| Grace Period  | 30 days | 14 days    | 60 days |
| Daily Decay   | 1%      | 2%         | 0.5%    |
| Minimum Floor | 100     | 50         | 200     |

**Example**: With default settings, after 40 days of inactivity:

- Grace period: 30 days (no decay)
- Decay days: 10 days
- Decay factor: (0.99)^10 ≈ 90.4%
- Original 1000 reputation → ~904

### Resetting Decay

Any of these actions reset your decay timer:

- Illuminate a post
- Corroborate an observation
- Challenge a claim
- Vote on a proposal
- Fund a bounty
- Claim a payout

## Troubleshooting

### "Not eligible for verification"

**Possible causes:**

1. Already registered — you may already be verified
2. Collection not initialized — the PeopleLite pallet isn't ready
3. Account in use — your account has an existing alias binding

**Solutions:**

- Check if you're already verified: `/verify` will show your status
- Wait for the network to initialize (rare, usually only on new chains)
- Use a different account

### "Signing failed"

**Possible causes:**

1. Wallet rejected the signature request
2. Network connectivity issues
3. Wallet extension not responding

**Solutions:**

- Accept the signature request in your wallet
- Check your internet connection
- Refresh the page and try again
- Restart your wallet extension

### "Attestation failed"

**Possible causes:**

1. Verifier service unavailable
2. Network congestion
3. Invalid proof submitted

**Solutions:**

- Wait a few minutes and retry
- Check network status at [Polkadot.js Apps](https://polkadot.js.org/apps/)
- Contact support if persistent

### "Already verified but not recognized"

**Possible causes:**

1. Cache out of sync
2. Using wrong account

**Solutions:**

- Refresh the page to clear cache
- Verify you're connected with the correct wallet
- Wait for block confirmation (usually 6-12 seconds)

## API Reference

### IndividualityClient

```typescript
import { IndividualityClient } from '@cocuyo/individuality';

const client = new IndividualityClient(api.individuality);

// Check if account is verified
const info = await client.getLitePerson(address);

// Get attestation status
const status = await client.getAttestationStatus(address);

// Check eligibility
const { eligible, reason } = await client.canBeAttested(address);

// Subscribe to changes
const unsubscribe = client.subscribeLitePerson(address, (info) => {
  console.log('Updated:', info);
});
```

### usePersonhood Hook

```typescript
import { usePersonhood } from '@/lib/services/hooks';

function MyComponent() {
  const {
    state,        // PersonhoodState | null
    level,        // 'none' | 'lite' | 'full'
    capabilities, // PersonhoodCapabilities
    isVerified,   // boolean
    loading,      // boolean
    error,        // Error | null
    refresh,      // () => void
  } = usePersonhood();

  if (loading) return <Loading />;
  if (!isVerified) return <VerifyPrompt />;

  return <Dashboard capabilities={capabilities} />;
}
```

### useAttestationStatus Hook

```typescript
import { useAttestationStatus } from '@/lib/services/hooks';

function VerificationPage() {
  const {
    status,           // AttestationStatus | null
    canBeAttested,    // boolean
    ineligibleReason, // string | undefined
    loading,          // boolean
    error,            // Error | null
    refresh,          // () => void
  } = useAttestationStatus();

  if (status?.status === 'registered') {
    return <AlreadyVerified />;
  }

  if (!canBeAttested) {
    return <NotEligible reason={ineligibleReason} />;
  }

  return <VerificationFlow />;
}
```

## Further Reading

- [Individuality Chain Documentation](https://github.com/nicksenger/individuality)
- [Ring VRF Cryptography](https://eprint.iacr.org/2023/002)
- [Polkadot Identity](https://wiki.polkadot.network/docs/learn-identity)
- [DIM Protocol Specification](https://github.com/nicksenger/individuality/tree/main/pallets/people-lite)
