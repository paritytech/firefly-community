/**
 * Alliance Governance types — crowdstacking-specific governance.
 *
 * Extends the standard governance pattern for Alliance-specific proposals:
 * - Outlet additions and removals
 * - Allocation weight changes
 * - Pool parameter modifications
 * - Emergency actions
 *
 * Voting weight is determined by contributor tier, not organization role.
 */

import type { DIMCredential, OutletId, PolkadotAddress, TreasuryId } from './brands';
import type { PoolId, ContributorTier, OutletAllocation } from './crowdstacking';

// ============================================================================
// Proposal Types
// ============================================================================

/**
 * Types of Alliance governance proposals.
 */
export type AllianceProposalType =
  | 'outlet-add' // Add a new outlet to receive funding
  | 'outlet-remove' // Remove an outlet from the registry
  | 'weight-change' // Modify allocation weights
  | 'parameter-change' // Change pool parameters
  | 'emergency'; // Emergency actions (pause, unpause, etc.)

/**
 * Status of an Alliance proposal.
 */
export type AllianceProposalStatus =
  | 'voting' // Active voting period
  | 'approved' // Passed but not yet executed
  | 'rejected' // Failed to pass
  | 'expired' // Voting period ended without quorum
  | 'executed'; // Successfully executed

// ============================================================================
// Proposal Payloads (Discriminated Union)
// ============================================================================

/**
 * Payload for adding a new outlet.
 */
export interface OutletAddPayload {
  readonly type: 'outlet-add';
  /** Outlet identifier */
  readonly outletId: OutletId;
  /** Human-readable name */
  readonly outletName: string;
  /** Treasury address for receiving funds */
  readonly treasury: TreasuryId;
  /** Initial allocation weight (basis points) */
  readonly initialWeight: number;
  /** Justification for adding this outlet */
  readonly rationale: string;
}

/**
 * Payload for removing an outlet.
 */
export interface OutletRemovePayload {
  readonly type: 'outlet-remove';
  /** Outlet to remove */
  readonly outletId: OutletId;
  /** Reason for removal */
  readonly reason: string;
  /** How to redistribute the weight (optional) */
  readonly redistributeTo?: readonly {
    readonly outletId: OutletId;
    readonly additionalWeight: number;
  }[];
}

/**
 * Payload for changing allocation weights.
 */
export interface WeightChangePayload {
  readonly type: 'weight-change';
  /** New weights for each outlet */
  readonly newWeights: readonly {
    readonly outletId: OutletId;
    readonly weight: number;
  }[];
  /** Reason for the weight change */
  readonly rationale: string;
}

/**
 * Pool parameter that can be changed.
 */
export type PoolParameter =
  | 'withdrawalCooldown'
  | 'minContribution'
  | 'distributionFrequency'
  | 'yieldStrategy';

/**
 * Payload for changing pool parameters.
 */
export interface ParameterChangePayload {
  readonly type: 'parameter-change';
  /** Parameter being changed */
  readonly parameter: PoolParameter;
  /** Current value (for context) */
  readonly oldValue: string | number;
  /** Proposed new value */
  readonly newValue: string | number;
  /** Justification for the change */
  readonly rationale: string;
}

/**
 * Emergency action types.
 */
export type EmergencyAction =
  | 'pause-pool' // Halt all pool operations
  | 'unpause-pool' // Resume pool operations
  | 'pause-distributions' // Halt distributions only
  | 'resume-distributions' // Resume distributions
  | 'emergency-withdrawal'; // Allow immediate withdrawals (crisis mode)

/**
 * Payload for emergency actions.
 */
export interface EmergencyPayload {
  readonly type: 'emergency';
  /** Emergency action to take */
  readonly action: EmergencyAction;
  /** Detailed explanation of the emergency */
  readonly description: string;
  /** Duration in seconds (for temporary actions) */
  readonly duration?: number;
}

/**
 * Union of all Alliance proposal payloads.
 */
export type AllianceProposalPayload =
  | OutletAddPayload
  | OutletRemovePayload
  | WeightChangePayload
  | ParameterChangePayload
  | EmergencyPayload;

// ============================================================================
// Votes
// ============================================================================

