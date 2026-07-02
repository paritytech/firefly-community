/**
 * AllianceGovernance Contract Client
 *
 * Provides a typed interface to the AllianceGovernance smart contract.
 * Handles proposal creation, voting, and execution.
 */

import type { PolkadotSigner } from 'polkadot-api';
import type {
  AllianceProposal,
  AllianceProposalType,
  AllianceProposalStatus,
  AllianceVoteTally,
  AllianceVoteDecision,
  AllianceGovernanceConfig,
  PoolId,
  PolkadotAddress,
  TransactionHash,
  ContributorTier,
} from '@cocuyo/types';
import {
  createPoolId,
  createTransactionHash,
  deriveCredentialFromString,
  DEFAULT_ALLIANCE_GOVERNANCE,
} from '@cocuyo/types';
import { callContract, sendContractTx, type HexString } from '../revive';
import { requireContractAddress } from '../config';
import { toH160, deriveH160 } from '@/lib/utils/address';
import {
  encodePropose,
  encodeCastVote,
  encodeCastVoteWithReason,
  encodeExecute,
  encodeCancel,
  encodeGetProposal,
  decodeGetProposal,
  encodeState,
  decodeState,
  encodeHasVoted,
  decodeHasVoted,
  encodeGetVotingPower,
  decodeGetVotingPower,
  encodeGetConfig,
  decodeGetConfig,
  encodeProposalCount,
  decodeProposalCount,
  encodeOutletAddPayload,
  encodeOutletRemovePayload,
  encodeWeightChangePayload,
  ProposalType as ContractProposalType,
  ProposalState as ContractProposalState,
  VoteType as ContractVoteType,
  type ContractProposal,
  type ContractProposalConfig,
} from '../abi/alliance-governance';
import { createLogger } from '../../logging';

const logger = createLogger('AllianceGovernanceClient');

// ============================================================
// Types
// ============================================================

export interface GovernanceClientConfig {
  /** Governance contract address */
  readonly governanceAddress: HexString;
}

// ============================================================
// Mappings
// ============================================================

const PROPOSAL_TYPE_MAP: Record<ContractProposalType, AllianceProposalType> = {
  [ContractProposalType.OutletAdd]: 'outlet-add',
  [ContractProposalType.OutletRemove]: 'outlet-remove',
  [ContractProposalType.WeightChange]: 'weight-change',
  [ContractProposalType.ParameterChange]: 'parameter-change',
  [ContractProposalType.Emergency]: 'emergency',
};

const PROPOSAL_TYPE_REVERSE: Record<AllianceProposalType, ContractProposalType> = {
  'outlet-add': ContractProposalType.OutletAdd,
  'outlet-remove': ContractProposalType.OutletRemove,
  'weight-change': ContractProposalType.WeightChange,
  'parameter-change': ContractProposalType.ParameterChange,
  emergency: ContractProposalType.Emergency,
};

const STATE_MAP: Record<ContractProposalState, AllianceProposalStatus> = {
  [ContractProposalState.Pending]: 'voting',
  [ContractProposalState.Active]: 'voting',
  [ContractProposalState.Succeeded]: 'approved',
  [ContractProposalState.Defeated]: 'rejected',
  [ContractProposalState.Expired]: 'expired',
  [ContractProposalState.Executed]: 'executed',
  [ContractProposalState.Cancelled]: 'rejected',
};

const VOTE_TYPE_REVERSE: Record<AllianceVoteDecision, ContractVoteType> = {
  approve: ContractVoteType.For,
  reject: ContractVoteType.Against,
  abstain: ContractVoteType.Abstain,
};

// ============================================================
// Client Implementation
// ============================================================

/**
 * Client for interacting with the AllianceGovernance contract.
 */
export class AllianceGovernanceClient {
  private readonly governanceAddress: HexString;

  constructor(config?: Partial<GovernanceClientConfig>) {
    this.governanceAddress =
      config?.governanceAddress ?? requireContractAddress('allianceGovernance');

    logger.debug('Governance client initialized', 'constructor', {
      governanceAddress: this.governanceAddress,
    });
  }

  // ============================================================
  // Read Operations
  // ============================================================

