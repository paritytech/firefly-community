/**
 * Governance types — generalized multi-sig voting for organizations.
 *
 * Extends the verdict voting pattern to handle multiple proposal types:
 * membership changes, budget proposals, policy changes, and dispute resolution.
 */

import type {
  ClaimId,
  CollectiveId,
  DIMCredential,
  OrganizationId,
  PolkadotAddress,
} from './brands';
import type { PUSDAmount } from './currency';
import type { OrganizationRole } from './organization';
import type { VerdictStatus } from './claim';

/**
 * Types of governance proposals.
 */
export type ProposalType =
  | 'verdict' // Existing: verdict on a claim
  | 'membership' // Add or remove a member
  | 'role-change' // Change a member's role
  | 'budget' // Treasury withdrawal/allocation
  | 'policy' // Governance rule change
  | 'dispute'; // Dispute resolution

/**
 * Status of a governance proposal.
 */
export type GovernanceProposalStatus = 'voting' | 'approved' | 'rejected' | 'expired' | 'executed';

/**
 * Budget categories for treasury operations.
 */
export type BudgetCategory =
  | 'editorial'
  | 'technology'
  | 'administration'
  | 'field-operations'
  | 'legal'
  | 'grants-out';

// ============================================================================
// Proposal Payloads (Discriminated Union)
// ============================================================================

/**
 * Payload for verdict proposals.
 */
export interface VerdictProposalPayload {
  readonly type: 'verdict';
  readonly claimId: ClaimId;
  readonly proposedStatus: VerdictStatus;
}

/**
 * Payload for membership proposals.
 */
export interface MembershipProposalPayload {
  readonly type: 'membership';
  readonly action: 'add' | 'remove';
  readonly credential: DIMCredential;
  readonly pseudonym?: string;
  readonly role?: OrganizationRole;
}

/**
 * Payload for role change proposals.
 */
export interface RoleChangeProposalPayload {
  readonly type: 'role-change';
  readonly credential: DIMCredential;
  readonly currentRole: OrganizationRole;
  readonly newRole: OrganizationRole;
}

/**
 * Payload for budget proposals.
 */
export interface BudgetProposalPayload {
  readonly type: 'budget';
  readonly amount: PUSDAmount;
  readonly category: BudgetCategory;
  readonly recipient: PolkadotAddress;
  readonly purpose: string;
}

/**
 * A single policy change.
 */
export interface PolicyChange {
  readonly field: string;
  readonly oldValue: string | number | boolean;
  readonly newValue: string | number | boolean;
  readonly description: string;
}

/**
 * Payload for policy change proposals.
 */
export interface PolicyProposalPayload {
  readonly type: 'policy';
  readonly changes: readonly PolicyChange[];
}

/**
 * Payload for dispute resolution proposals.
 */
export interface DisputeProposalPayload {
  readonly type: 'dispute';
  readonly disputedEntityType: 'post' | 'claim' | 'verdict' | 'member';
  readonly disputedEntityId: string;
  readonly resolution: string;
}

/**
 * Union of all proposal payloads.
 */
export type ProposalPayload =
  | VerdictProposalPayload
  | MembershipProposalPayload
  | RoleChangeProposalPayload
  | BudgetProposalPayload
  | PolicyProposalPayload
  | DisputeProposalPayload;

// ============================================================================
// Votes
// ============================================================================

/**
 * Vote decision options.
 */
export type VoteDecision = 'approve' | 'reject' | 'abstain';

/**
 * A member's vote on a governance proposal.
 */
export interface GovernanceVote {
  /** Who cast this vote */
  readonly voter: DIMCredential;
  /** The decision */
  readonly decision: VoteDecision;
  /** Voting weight (reputation-based) */
  readonly weight: number;
  /** Optional explanation */
  readonly rationale?: string;
  /** Cryptographic signature */
  readonly signature: string;
  /** When the vote was cast (Unix timestamp) */
  readonly votedAt: number;
}

/**
 * Voting power calculation for a member.
 */
export interface VotingPower {
  /** Base voting power (1 per member) */
  readonly base: number;
  /** Reputation bonus */
  readonly reputationBonus: number;
  /** Role multiplier (founders may have higher weight) */
  readonly roleMultiplier: number;
  /** Total calculated voting power */
  readonly total: number;
}

// ============================================================================
// Proposals
// ============================================================================

/**
 * A governance proposal for an organization.
 */