/**
 * Vote decision options.
 */
export type AllianceVoteDecision = 'approve' | 'reject' | 'abstain';

/**
 * A contributor's vote on an Alliance proposal.
 */
export interface AllianceVote {
  /** Who cast this vote (DIM credential) */
  readonly voter: DIMCredential;
  /** Voter's wallet address */
  readonly voterAddress: PolkadotAddress;
  /** The decision */
  readonly decision: AllianceVoteDecision;
  /** Voting weight (tier-based) */
  readonly weight: number;
  /** Voter's tier at time of vote */
  readonly voterTier: ContributorTier;
  /** Optional explanation */
  readonly rationale?: string;
  /** When the vote was cast (Unix timestamp) */
  readonly votedAt: number;
}

/**
 * Aggregate vote weights for a proposal, by decision.
 *
 * Used when the per-voter records in {@link AllianceProposal.votes} are not
 * available — e.g. a proposal read directly from the on-chain governance
 * contract, which exposes only the running for/against/abstain weight totals and
 * not the individual ballots (those require event-log indexing). The numbers are
 * the real on-chain tallies; the individual voters remain genuinely unknown.
 */
export interface AllianceVoteTally {
  /** Total approval (for) weight */
  readonly approve: number;
  /** Total rejection (against) weight */
  readonly reject: number;
  /** Total abstain weight */
  readonly abstain: number;
}

// ============================================================================
// Proposals
// ============================================================================

/**
 * An Alliance governance proposal.
 */
export interface AllianceProposal {
  /** Unique proposal identifier */
  readonly id: string;
  /** Pool this proposal affects */
  readonly poolId: PoolId;
  /** Type of proposal */
  readonly proposalType: AllianceProposalType;
  /** Who created the proposal (DIM credential) */
  readonly proposedBy: DIMCredential;
  /** Proposer's tier (for eligibility verification) */
  readonly proposerTier: ContributorTier;
  /** Title of the proposal */
  readonly title: string;
  /** Detailed description */
  readonly description: string;
  /**
   * Type-specific payload. Optional because a proposal read directly from the
   * on-chain contract carries only raw ABI-encoded payload bytes, which cannot
   * be decoded into the typed union without per-type handling — in that case the
   * payload is genuinely unknown and left undefined rather than fabricated.
   */
  readonly payload?: AllianceProposalPayload;
  /**
   * Individual votes cast on this proposal. May be empty when only aggregate
   * tallies are available (e.g. a proposal read from the on-chain contract,
   * which does not expose per-voter ballots without event indexing) — in that
   * case see {@link AllianceProposal.voteTally}.
   */
  readonly votes: readonly AllianceVote[];
  /**
   * Aggregate vote weights, when the per-voter {@link AllianceProposal.votes}
   * are unavailable. The real on-chain for/against/abstain totals. When present,
   * voting-progress calculations use this instead of summing `votes`.
   */
  readonly voteTally?: AllianceVoteTally;
  /** Minimum tier required to vote */
  readonly minVotingTier: ContributorTier;
  /** Quorum required (total voting weight) */
  readonly quorumRequired: number;
  /** Percentage of approval needed (0-100) */
  readonly approvalThreshold: number;
  /** Current status */
  readonly status: AllianceProposalStatus;
  /** When created (Unix timestamp) */
  readonly createdAt: number;
  /** When voting ends (Unix timestamp) */
  readonly expiresAt: number;
  /** When finalized (Unix timestamp), if applicable */
  readonly finalizedAt?: number;
  /** Execution transaction hash, if applicable */
  readonly executionTxHash?: string;
}

/**
 * Preview of a proposal for listings.
 */
export interface AllianceProposalPreview {
  readonly id: string;
  readonly poolId: PoolId;
  readonly proposalType: AllianceProposalType;
  readonly title: string;
  readonly status: AllianceProposalStatus;
  readonly voteCount: number;
  readonly totalVotingWeight: number;
  readonly approvalPercentage: number;
  readonly createdAt: number;
  readonly expiresAt: number;
}

/**
 * Input for creating a new Alliance proposal.
 */