  /**
   * Get a proposal by ID.
   */
  async getProposal(proposalId: string): Promise<AllianceProposal | null> {
    try {
      const numericId = this.parseProposalId(proposalId);
      const calldata = encodeGetProposal(numericId) as HexString;

      const result = await callContract({
        contract: this.governanceAddress,
        calldata,
      });

      const proposal = decodeGetProposal(result);

      if (proposal.id === 0n) {
        return null;
      }

      return this.mapContractProposal(proposal);
    } catch (error) {
      logger.warn('Failed to get proposal', 'getProposal', { proposalId, error });
      return null;
    }
  }

  /**
   * Get the current state of a proposal.
   */
  async getProposalState(proposalId: string): Promise<AllianceProposalStatus> {
    const numericId = this.parseProposalId(proposalId);
    const calldata = encodeState(numericId) as HexString;

    const result = await callContract({
      contract: this.governanceAddress,
      calldata,
    });

    const state = decodeState(result);
    return STATE_MAP[state];
  }

  /**
   * Get voting power for an address on a proposal.
   */
  async getVotingPower(address: PolkadotAddress, proposalId: string): Promise<number> {
    const h160 = toH160(address);
    const numericId = this.parseProposalId(proposalId);
    const calldata = encodeGetVotingPower(h160, numericId) as HexString;

    const result = await callContract({
      contract: this.governanceAddress,
      calldata,
    });

    return Number(decodeGetVotingPower(result));
  }

  /**
   * Check if an address has voted on a proposal.
   */
  async hasVoted(proposalId: string, address: PolkadotAddress): Promise<boolean> {
    const h160 = toH160(address);
    const numericId = this.parseProposalId(proposalId);
    const calldata = encodeHasVoted(numericId, h160) as HexString;

    const result = await callContract({
      contract: this.governanceAddress,
      calldata,
    });

    return decodeHasVoted(result);
  }

