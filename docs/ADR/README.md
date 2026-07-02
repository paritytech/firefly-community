# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Firefly Network project.

## What is an ADR?

An ADR is a document that captures an important architectural decision made along with its context and consequences.

## When to Create an ADR

Create an ADR when you're making a decision that:

- Affects the structure of the codebase
- Has long-term implications
- Involves significant tradeoffs
- Would be non-obvious to future developers
- Changes how components interact

## ADR Format

Each ADR follows this structure:

1. **Title** — Short descriptive title
2. **Status** — Proposed, Accepted, Deprecated, or Superseded
3. **Context** — Why we need to make this decision
4. **Decision** — What we decided to do
5. **Consequences** — What happens as a result (positive, negative, neutral)

## Creating a New ADR

1. Copy `000-template.md` to `NNN-title.md` (use the next number)
2. Fill in the sections
3. Submit a PR for review
4. Update status to "Accepted" when merged

## Index

| ADR                                              | Title                                  | Status   |
| ------------------------------------------------ | -------------------------------------- | -------- |
| [000](./000-template.md)                         | Template                               | —        |
| [001](./001-pusd-integration.md)                 | pUSD Stablecoin Integration            | Proposed |
| [002](./002-coinage-integration.md)              | Coinage (Private Payments) Integration | Proposed |
| [003](./003-hybrid-evm-polkadot-architecture.md) | Hybrid EVM/Polkadot Architecture       | Accepted |
| [006](./006-ux-rework-posts.md)                  | UX Rework — Single Conscious Creation  | Accepted |

## References

- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) — Michael Nygard
- [ADR GitHub Organization](https://adr.github.io/)
