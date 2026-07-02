# ADR-003: Hybrid EVM/Polkadot Architecture

## Status

Accepted

## Context

The Firefly Network (Cocuyo) is built primarily on the Polkadot ecosystem, leveraging:

- **DIM** for proof-of-personhood identity verification
- **Bulletin Chain** for censorship-resistant content storage
- **Triangle SDK** for wallet integration and hosting

However, certain features require smart contract functionality that benefits from EVM compatibility:

- **Bounty Escrow**: Holds funds and distributes payouts based on contribution verification
- **Firefly Reputation**: On-chain reputation scores across topic domains

## Decision

We adopt a **hybrid architecture** that uses:

1. **Polkadot stack** for identity, content storage, and governance:
   - `@polkadot/util-crypto` for cryptographic operations
   - `@polkadot-apps/bulletin` for decentralized storage
   - `@novasamatech/product-sdk` for Triangle host integration
   - DIM credentials for proof-of-personhood

2. **EVM-compatible contracts** for financial and reputation logic:
   - `ethers.js` for contract interaction
   - Solidity contracts deployed to EVM-compatible chains (initially Paseo testnet)
   - Hardhat for contract development and testing

This is an **explicit exception** to the project's general guideline of preferring Polkadot-native libraries over `ethers.js` because:

- Polkadot's Asset Hub and parachains increasingly support EVM compatibility
- EVM contracts provide battle-tested patterns for escrow and token logic
- The financial contracts benefit from EVM's mature tooling and audit ecosystem
- Future migration to ink! contracts remains possible without changing the service layer

## Consequences

### Positive

- Faster development using mature EVM tooling
- Access to audited contract patterns (OpenZeppelin)
- Compatibility with EVM-based Polkadot parachains (Moonbeam, Astar)
- Clear separation: Polkadot for identity/content, EVM for financial logic

### Negative

- Two different Web3 stacks to maintain
- Users may need to bridge assets between chains
- Slightly increased bundle size from ethers.js dependency

### Mitigations

- Service layer abstracts contract details from UI
- Contract interfaces are minimal and focused
- Migration path to ink! documented in contracts package

## Files Affected

- `/apps/web/src/hooks/useBountyEscrow.ts` - EVM contract interaction
- `/apps/web/src/hooks/useFireflyReputation.ts` - EVM contract interaction
- `/packages/contracts/` - Solidity contracts with Hardhat

## References

- [Polkadot EVM Compatibility](https://wiki.polkadot.network/docs/learn-evm)
- [Moonbeam Documentation](https://docs.moonbeam.network/)