  /**
   * Get quorum requirements for a proposal.
   */
  async getQuorum(proposalId: string): Promise<{ required: number; current: number }> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) {
      return { required: 0, current: 0 };
    }

    const config = await this.getConfig(proposal.proposalType);
    // Sum the real aggregate tally when present (chain proposals carry no
    // per-voter `votes`); otherwise fall back to summing individual ballots.
    const currentWeight = proposal.voteTally
      ? proposal.voteTally.approve + proposal.voteTally.reject + proposal.voteTally.abstain
      : proposal.votes.reduce((sum, v) => sum + v.weight, 0);

    return {
      required: config?.quorumRequirement ?? 0,
      current: currentWeight,
    };
  }

  /**
   * Get the total number of proposals.
   */
  async getProposalCount(): Promise<number> {
    const calldata = encodeProposalCount() as HexString;

    const result = await callContract({
      contract: this.governanceAddress,
      calldata,
    });

    return Number(decodeProposalCount(result));
  }

  /**
   * Get governance configuration for a proposal type.
   */
  async getConfig(proposalType: AllianceProposalType): Promise<AllianceGovernanceConfig | null> {
    try {
      const contractType = PROPOSAL_TYPE_REVERSE[proposalType];
      const calldata = encodeGetConfig(contractType) as HexString;

      const result = await callContract({
        contract: this.governanceAddress,
        calldata,
      });

      const config = decodeGetConfig(result);
      return this.mapContractConfig(config, createPoolId('main'));
    } catch (error) {
      logger.warn('Failed to get config', 'getConfig', { proposalType, error });
      return null;
    }
  }

  // ============================================================
  // Write Operations
  // ============================================================

  /**
   * Create a new proposal.
   */
  async createProposal(
    proposalType: AllianceProposalType,
    payload: string,
    description: string,
    signer: PolkadotSigner
  ): Promise<{ proposalId: string; txHash: TransactionHash }> {
    logger.info('Creating proposal', 'createProposal', { proposalType, description });

    const contractType = PROPOSAL_TYPE_REVERSE[proposalType];
    const calldata = encodePropose(contractType, payload, description) as HexString;

    const result = await sendContractTx({
      contract: this.governanceAddress,
      calldata,
      signer,
    });

    // The authoritative new id is `proposalId` returned by `propose()` /
    // emitted in `ProposalCreated`. `sendContractTx` exposes neither return data
    // nor event logs, so we cannot read it directly. The contract assigns ids as
    // `++proposalCount` (1-indexed, sequential), so post-tx `proposalCount()`
    // equals our new id — UNLESS another proposal was created concurrently
    // between our tx and this read, which would shift the count.
    //
    // To avoid silently returning a racy/wrong id, we VERIFY the candidate: read
    // the proposal at that id and confirm its on-chain `proposer` is this caller.
    // On mismatch we FAIL CLOSED rather than hand back someone else's proposal.
    const candidateId = await this.getProposalCount();
    const proposalId = `proposal-${candidateId}`;
    const expectedProposer = deriveH160(signer.publicKey).toLowerCase();

    // Read the raw on-chain proposal at the candidate id and compare its stored
    // `proposer` (an H160) against the caller's derived EVM address.
    const verifyCalldata = encodeGetProposal(BigInt(candidateId)) as HexString;
    const verifyResult = await callContract({
      contract: this.governanceAddress,
      calldata: verifyCalldata,
    });
    const created = decodeGetProposal(verifyResult);

    if (created.id === 0n) {
      throw new Error(
        `Proposal submitted, but could not confirm its id: no proposal found at ${proposalId}. ` +
          'Confirming the id requires event-log indexing of ProposalCreated.'
      );
    }

    if (created.proposer.toLowerCase() !== expectedProposer) {
      throw new Error(
        `Proposal submitted, but its id could not be confirmed: proposal ${proposalId} was ` +
          'created by a different account (likely a concurrent proposal). Re-query the chain ' +
          'to locate your proposal — confirming the id requires ProposalCreated event indexing.'
      );
    }

    return {
      proposalId,
      txHash: createTransactionHash(result.txHash),
    };
  }

  /**
   * Cast a vote on a proposal.
   */
  async castVote(
    proposalId: string,
    decision: AllianceVoteDecision,
    signer: PolkadotSigner,
    rationale?: string
  ): Promise<TransactionHash> {
    logger.info('Casting vote', 'castVote', { proposalId, decision });

    const numericId = this.parseProposalId(proposalId);
    const voteType = VOTE_TYPE_REVERSE[decision];

    const calldata =
      rationale !== undefined && rationale !== ''
        ? (encodeCastVoteWithReason(numericId, voteType, rationale) as HexString)
        : (encodeCastVote(numericId, voteType) as HexString);

    const result = await sendContractTx({
      contract: this.governanceAddress,
      calldata,
      signer,
    });

    return createTransactionHash(result.txHash);
  }

  /**
   * Execute a successful proposal.
   */
  async executeProposal(proposalId: string, signer: PolkadotSigner): Promise<TransactionHash> {
    logger.info('Executing proposal', 'executeProposal', { proposalId });

    const numericId = this.parseProposalId(proposalId);
    const calldata = encodeExecute(numericId) as HexString;

    const result = await sendContractTx({
      contract: this.governanceAddress,
      calldata,
      signer,
    });

    return createTransactionHash(result.txHash);
  }

  /**
   * Cancel a proposal.
   */
  async cancelProposal(proposalId: string, signer: PolkadotSigner): Promise<TransactionHash> {
    logger.info('Cancelling proposal', 'cancelProposal', { proposalId });

    const numericId = this.parseProposalId(proposalId);
    const calldata = encodeCancel(numericId) as HexString;

    const result = await sendContractTx({
      contract: this.governanceAddress,
      calldata,
      signer,
    });

    return createTransactionHash(result.txHash);
  }

  // ============================================================
  // Payload Helpers
  // ============================================================

  /**
   * Encode an outlet add payload.
   */
  encodeOutletAdd(outletId: string, treasury: HexString, weight: bigint): string {
    return encodeOutletAddPayload(outletId, treasury, weight);
  }

  /**
   * Encode an outlet remove payload.
   */
  encodeOutletRemove(outletId: string): string {
    return encodeOutletRemovePayload(outletId);
  }

  /**
   * Encode a weight change payload.
   */
  encodeWeightChange(outletIds: string[], weights: bigint[]): string {
    return encodeWeightChangePayload(outletIds, weights);
  }

  // ============================================================
  // Helpers
  // ============================================================

  /**
   * Parse a proposal ID string to numeric value.
   */
  private parseProposalId(proposalId: string): bigint {
    const numeric = proposalId.replace('proposal-', '').replace('alliance-proposal-', '');
    const parsed = parseInt(numeric, 10);
    if (isNaN(parsed)) {
      // Try to extract any number from the string
      const match = /\d+/.exec(numeric);
      if (match) {
        return BigInt(match[0]);
      }
      throw new Error(`Invalid proposal ID: ${proposalId}`);
    }
    return BigInt(parsed);
  }

  /**
   * Map contract proposal to domain type.
   */
  private mapContractProposal(proposal: ContractProposal): AllianceProposal {
    const proposalType = PROPOSAL_TYPE_MAP[proposal.proposalType];

    // We do NOT synthesize per-voter ballots from the aggregate counts: the
    // contract exposes only running for/against/abstain weight totals, not the
    // individual voters (those require event-log indexing of VoteCast). Carry
    // the real aggregate weights as `voteTally` and leave `votes` empty rather
    // than inventing zero-address voters with `Date.now()` timestamps.
    const voteTally: AllianceVoteTally = {
      approve: Number(proposal.forVotes),
      reject: Number(proposal.againstVotes),
      abstain: Number(proposal.abstainVotes),
    };

    const status: AllianceProposalStatus = proposal.executed
      ? 'executed'
      : proposal.cancelled
        ? 'rejected'
        : 'voting';

    const result: AllianceProposal = {
      id: `proposal-${proposal.id}`,
      poolId: createPoolId('main'),
      proposalType,
      proposedBy: deriveCredentialFromString(proposal.proposer),
      proposerTier: 'beacon' as ContributorTier, // Minimum for proposal
      // Title/description live only in the ProposalCreated event, which we cannot
      // read without an indexer. Leave them empty (honest-unknown) rather than
      // fabricating prose; `title` falls back to the id for display.
      title: `Proposal #${proposal.id}`,
      description: '',
      // The on-chain `payload` is raw ABI-encoded bytes whose concrete typed
      // shape we cannot reconstruct here without decoding per proposal type, so
      // we leave it undefined (honest-unknown) rather than asserting an
      // incomplete `{ type }` object via `as`. The proposal type is still
      // exposed via `proposalType` above.
      votes: [],
      voteTally,
      minVotingTier: 'spark' as ContributorTier,
      quorumRequired: DEFAULT_ALLIANCE_GOVERNANCE.quorumRequirement,
      approvalThreshold: DEFAULT_ALLIANCE_GOVERNANCE.approvalThreshold,
      status,
      // The contract stores voting bounds as block numbers, not timestamps, and
      // we have no reliable block-time conversion on-host. Marking these 0
      // (epoch) signals "unknown" to the UI rather than fabricating a plausible
      // wall-clock window from a hardcoded ~12s/block guess.
      createdAt: 0,
      expiresAt: 0,
    };

    // Only add finalizedAt if the proposal is finalized. The exact finalization
    // time is not on-chain in a readable form, so we omit it rather than stamp
    // Date.now(); the boolean status already conveys "finalized".
    return result;
  }

  /**
   * Map contract config to domain type.
   */
  private mapContractConfig(
    config: ContractProposalConfig,
    poolId: PoolId
  ): AllianceGovernanceConfig {
    return {
      poolId,
      minProposalTier: 'beacon' as ContributorTier,
      minVotingTier: 'spark' as ContributorTier,
      defaultVotingDuration: Number(config.votingPeriod) * 12, // Blocks to seconds (12s per block)
      quorumRequirement: Number(config.quorum),
      approvalThreshold: Number(config.threshold) / 100, // Convert from basis points
      executionDelay: Number(config.executionDelay) * 12, // Blocks to seconds
      emergencyApprovalThreshold: 80, // 80% for emergency (percentage, not decimal)
      emergencyExecutionDelay: (Number(config.executionDelay) * 12) / 4, // Faster for emergency
    };
  }
}

// ============================================================
// Singleton Export
// ============================================================

let clientInstance: AllianceGovernanceClient | null = null;

/**
 * Get the governance client singleton.
 */
export function getAllianceGovernanceClient(): AllianceGovernanceClient {
  clientInstance ??= new AllianceGovernanceClient();
  return clientInstance;
}
