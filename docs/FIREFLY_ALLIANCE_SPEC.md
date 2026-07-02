# The Firefly Alliance — Concept & Design Note

> [!WARNING]
> **Experimental concept/design document.** This code is developed and published by Parity as a prototype and proof-of-concept — it is **not** a Parity product or an operated service, and Parity does not run or take responsibility for any deployment. The design here is experimental and unaudited; all figures, named organizations, timelines, and economic targets are **illustrative only** and do not represent commitments or existing partnerships.

> **Version**: 1.0
> **Status**: Experimental concept — not a product
> **Last Updated**: 2026-05-08

---

## Executive Summary

The Firefly Alliance is an **epistemic network nation** for independent media — a decentralized civic infrastructure that combines pooled supporter capital, professional investment management, and a shared digital ecosystem to create sustainable operating income for journalism while reducing dependence on fragile platforms and grant cycles.

This specification consolidates the vision, architecture, and implementation details for the Cocuyo platform — a two-platform system that serves both citizens (Cocuyo) and media professionals (Newsroom OS).

---

## Table of Contents

1. [Origin Story & Context](#1-origin-story--context)
2. [Problem Analysis](#2-problem-analysis)
3. [Solution Architecture](#3-solution-architecture)
4. [Platform 1: Cocuyo (Citizen Platform)](#4-platform-1-cocuyo-citizen-platform)
5. [Platform 2: Newsroom OS (Professional Platform)](#5-platform-2-newsroom-os-professional-platform)
6. [Crowdstacking Economics](#6-crowdstacking-economics)
7. [Governance Model](#7-governance-model)
8. [Reputation System](#8-reputation-system)
9. [Technical Architecture](#9-technical-architecture)
10. [Genesis Alliance & Launch](#10-genesis-alliance--launch)
11. [Success Metrics](#11-success-metrics)
12. [Appendices](#appendices)

---

## 1. Origin Story & Context

### 1.1 Efecto Cocuyo: The Founding Inspiration

[Efecto Cocuyo](https://en.wikipedia.org/wiki/Efecto_Cocuyo) was co-founded in January 2015 by Laura Weffer (former director of Venezuelan newspaper Diario 2001), [Luz Mely Reyes](https://reutersinstitute.politics.ox.ac.uk/news/how-respected-editor-created-independent-news-venezuela), and Josefina Ruggiero (former content director of Cadena Capriles). The name means "Firefly Effect" in Spanish — a nod to the community they hoped to build, because "millions of tiny sparks" can illuminate an entire nation.

**Key characteristics:**

- Independent media platform delivering critical reporting on politics, economics, and human rights
- Committed to holding powerful public officials accountable in Venezuela
- Operates under extreme censorship pressure (Venezuela ranks 148th of 180 in World Press Freedom Index)
- Journalists have been [attacked and threatened](https://gijn.org/stories/independent-news-venezuela/) for covering protests
- Part of an [alliance of independent outlets](https://reutersinstitute.politics.ox.ac.uk/news/these-are-exiled-venezuelan-journalists-joining-forces-report-maduros-ouster-afar) coordinating journalists on the ground and in exile

### 1.2 Industry Context: 2026 Media Landscape

According to the [Reuters Institute Journalism, Media, and Technology Trends and Predictions 2026](https://reutersinstitute.politics.ox.ac.uk/journalism-media-and-technology-trends-and-predictions-2026) report:

| Trend                         | Impact                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **AI-driven traffic decline** | Publishers expect 40%+ decline in search referrals over next 3 years as AI "answer engines" divert audiences |
| **Platform squeeze**          | Content format matters more than platform loyalty; 79% of publishers prioritizing video                      |
| **Creator competition**       | Personality-led creators outpace institutional news brands in reach and engagement                           |
| **Limited AI ROI**            | Only 44% report "promising" AI results; 67% have not saved jobs from AI efficiencies                         |
| **Funding fragility**         | Independent media faces structural trap of short-term, censorable funding                                    |

---

## 2. Problem Analysis

### 2.1 The Genesis Problem: Financial Asphyxiation

Independent media operating in politically or economically fragile environments faces a structural trap:

```
PROBLEM (Capital)
Independent media runs on short-term, censorable money
        |
        v
CHALLENGES (Operations + Platforms)
- Digital tenant trap (algorithms, ToS, de-platforming)
- Video-fication resource tax
- Migration paradox (inertia, cold start, feature gap, trust transfer)
        |
        v
TRADITIONAL OUTCOMES
- One frozen account or missing grant can silence reporting
- Newsrooms spend more time fundraising than investigating
- Audiences lose access to verified information
```

### 2.2 The Digital Tenant Dilemma

Media organizations are "tenants" on platforms they don't control:

| Platform Risk               | Description                                                      |
| --------------------------- | ---------------------------------------------------------------- |
| **Algorithmic downranking** | Changes to feed algorithms can devastate reach overnight         |
| **Shadow-banning**          | Content suppression without notification or recourse             |
| **De-platforming**          | Policy changes or mass-reporting can remove entire organizations |
| **ToS changes**             | Unilateral rule changes with no negotiation                      |
| **Revenue extraction**      | Platforms capture ad revenue; creators get scraps                |

### 2.3 The Migration Paradox

When outlets try to move audiences to owned channels, they face:

| Barrier                    | Why It Fails                                     |
| -------------------------- | ------------------------------------------------ |
| **Inertia**                | People don't want extra steps or new apps        |
| **Cold start**             | New platforms lack network effects               |
| **Feature gap**            | Owned experiences feel worse than Big Tech       |
| **Trust transfer failure** | Users resist "another app" or handing over email |

### 2.4 Who Is Affected

| Stakeholder     | Pain Points                                                        |
| --------------- | ------------------------------------------------------------------ |
| **Outlets**     | Spend enormous time fundraising instead of investigating           |
| **Public**      | Loses access to verified information; vulnerable to disinformation |
| **Diaspora**    | Wants to help but lacks safe, non-extractive rails                 |
| **Donors**      | Fund survival but don't create durable capacity                    |
| **Journalists** | Face threats with inadequate institutional protection              |

---

## 3. Solution Architecture

### 3.1 The Firefly Alliance Model

The solution addresses **capital + operations + distribution** simultaneously:

```
SOLUTION (Cocuyo Alliance)
Crowdstacking pooled capital + professional investment
Alliance-level network effects across outlets
        |
        v
OUTCOMES
- Sustainable operating income
- Lower platform dependence risk
- More time for investigations
- Stronger public access to verified information
```

### 3.2 Two-Platform Architecture

The previous three-dApp design (Epistemic Nation Portal, Newsroom OS, F-Network) is unified into two platforms sharing common infrastructure:

| Platform        | Users                                   | Purpose                                                  |
| --------------- | --------------------------------------- | -------------------------------------------------------- |
| **Cocuyo**      | Citizens, supporters, diaspora, readers | Social layer + economic layer + governance participation |
| **Newsroom OS** | Outlets, collectives, journalists       | Professional tools + treasury management + coordination  |

### 3.3 Shared Infrastructure

Both platforms share:

- **Identity Registry** (DIM proof-of-personhood)
- **Treasury** (pooled capital, yield distribution)
- **Governance System** (proposals, votes, outcomes)
- **Content Registries** (claims, signals, verdicts)
- **Reputation System** (portable across platforms)

The difference is the **interface and workflow**, not the data or rules.

---

## 4. Platform 1: Cocuyo (Citizen Platform)

### 4.1 Progressive Disclosure UX

Complexity is revealed as user engagement deepens:

#### Level 1 — Reader (no account required)

- Browse Alliance news feed
- Read posts, stories, and fact-check verdicts
- View outlet profiles and collective methodologies
- See public treasury dashboard (TVL, outlets funded, impact)

#### Level 2 — Firefly (verified human, free)

- Complete proof-of-personhood (DIM attestation, crypto-optional)
- Create posts, comment, share
- Submit Signals (evidence) on open Claims
- Join or follow Collectives
- Personalized feed based on followed outlets

#### Level 3 — Contributor (crowdstacking participant)

- Contribute to pooled capital base (fiat or crypto)
- View position: amount, accrued yield, time in pool
- Set yield allocation preferences (advisory)
- Access contributor-exclusive content
- Enhanced governance weight

#### Level 4 — Governor (active governance)

- Create and vote on proposals
- Delegate voting power
- Participate in Alliance Council elections
- Access detailed treasury analytics
- Join working groups

### 4.2 Core Social Primitives

| Primitive       | Description                                                          | Economic Connection                                          |
| --------------- | -------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Post**        | Primary expression unit (opinions, reporting, commentary)            | Posts by outlets funded by crowdstacking yield               |
| **Claim**       | Explicit truth target extracted from content                         | Can trigger treasury-funded Verification Campaigns           |
| **Signal**      | Evidence supporting/confronting a claim                              | Contributors build reputation → eligibility for micro-grants |
| **Story Chain** | Long-horizon case file accumulating posts/claims/signals/verdicts    | Collective memory — the most valuable long-term asset        |
| **Collective**  | Fact-checking group with transparent methodology                     | Funded through alliance treasury                             |
| **Verdict**     | Determination on claim (confirmed/disputed/false/synthetic/evolving) | Recorded on-chain as "proof of work"                         |

### 4.3 User Actions

The primary action is **illuminate** — not "post," "share," or "submit."

| Action          | Description                           |
| --------------- | ------------------------------------- |
| **Illuminate**  | Create a new post/signal              |
| **Corroborate** | Stake reputation on verification      |
| **Challenge**   | Dispute with counter-evidence         |
| **Contribute**  | Add to crowdstacking pool             |
| **Verify**      | Participate in fact-checking workflow |
| **Govern**      | Vote on proposals                     |

---

## 5. Platform 2: Newsroom OS (Professional Platform)

### 5.1 Target Users

| Persona                      | Description                                                 | Primary Needs                                         |
| ---------------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| **Alliance Outlet**          | Registered newsroom (e.g., a regional independent newsroom) | Treasury, editorial pipeline, analytics, coordination |
| **Fact-Checking Collective** | Verification organization (e.g., a fact-checking org)       | Claim queue, workflow, verdict publishing, reputation |
| **Individual Journalist**    | Freelance or affiliated professional                        | Signal tools, campaign participation, collaboration   |

### 5.2 Core Modules

#### Treasury & Finance

- Organizational multi-sig wallet
- Transaction ledger (inflows/outflows)
- Fiat off-ramp (convert yield to local currency)
- Budget allocation and tagging
- Sustainability score indicator

#### Editorial & Publishing

- Publishing pipeline with CMS integration (WordPress, Ghost)
- Cross-promotion tools
- Content analytics and comparative benchmarks
- Impact metrics (articles, fact-checks, citations)

#### Verification Workbench

- Claim queue (community submissions + AI flagging)
- Structured workflow: claim → evidence → peer review → verdict → publish
- On-chain attestation of verdicts
- Collaboration tools (invite co-verifiers, share evidence)
- Methodology documentation

#### Campaign Manager

- **Verification Campaigns**: Fund specific investigations from treasury
- **Crowdstacking Campaigns**: Attract new contributors
- **Cross-Campaigns**: Supporters fund specific investigations via yield allocation

#### Alliance Governance

- Create/draft/submit proposals
- Vote on active proposals
- Alliance Council access
- Dispute resolution interface

---

## 6. Crowdstacking Economics

### 6.1 Why Crowdstacking > Subscriptions

| Dimension              | Web2 Subscription                                | Crowdstacking                                              |
| ---------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| **What you pay**       | Monthly fee ($5-15) that disappears              | Contribution to pooled capital; principal preserved        |
| **What you get**       | Access behind paywall; stop paying → lose access | Full access (always free) + governance + exclusive content |
| **Where money goes**   | Server costs, executive salaries, platform rent  | Professionally invested; yield funds operations            |
| **Who benefits**       | One outlet; if it folds, money gone              | Alliance of outlets; diversified risk                      |
| **Infrastructure**     | Fund Big Tech cloud (they own the kill switch)   | Fund unstoppable infrastructure (Polkadot, IPFS)           |
| **Your role**          | Consumer                                         | Stakeholder                                                |
| **Information access** | Paywalled privilege                              | Public good                                                |

### 6.2 Capital Flow

```
Contributor → Pooled Capital Base → Professional Investment Management
                                            |
                                    Investment Yield
                                            |
                        ┌───────────────────┼───────────────────┐
                        │                   │                   │
                Alliance Outlets    Verification Campaigns    Infrastructure
                (operating income)  (fact-checking work)      (platform costs)
                        │                   │                   │
                    Journalism          Verdicts &           Unstoppable
                    & Reporting         Collective Memory    System
                        │                   │                   │
                        └───────────────────┼───────────────────┘
                                            |
                                 Public Access to Truth
                                            |
                                   More Contributors
                                   (reinforcing loop)
```

### 6.3 Contributor Tiers

| Tier           | Contribution | Recognition                                           |
| -------------- | ------------ | ----------------------------------------------------- |
| **Spark**      | $5–$49       | Firefly badge, name on supporters wall                |
| **Flame**      | $50–$499     | Enhanced governance weight, behind-the-scenes content |
| **Beacon**     | $500–$4,999  | Treasury reports newsletter, quarterly town halls     |
| **Lighthouse** | $5,000+      | Founding patron, direct Alliance Council channel      |

**Critical distinction**: Tiers provide **recognition and governance**, never information access. All journalism is free and open.

### 6.4 Contributor Experience

- **Contribute**: Fiat on-ramp (credit card, bank) or crypto; minimum $5
- **Track**: Position, pool value, yield rate, distribution breakdown
- **Influence**: Advisory yield allocation preferences
- **Withdraw**: Any time with transparent cooldown (e.g., 30 days)
- **Return**: Civic — better journalism, verified information, governance voice (not financial yield for self)

---

## 7. Governance Model

### 7.1 Two-Layer Governance

#### Epistemic Governance (Truth Layer)

- **Participants**: Collectives, fact-checkers, journalists, engaged Fireflies
- **Governs**: Verdicts, collective methodology, signal quality standards, content moderation
- **Authority earned by**: Methodology track record, evidence quality, peer review

#### Economic Governance (Capital Layer)

- **Participants**: Contributors (weighted), Alliance Council, outlet representatives
- **Governs**: Yield allocation, outlet membership, treasury strategy, infrastructure priorities
- **Authority earned by**: Contribution duration + personhood + delegation

### 7.2 Governance Bodies

| Body                     | Composition                                                         | Authority                                               |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------- |
| **Alliance Council**     | Elected reps from all Genesis categories                            | Treasury, membership, infrastructure, standards         |
| **Collectives Assembly** | All recognized Collectives, weighted by track record                | Verification standards, verdict taxonomy, accreditation |
| **Stewardship Court**    | Rotating panel (2 Council + 2 Assembly + 1 independent)             | Dispute resolution (binding)                            |
| **Contributor Assembly** | All contributors, weighted by duration + personhood + participation | Ratify major decisions, advisory yield allocation       |

### 7.3 Core Principles

1. **Epistemic authority cannot be bought** — No amount of capital influences verdicts
2. **Economic authority earned by commitment, not wealth** — Duration matters more than size
3. **All decisions recorded on-chain** — Transparency non-negotiable
4. **Progressive decentralization** — Start multisig → evolve to full on-chain
5. **Separation of powers** — Distinct, non-overlapping authority domains

### 7.4 Decision Flow

```
Proposal Created → Proposal Type?
                        │
        ┌───────────────┼───────────────┐
        │               │               │
   Epistemic       Economic        Mixed/Dispute
        │               │               │
        ▼               ▼               ▼
   Collectives     Alliance       Stewardship
   Assembly        Council        Court
        │               │               │
        │         If major:             │
        │         Contributor           │
        │         Assembly              │
        │         ratification          │
        └───────────────┼───────────────┘
                        │
                        ▼
              On-Chain Record
              (immutable audit trail)
```

---

## 8. Reputation System

### 8.1 Reputation Dimensions

| Dimension                   | How Earned                                   | What It Unlocks                            |
| --------------------------- | -------------------------------------------- | ------------------------------------------ |
| **Signal Quality**          | Evidence cited in verdicts, peer-reviewed    | Higher visibility, campaign eligibility    |
| **Collective Track Record** | Verdicts that hold up, consistently cited    | Higher treasury share, epistemic weight    |
| **Civic Participation**     | Voting, contributing signals, working groups | Governance multiplier, Council eligibility |
| **Contribution History**    | Duration and consistency (not amount)        | Economic governance weight                 |

### 8.2 Anti-Gaming Principles

- **No staking on truth**: Reputation from evidence/methodology, not capital
- **Time-weighted**: Duration > size (prevents plutocracy)
- **Methodology over volume**: 10 rigorous verdicts > 100 shallow ones
- **Decay**: Slow decay on inactivity (keeps system alive)
- **Transparency**: All scores and calculations public

---

## 9. Technical Architecture

### 9.1 System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER INTERFACES                          │
│                                                                  │
│   ┌─────────────────────┐     ┌─────────────────────────────┐   │
│   │      Cocuyo          │     │       Newsroom OS           │   │
│   │  (Citizens/Supporters)│    │  (Outlets/Collectives)      │   │
│   └──────────┬───────────┘     └──────────────┬──────────────┘   │
│              │                                │                  │
└──────────────┼────────────────────────────────┼──────────────────┘
               │                                │
┌──────────────▼────────────────────────────────▼──────────────────┐
│                     SHARED SERVICE LAYER                         │
│                                                                  │
│   ┌────────────┐  ┌─────────────┐  ┌────────────┐  ┌─────────┐  │
│   │  Identity   │  │  Governance  │  │  Treasury   │  │ Content │  │
│   │  Service    │  │  Service     │  │  Service    │  │ Service │  │
│   │            │  │             │  │            │  │         │  │
│   │  DIM PoP   │  │  Proposals  │  │  Pool mgmt │  │ Posts   │  │
│   │  Pseudonym │  │  Voting     │  │  Yield calc│  │ Claims  │  │
│   │  Disclosure│  │  Delegation │  │  Fiat ramp │  │ Signals │  │
│   └─────┬──────┘  └──────┬──────┘  └─────┬──────┘  └────┬────┘  │
└─────────┼────────────────┼───────────────┼──────────────┼───────┘
          │                │               │              │
┌─────────▼────────────────▼───────────────▼──────────────▼───────┐
│                     INTEGRITY LAYER (Polkadot)                   │
│                                                                  │
│   DIM Registry  │  Governance Ledger  │  Treasury Contracts      │
│   Bulletin Chain (Claims/Signals/Verdicts)                       │
│   IPFS / Arweave (permanent archival)                            │
└──────────────────────────────────────────────────────────────────┘
```

### 9.2 On-Chain / Off-Chain Split

| Layer                                      | Location                      | Rationale                                  |
| ------------------------------------------ | ----------------------------- | ------------------------------------------ |
| **Identity** (PoP, pseudonymity)           | Polkadot (DIM)                | Sybil resistance, censorship-resistant     |
| **Treasury** (pool, yield, contributions)  | Polkadot + EVM contracts      | Transparent, auditable, non-custodial      |
| **Governance** (proposals, votes)          | Polkadot-native               | Tamper-proof, progressive decentralization |
| **Registries** (claims, signals, verdicts) | Bulletin Chain + IPFS/Arweave | Censorship-resistant collective memory     |
| **Social feeds, media, UX**                | Off-chain                     | Speed, Web2-grade experience               |
| **Publishing pipeline, analytics**         | Off-chain (Newsroom OS)       | CMS integration, professional workflows    |

### 9.3 Technology Stack

| Layer            | Technology                                                          |
| ---------------- | ------------------------------------------------------------------- |
| **Frontend**     | Next.js 15+ (App Router), TypeScript, Tailwind CSS                  |
| **Localization** | next-intl (EN, ES-LatAm, PT-BR roadmap)                             |
| **Identity**     | DIM proof-of-personhood, crypto-optional UX                         |
| **Treasury**     | EVM-compatible contracts for contributions, Polkadot for governance |
| **Content**      | Off-chain for speed, on-chain for integrity                         |
| **Storage**      | IPFS + Arweave for permanent archival                               |
| **Hosting**      | Triangle (decentralized) + conventional CDN fallback                |
| **Interop**      | XCM (Polkadot), bridges for EVM ecosystems                          |

### 9.4 "Unstoppable" Infrastructure

| Threat                        | Mitigation                                           |
| ----------------------------- | ---------------------------------------------------- |
| **Bank freeze**               | Capital in decentralized, non-custodial contracts    |
| **Platform de-platforming**   | Content mirrored to IPFS/Arweave; owned social layer |
| **Algorithm suppression**     | Community-governed feed, not engagement-maximizing   |
| **Government shutdown order** | Claims/signals/verdicts anchored on Polkadot         |
| **Corporate acquisition**     | Governed by participants, not shareholders           |

---

## 10. Genesis Alliance & Launch

### 10.1 Genesis Alliance Composition

| Category                        | Role                             | Examples                                   |
| ------------------------------- | -------------------------------- | ------------------------------------------ |
| **Independent News Outlets**    | Content, audience, credibility   | Regional independent newsrooms             |
| **Fact-Checking Organizations** | Verification, methodology        | Established fact-checking orgs             |
| **Journalism Organizations**    | Legitimacy, advocacy, standards  | Journalism networks and press-freedom NGOs |
| **Tech Foundations**            | Infrastructure, decentralization | Web3/decentralization foundations          |
| **Academic Institutions**       | Research, training, memory       | Journalism research institutes             |

### 10.2 Genesis Governance

- **Genesis Council**: One rep per founding org, equal weight
- **Mandate**: Governance charter, treasury policy, editorial standards, methodology requirements
- **Sunset**: Transitions to elected Alliance Council within 18 months
- **Progressive decentralization**: Multisig → on-chain governance

### 10.3 Genesis Crowdstacking Campaign

**Narrative**: _"Stop renting the truth. Own the infrastructure that protects it."_

**Mechanics**:

- Fiat on-ramp (critical for LatAm) + crypto on-ramp
- Minimum contribution: $5
- Transparent dashboard: real-time TVL, contributors, yield projections
- Tier recognition (Spark → Lighthouse)

**Targets**:

_(illustrative targets, not commitments)_

- Year 1: $2M–$5M pooled capital
- Year 1: 10,000–25,000 contributors

### 10.4 Roadmap

_(illustrative sequencing, not a committed timeline)_

| Phase                     | Timeline     | Deliverables                                                |
| ------------------------- | ------------ | ----------------------------------------------------------- |
| **Phase 0: Genesis**      | Months 1–3   | Assemble alliance, draft charter, finalize architecture     |
| **Phase 1: Foundation**   | Months 4–8   | Cocuyo MVP, Genesis Campaign, identity + treasury contracts |
| **Phase 2: Verification** | Months 9–14  | Collectives, Workbench, Newsroom OS MVP, on-chain verdicts  |
| **Phase 3: Governance**   | Months 15–18 | Elected Council, on-chain governance, Stewardship Court     |
| **Phase 4: Scale**        | Months 19–24 | 20+ outlets, PT-BR localization, Story Chains, VaaS API     |

---

## 11. Success Metrics

_(illustrative targets, not commitments)_

| Metric                           | Year 1 Target             | Year 3 Target             | Why It Matters                      |
| -------------------------------- | ------------------------- | ------------------------- | ----------------------------------- |
| **Pooled capital (TVL)**         | $2M–$5M                   | $20M–$50M                 | Foundation of the model             |
| **Active contributors**          | 10,000–25,000             | 100,000–250,000           | Network resilience, diversification |
| **Alliance outlets**             | 5–10                      | 20–30                     | Coverage and credibility            |
| **Active Collectives**           | 3–5                       | 15–20                     | Verification capacity               |
| **Verdicts issued**              | 100–300                   | 1,000–3,000               | "Proof of work" of epistemic layer  |
| **Yield coverage ratio**         | 10–15% of operating costs | 30–50% of operating costs | Path to sustainability              |
| **Contributor retention (12mo)** | 60%+                      | 75%+                      | Model stickiness                    |

---

## Appendices

### A. Campaign Taxonomy

| Type                       | Purpose                                | Initiated By                               | Funded By                    | Deliverables                           |
| -------------------------- | -------------------------------------- | ------------------------------------------ | ---------------------------- | -------------------------------------- |
| **Verification Campaign**  | Fund specific investigation            | Collectives/outlets                        | Treasury (yield)             | Evidence, verdict, story chain update  |
| **Crowdstacking Campaign** | Attract contributors                   | Council/outlets                            | N/A (generates funding)      | Contributors onboarded, capital pooled |
| **Cross-Campaign**         | Supporters fund specific investigation | Outlet proposes; contributors direct yield | Contributor yield allocation | Investigation per methodology          |

### B. Design Principles

| Principle                        | Description                                          |
| -------------------------------- | ---------------------------------------------------- |
| **Non-extractive**               | Users earn civic return; no subscription fees        |
| **Progressive decentralization** | Multisig → full on-chain DAO                         |
| **Crypto-optional UX**           | Fiat on-ramp + custodial wallet for non-crypto users |
| **Censorship resilience**        | IPFS/Arweave mirrors; ENS/Unstoppable domains        |
| **Privacy-first**                | No mandatory KYC; ZK proofs for personhood           |

### C. Glossary

| Term              | Definition                                                                   |
| ----------------- | ---------------------------------------------------------------------------- |
| **Firefly**       | A verified human participant in the network                                  |
| **Signal**        | Evidence supporting or confronting a claim                                   |
| **Story Chain**   | Long-horizon case file accumulating posts/claims/signals/verdicts            |
| **Corroboration** | Structured, reputation-staked act of verification                            |
| **Crowdstacking** | Pooled capital model where principal is preserved and yield funds operations |
| **Illuminate**    | Primary user action (create content/signal)                                  |
| **DIM**           | Decentralized Identity Module for proof-of-personhood                        |

### D. References

- [Efecto Cocuyo - Wikipedia](https://en.wikipedia.org/wiki/Efecto_Cocuyo)
- [Reuters Institute - How a respected editor created independent news in Venezuela](https://reutersinstitute.politics.ox.ac.uk/news/how-respected-editor-created-independent-news-venezuela)
- [Reuters Institute - Journalism, Media, and Technology Trends 2026](https://reutersinstitute.politics.ox.ac.uk/journalism-media-and-technology-trends-and-predictions-2026)
- [GIJN - Creating an Independent News Site in Crisis-Hit Venezuela](https://gijn.org/stories/independent-news-venezuela/)
- [Reuters Institute - Exiled Venezuelan journalists joining forces](https://reutersinstitute.politics.ox.ac.uk/news/these-are-exiled-venezuelan-journalists-joining-forces-report-maduros-ouster-afar)

---

> _"Every firefly is a light. Together, they illuminate a nation."_
