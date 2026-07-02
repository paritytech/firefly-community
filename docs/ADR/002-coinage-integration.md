# ADR-002: Coinage (Private Payments) Integration

## Status

Proposed

## Context

ADR-001 established pUSD as the primary currency for the Firefly Network. However, pUSD transactions on Asset Hub are **publicly visible** — anyone can see:

- Who sent funds
- Who received funds
- The amount transferred
- The timestamp

For journalists in hostile environments, this transparency creates serious risks:

- Governments can identify who funds independent media
- Journalists receiving payments can be targeted
- Contribution patterns can reveal sources
- Diaspora supporters can face retaliation against family back home

**Coinage** is Polkadot's native private payment system that solves this problem. It provides:

- Anonymous coin holding (balances are private)
- Private transfers (sender/receiver identities hidden)
- Minimal information leakage (ZK proofs + ring signatures)
- Free usage for verified humans (People and Lite People)
- pUSD denomination (same stable value)

### How Coinage Works (Summary)

1. **Onboarding**: Convert pUSD → private coins via "recycler" with ring-VRF anonymization
2. **Holding**: Each coin held in a fresh, single-use public key derived from user's mnemonic
3. **Transfers**: Sender shares private keys off-chain; receiver "pulls" coins on-chain
4. **Recycling**: Coins with high "age" (transfer count) are recycled through rings to reset age and consolidate
5. **Offboarding**: Convert private coins → pUSD via recycler

Key properties:

- Coin denominations: $0.01, $0.02, $0.04, ... $163.84 (powers of 2)
- Coins have "age" — number of times transferred
- Age limits enforce recycling, which resets anonymity
- Verified humans (People/Lite People) get free transaction vouchers

### Alignment with Firefly Network

| Firefly Concept                       | Coinage Alignment                      |
| ------------------------------------- | -------------------------------------- |
| DIM Credentials (proof-of-personhood) | Required for free Coinage usage        |
| Anonymous but Human                   | Coinage preserves both properties      |
| Surveillance Resistance               | Core design goal of Coinage            |
| Information Bounties                  | Can be paid in private coins           |
| Diaspora Contributions                | Protected from government surveillance |

## Decision

We will integrate Coinage as the **privacy layer** for the Firefly Network's payment system:

1. **Dual-Track Payments**: Offer both public pUSD and private Coinage options
2. **Privacy by Default**: Use Coinage for sensitive payments (bounties, journalist compensation)
3. **Transparency by Choice**: Use public pUSD for treasury accounting, membership, and compliance-required flows
4. **DIM Synergy**: Leverage existing DIM integration for Coinage's free usage tier

### Payment Matrix

| Use Case               | Default Mode      | Rationale                        |
| ---------------------- | ----------------- | -------------------------------- |
| Bounty Payouts         | Private (Coinage) | Protect journalist identity      |
| Journalist Salaries    | Private (Coinage) | Protect recipient from targeting |
| Diaspora Contributions | Private (Coinage) | Protect contributor's family     |
| Treasury Holdings      | Public (pUSD)     | Transparency for governance      |
| Membership Fees        | Public (pUSD)     | Lower complexity, compliance     |
| Alliance Settlements   | Configurable      | Outlet preference                |
| Off-ramping            | Public (pUSD)     | Required for fiat conversion     |

### Technical Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                     PAYMENT FLOW OPTIONS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   PUBLIC PATH (pUSD)              PRIVATE PATH (Coinage)         │
│                                                                  │
│   Contributor                     Contributor                    │
│       │                               │                          │
│       │ pUSD transfer                 │ pUSD → Recycler          │
│       ▼                               ▼                          │
│   Treasury/Escrow                 Private Coins                  │
│       │                               │                          │
│       │ pUSD transfer                 │ Off-chain key sharing    │
│       ▼                               ▼                          │
│   Recipient                       Recipient pulls coins          │
│   (visible on-chain)              (anonymous on-chain)           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Consequences

### Positive

- **True Privacy**: Not just censorship resistance, but actual anonymity
- **Journalist Safety**: Payments cannot be traced to recipients
- **Contributor Protection**: Diaspora can support without exposing family
- **Source Protection**: Anonymous bounty claims protect whistleblowers
- **DIM Synergy**: Existing identity system enables free usage tier
- **Polkadot Native**: No external dependencies, audited cryptography

### Negative

- **Complexity**: Two payment modes to support and explain
- **UX Challenge**: Private payments require off-chain key exchange
- **Liquidity Fragmentation**: Funds split between public and private pools
- **Off-ramp Friction**: Must convert to public pUSD for fiat
- **Denomination Constraints**: Powers of 2 require coin splitting

### Neutral

- Requires Coinage deployment on People Chain (in progress)
- Private payments have age limits requiring periodic recycling
- Free usage quotas may not cover all use cases (paid options exist)

## Implementation Notes

### Phase 1: Foundation

- Add Coinage types to `@cocuyo/types`
- Integrate with existing DIM client for People/Lite People status
- Create `CoinageClient` abstraction

### Phase 2: Bounty Integration

- Offer private payout option for bounties
- Generate ephemeral keys for bounty escrow
- Implement off-chain key sharing via chat

### Phase 3: Journalist Payments

- Add private payment option for outlets
- Batch payment support with coin splitting
- Recovery flow for lost keys

### Phase 4: Full Integration

- Configurable privacy preferences per user
- Automatic public ↔ private conversion
- Privacy-preserving analytics

## References

- [ADR-001: pUSD Integration](/docs/ADR/001-pusd-integration.md)
- [DIM Identity System](/packages/identity/)
