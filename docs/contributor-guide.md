# Contributor Guide

> [!WARNING]
> **Experimental concept/design document.** This code is developed and published by Parity as a prototype and proof-of-concept — it is **not** a Parity product or an operated service, and Parity does not run or take responsibility for any deployment. The design here is experimental and unaudited; contribution tiers, rewards, benefits, timelines, and any figures below are **illustrative design concepts only**, not an offer, solicitation, or live program.

This guide describes the _designed_ onboarding and contribution model for the Firefly Network prototype. It documents how the concept is intended to work; it is not a live program you can join today. All tiers, amounts, and benefits below are illustrative design detail.

## What is the Genesis Alliance?

The Genesis Alliance is a design concept within this experimental prototype: the founding group of contributors that would launch and govern the Firefly Network if the concept were deployed. As envisioned, a Genesis Alliance member would:

- Help fund the network's initial infrastructure
- Participate in governance decisions
- Earn reputation and influence
- Receive rewards from the crowdstacking pool

## How to Join

### Prerequisites

1. **Wallet**: A Polkadot-compatible wallet (Polkadot.js extension, Talisman, or SubWallet)
2. **Identity**: Complete identity verification (proof of personhood)
3. **Contribution**: DOT or PUSD to contribute

### Step-by-Step Process

1. **Connect Wallet**
   - Visit [firefly.network](https://fireflynetwork.dot.li)
   - Click "Connect Wallet" in the navigation
   - Select your wallet provider
   - Approve the connection

2. **Verify Identity**
   - Navigate to `/verify`
   - Follow the DIM verification process
   - This proves you are a unique human without revealing your identity

3. **Choose Contribution Tier**
   - Navigate to `/join`
   - Review the available tiers
   - Select your contribution amount
   - Confirm the transaction

4. **Welcome to the Alliance**
   - You'll be redirected to a welcome page
   - Your dashboard will show your contribution status
   - You can now participate in governance

## Contribution Tiers

### Observer Tier

**Contribution**: Free (identity verification only)

**Benefits**:

- View signals and story chains
- Access public governance discussions
- Basic reputation tracking

### Firefly Tier

**Contribution**: 10+ DOT equivalent

**Benefits**:

- All Observer benefits
- Illuminate signals
- Corroborate others' signals
- Vote on governance proposals
- Basic crowdstacking rewards

### Beacon Tier

**Contribution**: 100+ DOT equivalent

**Benefits**:

- All Firefly benefits
- Create governance proposals
- Enhanced reputation multiplier
- Priority outlet partnerships
- Beacon badge on profile

### Lighthouse Tier

**Contribution**: 1,000+ DOT equivalent

**Benefits**:

- All Beacon benefits
- Eligible for council nomination
- Highest reputation multiplier
- Lighthouse badge on profile

## Crowdstacking Rewards

Your contribution is pooled and staked to earn rewards. Unlike traditional staking:

- **No lock-up period**: Withdraw your contribution at any time
- **Collective power**: Small contributions combine for validator rewards
- **Pro-rata distribution**: Rewards based on your contribution percentage

### Reward Calculation

```
Your Rewards = (Your Contribution / Total Pool) × Pool Rewards × Tier Multiplier
```

Tier multipliers:

- Firefly: 1.0x
- Beacon: 1.1x
- Lighthouse: 1.25x

## Governance Participation

### Voting Power

Your voting power is determined by:

1. Contribution amount
2. Reputation score
3. Tier multiplier

### What You Can Vote On

- Treasury spending proposals
- Outlet partnerships
- Protocol upgrades
- Community guidelines

### Creating Proposals

**Beacon tier and above** can create proposals:

1. Navigate to `/alliance/governance/proposals/new`
2. Select proposal type (Treasury, Protocol, Community)
3. Fill in title, description, and parameters
4. Submit for community review
5. Proposal enters voting period after review delay

## Dashboard

Your dashboard at `/dashboard` shows:

- **Contribution Summary**: Total contribution and current tier
- **Staking Rewards**: Earned and pending rewards
- **Reputation**: Your multi-domain reputation scores
- **Voting Power**: Current voting weight
- **Activity History**: Contributions, votes, and rewards

## Withdrawals

You can withdraw your contribution at any time:

1. Navigate to `/dashboard/withdrawals`
2. Enter withdrawal amount
3. Review any pending rewards
4. Confirm transaction

**Note**: Withdrawing may affect your tier status if you drop below thresholds.

## Frequently Asked Questions

### Can I contribute anonymously?

Yes. Your identity verification proves you are a unique human, but does not reveal who you are. Your contribution is linked to your wallet address, not your real-world identity.

### What if I lose access to my wallet?

Your contribution is controlled by your wallet. We cannot recover funds if you lose access. Always keep secure backups of your recovery phrase.

### Can I increase my contribution later?

Yes. You can add to your contribution at any time, which may upgrade your tier.

### What happens if I contribute less than 10 DOT?

Contributions below the Firefly tier threshold are still accepted but do not unlock member benefits. You remain at Observer tier.

### How are rewards distributed?

Rewards are calculated per epoch and claimable at any time. Unclaimed rewards accumulate.

### Can I transfer my membership?

Membership is tied to your wallet address and cannot be transferred. Your reputation and contribution history stay with your address.

## Support

- **Documentation**: [docs.firefly.network](https://docs.fireflynetwork.dot.li)
- **Community**: [Discord](#) (link TBD)
- **Issues**: [GitHub Issues](https://github.com/paritytech/firefly-community/issues)

## Code of Conduct

By joining the Genesis Alliance, you agree to:

1. Act in good faith toward other members
2. Use governance power responsibly
3. Report security issues through proper channels
4. Not engage in market manipulation or fraud
5. Respect the privacy of other members

Violations may result in reputation penalties or exclusion from governance.

---

_This guide describes an experimental design and may change as the prototype evolves._
