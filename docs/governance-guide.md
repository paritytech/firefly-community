# Governance Guide

> [!WARNING]
> **Experimental concept/design document.** This code is developed and published by Parity as a prototype and proof-of-concept — it is **not** a Parity product or an operated service, and Parity does not run or take responsibility for any deployment. The design here is experimental and unaudited; all figures, timelines, and named systems are **illustrative only**.

This guide explains how governance works in the Firefly Network, including proposals, voting, and the council system.

## Overview

The Firefly Network uses a hybrid governance model:

1. **Direct Democracy**: All contributors can vote on proposals
2. **Representative Council**: Elected council handles day-to-day decisions
3. **Reputation Weighting**: Votes are weighted by contribution and reputation

## Governance Principles

- **Transparency**: All proposals, votes, and decisions are on-chain
- **Accessibility**: Anyone can participate at their tier level
- **Accountability**: Council members are elected and can be recalled
- **Security**: Critical changes require supermajorities and time delays

## Proposals

### Types of Proposals

| Type          | Description                     | Required Tier | Quorum      | Threshold   |
| ------------- | ------------------------------- | ------------- | ----------- | ----------- |
| **Treasury**  | Spending from alliance treasury | Beacon+       | 20%         | 50%+1       |
| **Protocol**  | Smart contract upgrades         | Lighthouse    | 30%         | 66%         |
| **Outlet**    | Partner outlet approvals        | Beacon+       | 15%         | 50%+1       |
| **Community** | Guidelines and policies         | Firefly+      | 10%         | 50%+1       |
| **Emergency** | Security responses              | Council only  | 51% council | 66% council |

### Proposal Lifecycle

```
Draft → Review → Voting → Timelock → Execution
  │       │        │         │          │
  │       │        │         │          └─ Proposal enacted
  │       │        │         └─ 48hr delay for objections
  │       │        └─ 7 day voting period
  │       └─ 24hr community review
  └─ Author creates and submits
```

### Creating a Proposal

**Requirements**:

- Beacon tier or above
- Positive reputation balance
- Stake proposal bond (returned if approved)

**Steps**:

1. Navigate to `/alliance/governance/proposals/new`
2. Select proposal type
3. Fill in required fields:
   - **Title**: Clear, descriptive title (max 100 characters)
   - **Summary**: Brief overview (max 280 characters)
   - **Description**: Full proposal with rationale (Markdown supported)
   - **Parameters**: Type-specific fields (amounts, addresses, etc.)
4. Review and submit
5. Pay proposal bond

### Proposal Bond

A refundable bond is required to prevent spam:

| Proposal Type | Bond Amount |
| ------------- | ----------- |
| Community     | 10 DOT      |
| Treasury      | 50 DOT      |
| Outlet        | 25 DOT      |
| Protocol      | 100 DOT     |

The bond is returned when:

- Proposal passes (regardless of execution)
- Proposal fails but reaches quorum

The bond is slashed when:

- Proposal fails to reach quorum
- Proposal is flagged as spam by council

## Voting

### Who Can Vote

- **Firefly tier**: Vote on Community proposals
- **Beacon tier**: Vote on all proposals except Protocol
- **Lighthouse tier**: Vote on all proposals

### Voting Power

Your voting power is calculated as:

```
Voting Power = Contribution × Tier Multiplier × Reputation Factor
```

Where:

- `Contribution` = Your DOT contribution
- `Tier Multiplier` = 1.0 (Firefly), 1.1 (Beacon), 1.25 (Lighthouse)
- `Reputation Factor` = 0.5 to 2.0 based on your domain reputation

### How to Vote

1. Navigate to `/alliance/governance/proposals`
2. Select an active proposal
3. Review the full proposal details
4. Choose your vote:
   - **Approve**: Support the proposal
   - **Reject**: Oppose the proposal
   - **Abstain**: Count toward quorum without taking a position
5. Confirm your vote on-chain

### Delegation

You can delegate your voting power to another member:

1. Navigate to `/alliance/governance`
2. Click "Delegate Votes"
3. Enter the delegate's address
4. Select scope:
   - **Full**: Delegate all voting power
   - **Category**: Delegate only for specific proposal types