export interface GovernanceProposal {
  /** Unique proposal identifier (CID on Bulletin Chain) */
  readonly id: string;
  /** The organization this proposal belongs to */
  readonly organizationId: OrganizationId;
  /** Optional: the collective (for verdict proposals from collectives) */
  readonly collectiveId?: CollectiveId;
  /** Type of proposal */
  readonly proposalType: ProposalType;
  /** Who created the proposal */
  readonly proposedBy: DIMCredential;
  /** Title of the proposal */
  readonly title: string;
  /** Detailed description */
  readonly description: string;
  /** Type-specific payload */
  readonly payload: ProposalPayload;
  /** Votes cast on this proposal */
  readonly votes: readonly GovernanceVote[];
  /** Minimum total voting weight required */
  readonly requiredWeight: number;
  /** Percentage of approval needed (0-100) */
  readonly threshold: number;
  /** Current status */
  readonly status: GovernanceProposalStatus;
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
export interface GovernanceProposalPreview {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly proposalType: ProposalType;
  readonly title: string;
  readonly status: GovernanceProposalStatus;
  readonly voteCount: number;
  readonly approvalPercentage: number;
  readonly createdAt: number;
  readonly expiresAt: number;
}

/**
 * Input for creating a new governance proposal.
 */
export interface NewGovernanceProposal {
  /** The organization this proposal is for */
  readonly organizationId: OrganizationId;
  /** Optional collective (for verdict proposals) */
  readonly collectiveId?: CollectiveId;
  /** Title of the proposal */
  readonly title: string;
  /** Detailed description/rationale */
  readonly description: string;
  /** Type-specific payload */
  readonly payload: ProposalPayload;
}

/**
 * Input for casting a vote.
 */
export interface NewGovernanceVote {
  /** The decision */
  readonly decision: VoteDecision;
  /** Optional explanation */
  readonly rationale?: string;
}

// ============================================================================
// Voting Progress
// ============================================================================

/**
 * Summary of voting progress on a proposal.
 */
export interface GovernanceVotingProgress {
  /** Total voting weight cast */
  readonly totalWeight: number;
  /** Weight required */
  readonly requiredWeight: number;
  /** Current approval percentage */
  readonly approvalPercentage: number;
  /** Threshold percentage needed */
  readonly threshold: number;
  /** Whether threshold has been reached */
  readonly thresholdReached: boolean;
  /** Weight by decision */
  readonly weightByDecision: Readonly<Record<VoteDecision, number>>;
  /** Number of votes by decision */
  readonly countByDecision: Readonly<Record<VoteDecision, number>>;
  /** Total number of votes */
  readonly totalVotes: number;
}

/**
 * Calculate voting progress for a proposal.
 */
export function calculateGovernanceVotingProgress(
  proposal: GovernanceProposal
): GovernanceVotingProgress {
  const weightByDecision: Record<VoteDecision, number> = {
    approve: 0,
    reject: 0,
    abstain: 0,
  };

  const countByDecision: Record<VoteDecision, number> = {
    approve: 0,
    reject: 0,
    abstain: 0,
  };

  for (const vote of proposal.votes) {
    weightByDecision[vote.decision] += vote.weight;
    countByDecision[vote.decision]++;
  }

  const totalWeight = weightByDecision.approve + weightByDecision.reject + weightByDecision.abstain;
  const votingWeight = weightByDecision.approve + weightByDecision.reject; // Abstains don't count for threshold
  const approvalPercentage = votingWeight > 0 ? (weightByDecision.approve / votingWeight) * 100 : 0;
  const thresholdReached =
    totalWeight >= proposal.requiredWeight && approvalPercentage >= proposal.threshold;

  return {
    totalWeight,
    requiredWeight: proposal.requiredWeight,
    approvalPercentage,
    threshold: proposal.threshold,
    thresholdReached,
    weightByDecision,
    countByDecision,
    totalVotes: proposal.votes.length,
  };
}

/**
 * Check if a member has already voted on a proposal.
 */
export function hasVotedOnProposal(
  proposal: GovernanceProposal,
  credential: DIMCredential
): boolean {
  return proposal.votes.some((vote) => vote.voter === credential);
}

/**
 * Get a member's vote on a proposal, if they voted.
 */
export function getMemberProposalVote(
  proposal: GovernanceProposal,
  credential: DIMCredential
): GovernanceVote | null {
  return proposal.votes.find((vote) => vote.voter === credential) ?? null;
}

/**
 * Convert a proposal to a preview.
 */
export function proposalToPreview(proposal: GovernanceProposal): GovernanceProposalPreview {
  const progress = calculateGovernanceVotingProgress(proposal);

  return {
    id: proposal.id,
    organizationId: proposal.organizationId,
    proposalType: proposal.proposalType,
    title: proposal.title,
    status: proposal.status,
    voteCount: proposal.votes.length,
    approvalPercentage: progress.approvalPercentage,
    createdAt: proposal.createdAt,
    expiresAt: proposal.expiresAt,
  };
}