export interface NewAllianceProposal {
  /** Pool this proposal affects */
  readonly poolId: PoolId;
  /** Title of the proposal */
  readonly title: string;
  /** Detailed description/rationale */
  readonly description: string;
  /** Type-specific payload */
  readonly payload: AllianceProposalPayload;
  /** Voting duration in seconds (default: 7 days) */
  readonly votingDuration?: number;
}

/**
 * Input for casting a vote.
 */
export interface NewAllianceVote {
  /** The decision */
  readonly decision: AllianceVoteDecision;
  /** Optional explanation */
  readonly rationale?: string;
}

// ============================================================================
// Voting Progress
// ============================================================================

/**
 * Summary of voting progress on an Alliance proposal.
 */
export interface AllianceVotingProgress {
  /** Total voting weight cast */
  readonly totalWeight: number;
  /** Quorum required */
  readonly quorumRequired: number;
  /** Whether quorum has been reached */
  readonly quorumReached: boolean;
  /** Current approval percentage */
  readonly approvalPercentage: number;
  /** Threshold percentage needed */
  readonly approvalThreshold: number;
  /** Whether threshold has been reached */
  readonly thresholdReached: boolean;
  /** Weight by decision */
  readonly weightByDecision: Readonly<Record<AllianceVoteDecision, number>>;
  /** Number of votes by decision */
  readonly countByDecision: Readonly<Record<AllianceVoteDecision, number>>;
  /** Number of votes by tier */
  readonly votesByTier: Readonly<Record<ContributorTier, number>>;
  /** Total number of votes */
  readonly totalVotes: number;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Governance configuration for an Alliance pool.
 */
export interface AllianceGovernanceConfig {
  /** Pool this config applies to */
  readonly poolId: PoolId;
  /** Minimum tier required to create proposals */
  readonly minProposalTier: ContributorTier;
  /** Minimum tier required to vote */
  readonly minVotingTier: ContributorTier;
  /** Default voting duration in seconds */
  readonly defaultVotingDuration: number;
  /** Quorum requirement (total voting weight needed) */
  readonly quorumRequirement: number;
  /** Approval threshold percentage (0-100) */
  readonly approvalThreshold: number;
  /** Emergency proposal approval threshold (higher for safety) */
  readonly emergencyApprovalThreshold: number;
  /** Time lock before execution (seconds) */
  readonly executionDelay: number;
  /** Emergency action time lock (shorter for urgency) */
  readonly emergencyExecutionDelay: number;
}

/**
 * Default governance configuration.
 */
export const DEFAULT_ALLIANCE_GOVERNANCE: Omit<AllianceGovernanceConfig, 'poolId'> = {
  minProposalTier: 'beacon',
  minVotingTier: 'spark',
  defaultVotingDuration: 7 * 24 * 60 * 60, // 7 days
  quorumRequirement: 100, // Requires 100 total voting weight
  approvalThreshold: 60, // 60% approval needed
  emergencyApprovalThreshold: 80, // 80% for emergency actions
  executionDelay: 2 * 24 * 60 * 60, // 2 day timelock
  emergencyExecutionDelay: 6 * 60 * 60, // 6 hour timelock for emergencies
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate voting progress for an Alliance proposal.
 */
export function calculateAllianceVotingProgress(
  proposal: AllianceProposal
): AllianceVotingProgress {
  const weightByDecision: Record<AllianceVoteDecision, number> = {
    approve: 0,
    reject: 0,
    abstain: 0,
  };

  const countByDecision: Record<AllianceVoteDecision, number> = {
    approve: 0,
    reject: 0,
    abstain: 0,
  };

  const votesByTier: Record<ContributorTier, number> = {
    none: 0,
    spark: 0,
    flame: 0,
    beacon: 0,
    lighthouse: 0,
  };

  for (const vote of proposal.votes) {
    weightByDecision[vote.decision] += vote.weight;
    countByDecision[vote.decision]++;
    votesByTier[vote.voterTier]++;
  }

  // When the individual ballots are unavailable (chain-read proposal), use the
  // real aggregate weights from `voteTally` for the weight-based metrics. The
  // per-voter counts (`countByDecision`, `votesByTier`, `totalVotes`) stay at
  // zero — they are genuinely unknown without event indexing, not fabricated.
  if (proposal.votes.length === 0 && proposal.voteTally !== undefined) {
    weightByDecision.approve = proposal.voteTally.approve;
    weightByDecision.reject = proposal.voteTally.reject;
    weightByDecision.abstain = proposal.voteTally.abstain;
  }

  const totalWeight = weightByDecision.approve + weightByDecision.reject + weightByDecision.abstain;
  const votingWeight = weightByDecision.approve + weightByDecision.reject; // Abstains don't count for threshold
  const approvalPercentage = votingWeight > 0 ? (weightByDecision.approve / votingWeight) * 100 : 0;
  const quorumReached = totalWeight >= proposal.quorumRequired;
  const thresholdReached = quorumReached && approvalPercentage >= proposal.approvalThreshold;

  return {
    totalWeight,
    quorumRequired: proposal.quorumRequired,
    quorumReached,
    approvalPercentage,
    approvalThreshold: proposal.approvalThreshold,
    thresholdReached,
    weightByDecision,
    countByDecision,
    votesByTier,
    totalVotes: proposal.votes.length,
  };
}

/**
 * Check if a member has already voted on a proposal.
 */
export function hasVotedOnAllianceProposal(
  proposal: AllianceProposal,
  credential: DIMCredential
): boolean {
  return proposal.votes.some((vote) => vote.voter === credential);
}

/**
 * Get a member's vote on a proposal, if they voted.
 */
export function getAllianceVote(
  proposal: AllianceProposal,
  credential: DIMCredential
): AllianceVote | null {
  return proposal.votes.find((vote) => vote.voter === credential) ?? null;
}

/**
 * Convert a proposal to a preview.
 */
export function allianceProposalToPreview(proposal: AllianceProposal): AllianceProposalPreview {
  const progress = calculateAllianceVotingProgress(proposal);

  return {
    id: proposal.id,
    poolId: proposal.poolId,
    proposalType: proposal.proposalType,
    title: proposal.title,
    status: proposal.status,
    voteCount: proposal.votes.length,
    totalVotingWeight: progress.totalWeight,
    approvalPercentage: progress.approvalPercentage,
    createdAt: proposal.createdAt,
    expiresAt: proposal.expiresAt,
  };
}

/**
 * Check if a contributor tier can create proposals.
 */
export function canCreateProposal(
  tier: ContributorTier,
  config: AllianceGovernanceConfig
): boolean {
  const tierRank: Record<ContributorTier, number> = {
    none: 0,
    spark: 1,
    flame: 2,
    beacon: 3,
    lighthouse: 4,
  };
  return tierRank[tier] >= tierRank[config.minProposalTier];
}

/**
 * Check if a contributor tier can vote.
 */
export function canVoteOnProposal(
  tier: ContributorTier,
  config: AllianceGovernanceConfig
): boolean {
  const tierRank: Record<ContributorTier, number> = {
    none: 0,
    spark: 1,
    flame: 2,
    beacon: 3,
    lighthouse: 4,
  };
  return tierRank[tier] >= tierRank[config.minVotingTier];
}

/**
 * Validate outlet weights after a proposed change.
 * Ensures weights sum to 10000 (100%).
 */
export function validateWeightChange(
  currentOutlets: readonly OutletAllocation[],
  change: WeightChangePayload
): { valid: boolean; error?: string } {
  const newWeightMap = new Map<OutletId, number>();

  // Start with current active outlets
  for (const outlet of currentOutlets) {
    if (outlet.isActive) {
      newWeightMap.set(outlet.outletId, outlet.weight);
    }
  }

  // Apply proposed changes
  for (const { outletId, weight } of change.newWeights) {
    if (!newWeightMap.has(outletId)) {
      return { valid: false, error: `Unknown outlet: ${outletId}` };
    }
    newWeightMap.set(outletId, weight);
  }

  // Validate sum
  let total = 0;
  for (const weight of newWeightMap.values()) {
    if (weight < 0) {
      return { valid: false, error: 'Weights cannot be negative' };
    }
    total += weight;
  }

  if (total !== 10000) {
    return {
      valid: false,
      error: `Weights must sum to 10000 (100%), got ${total}`,
    };
  }

  return { valid: true };
}