5. Confirm delegation

To revoke delegation, follow the same process and select "Revoke."

## The Council

### Role of the Council

The council is a group of 7 elected members who:

- Propose emergency measures
- Execute approved proposals
- Manage day-to-day treasury operations
- Represent the alliance externally

### Council Elections

**Election Cycle**: Every 3 months

**Process**:

1. Nomination period (1 week)
2. Campaign period (1 week)
3. Voting period (1 week)
4. New council seats immediately

**Eligibility**:

- Lighthouse tier contributor
- Positive reputation in at least 2 domains
- No pending governance violations

### Council Powers

| Action              | Required Votes         |
| ------------------- | ---------------------- |
| Emergency pause     | 4 of 7                 |
| Treasury < 1000 DOT | 4 of 7                 |
| Treasury < 5000 DOT | 5 of 7                 |
| Treasury > 5000 DOT | Requires full proposal |
| Add/remove outlet   | 5 of 7                 |

### Council Recall

Any council member can be recalled:

1. A Lighthouse member creates a recall proposal
2. 30% quorum required
3. 66% supermajority to recall
4. Recalled member loses seat immediately
5. Emergency election for replacement

## Treasury

### Treasury Sources

- Genesis Alliance contributions (initial)
- Crowdstacking rewards share (10%)
- Outlet partnership fees
- Protocol fees (when enabled)

### Treasury Categories

| Category    | Allocation | Purpose                      |
| ----------- | ---------- | ---------------------------- |
| Development | 40%        | Protocol development, audits |
| Operations  | 25%        | Infrastructure, tooling      |
| Grants      | 20%        | Community projects, bounties |
| Reserve     | 15%        | Emergency fund               |

### Spending Process

1. **Small expenses** (< 100 DOT): Council discretion
2. **Medium expenses** (100-1000 DOT): Council vote (4/7)
3. **Large expenses** (> 1000 DOT): Full governance proposal

## Reputation Impact

Governance participation affects your reputation:

### Positive Actions

- Voting on proposals: +1 governance rep per vote
- Proposal passes that you authored: +10 governance rep
- Successful council term: +50 governance rep

### Negative Actions

- Proposal spam (slashed bond): -20 governance rep
- Council recall: -100 governance rep
- Voting against consensus on failed proposals: No penalty

## Timeline Reference

| Phase              | Duration |
| ------------------ | -------- |
| Review Period      | 24 hours |
| Voting Period      | 7 days   |
| Timelock           | 48 hours |
| Emergency Voting   | 24 hours |
| Emergency Timelock | 6 hours  |
| Council Term       | 90 days  |
| Election Period    | 21 days  |

## Best Practices

### For Proposal Authors

1. **Draft First**: Share your idea in community channels before formal proposal
2. **Be Specific**: Include exact amounts, addresses, and timelines
3. **Justify**: Explain why this benefits the network
4. **Budget**: For treasury proposals, break down how funds will be used
5. **Timeline**: Include milestones and deliverables

### For Voters

1. **Read Fully**: Review the complete proposal, not just the title
2. **Ask Questions**: Use community channels to seek clarification
3. **Consider Impact**: Think about long-term effects, not just immediate
4. **Vote**: Participation strengthens governance legitimacy

### For Council Members

1. **Transparency**: Document all council decisions
2. **Responsiveness**: Address community concerns promptly
3. **Neutrality**: Recuse yourself from votes where you have conflicts
4. **Accountability**: Publish regular council activity reports

## Viewing Governance Data

- **Active Proposals**: `/alliance/governance/proposals`
- **Council Members**: `/alliance/governance/council`
- **Treasury Status**: `/alliance/treasury`
- **Your Voting History**: `/dashboard`

## Support

Questions about governance? Contact:

- **Community Discord**: #governance channel
- **Forum**: discuss.firefly.network (planned)
- **GitHub**: Issues labeled `governance`

---

_Governance rules may be updated through the governance process itself. This guide reflects the Genesis Alliance phase._
