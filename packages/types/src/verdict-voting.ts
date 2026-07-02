/**
 * Verdict Voting Types — Multi-sig voting for collectives.
 *
 * Enables collective members to propose and vote on verdicts for claims.
 * Verdicts are finalized when the required number of votes reach threshold.
 *
 * Extended with MobRule-style dispute resolution features (Stewardship Court):
 * - Counter-evidence windows for respondent defense
 * - Turnout requirements for valid verdicts
 * - Time-weighted voting (early votes count more)
 * - Settlement callbacks for post-verdict actions
 */

import type { ClaimId, CollectiveId, DIMCredential } from './brands';
import type { VerdictStatus } from './claim';

// ============================================================================
// MobRule Extensions (Stewardship Court)
// ============================================================================

/**
 * Case state progression (from MobRule).
 * - open: Counter-evidence window active, respondent can submit defense
 * - ripe: Voting period active, votes being collected
 * - done: Verdict finalized, settlements executed
 */
export type CaseState = 'open' | 'ripe' | 'done';

/**
 * Counter-evidence submitted by respondent during the 'open' phase.
 * Allows the accused party to present their defense before voting begins.
 */
export interface CounterEvidence {
  /** Who submitted this counter-evidence */
  readonly submittedBy: DIMCredential;
  /** Text content of the counter-evidence */
  readonly content: string;
  /** Optional URLs to supporting evidence (documents, links, etc.) */
  readonly evidenceUrls?: readonly string[];
  /** When the counter-evidence was submitted (Unix timestamp) */
  readonly submittedAt: number;
}

/**
 * Turnout requirements for a valid verdict.
 * Both conditions must be met for the verdict to be valid.
 */
export interface TurnoutRequirement {
  /** Minimum absolute number of votes required */
  readonly minNominal: number;
  /** Minimum percentage of eligible voters required (0-100) */
  readonly minPercentage: number;
}

/**
 * Settlement callback to execute when a verdict is finalized.
 * Enables automatic post-verdict actions like refunds or reputation changes.
 *
 * TODO: Settlement execution is not yet implemented. These callbacks are
 * stored on the proposal but no finalization logic processes them. This is
 * a placeholder for future integration with the treasury and reputation systems.
 */
export interface SettlementCallback {
  /** Type of settlement action to execute */
  readonly action: 'refund' | 'transfer' | 'slash' | 'restore' | 'custom';
  /** Target address or credential for the action */
  readonly target: string;
  /** Amount in cents if applicable (for refund/transfer/slash) */
  readonly amount?: bigint;
  /** Custom payload for 'custom' action type */
  readonly payload?: string;
}

/**
 * Extended verdict proposal with MobRule features (V2).
 * Backward compatible — V1 proposals are treated as V2 with defaults.
 */
export interface VerdictProposalV2 extends VerdictProposal {
  /** Case state progression (open → ripe → done) */
  readonly caseState: CaseState;
  /** Counter-evidence from respondent, if any */
  readonly counterEvidence?: CounterEvidence;
  /** When counter-evidence window ends (Unix timestamp) */
  readonly counterEvidenceDeadline: number;
  /** Turnout requirements for valid verdict */
  readonly turnout: TurnoutRequirement;
  /** Settlement callbacks to execute on finalization */
  readonly settlements?: readonly SettlementCallback[];
  /** Respondent credential (the party being accused) */
  readonly respondent?: DIMCredential;
  /**
   * Total eligible voters at proposal creation time.
   * This is a snapshot — if collective membership changes during voting,
   * turnout percentage is calculated against this stale denominator.
   * This is intentional: it prevents manipulation by adding/removing members
   * mid-vote to affect turnout requirements.
   */
  readonly eligibleVoters: number;
}

/**
 * Input for creating a new V2 verdict proposal with MobRule features.
 */
export interface NewVerdictProposalV2 extends NewVerdictProposal {
  /** Optional respondent credential */
  readonly respondent?: DIMCredential;
  /** Optional settlement callbacks */
  readonly settlements?: readonly SettlementCallback[];
  /** Optional custom turnout requirements (defaults applied if omitted) */
  readonly turnout?: Partial<TurnoutRequirement>;
}

/**
 * Result of a turnout check.
 */
export interface TurnoutCheckResult {
  /** Whether turnout requirements are met */
  readonly met: boolean;
  /** Current vote count */
  readonly current: number;
  /** Required vote count (max of nominal and percentage-based) */
  readonly required: number;
  /** Current turnout percentage */
  readonly currentPercentage: number;
}

/**
 * Extended voting progress with time-weighted calculations.
 */
export interface WeightedVotingProgress extends VotingProgress {
  /** Weighted vote total (accounting for time decay) */
  readonly weightedTotalVotes: number;
  /** Weighted agreement percentage */
  readonly weightedAgreementPercentage: number;
  /** Turnout check result */
  readonly turnout: TurnoutCheckResult;
  /** Whether both turnout and threshold are met */
  readonly readyToFinalize: boolean;
}

/**
 * Status of a verdict proposal.
 */
export type ProposalStatus = 'voting' | 'approved' | 'rejected' | 'expired';

/**
 * A member's vote on a verdict proposal.
 */
export interface VerdictVote {
  /** Who cast this vote */
  readonly voter: DIMCredential;
  /** The verdict status they voted for */
  readonly decision: VerdictStatus;
  /** Optional explanation for the vote */
  readonly rationale?: string;
  /** Cryptographic signature of the vote */
  readonly signature: string;
  /** When the vote was cast (Unix timestamp) */
  readonly votedAt: number;
}

/**
 * A verdict proposal awaiting votes from collective members.
 *
 * Proposals go through the voting process:
 * 1. Member proposes a verdict status
 * 2. Other members vote (agree or propose different status)
 * 3. When votes reach threshold, verdict is finalized
 * 4. If threshold not reached by expiry, proposal is rejected/expired
 */
export interface VerdictProposal {
  /** Unique proposal identifier (CID on Bulletin Chain) */
  readonly id: string;
  /** The claim this proposal is for */
  readonly claimId: ClaimId;
  /** The collective voting on this proposal */
  readonly collectiveId: CollectiveId;
  /** Who created the proposal */
  readonly proposedBy: DIMCredential;
  /** The verdict status being proposed */
  readonly proposedStatus: VerdictStatus;
  /** Explanation for the proposed verdict */
  readonly rationale: string;
  /** Votes cast on this proposal */
  readonly votes: readonly VerdictVote[];
  /** Minimum number of votes required to finalize */
  readonly requiredVotes: number;
  /** Percentage of agreement needed (0-100) */
  readonly threshold: number;
  /** Current status of the proposal */
  readonly status: ProposalStatus;
  /** When the proposal was created (Unix timestamp) */
  readonly createdAt: number;
  /** When the proposal expires (Unix timestamp) */
  readonly expiresAt: number;
}

/**
 * Input for creating a new verdict proposal.
 */
export interface NewVerdictProposal {
  /** The claim to propose a verdict for */
  readonly claimId: ClaimId;
  /** The collective issuing the verdict */
  readonly collectiveId: CollectiveId;
  /** The proposed verdict status */
  readonly proposedStatus: VerdictStatus;
  /** Explanation for the proposed verdict */
  readonly rationale: string;
}

/**
 * Input for casting a vote on a proposal.
 */
export interface NewVerdictVote {
  /** The verdict status to vote for */
  readonly decision: VerdictStatus;
  /** Optional explanation for the vote */
  readonly rationale?: string;
}

/**
 * Summary of voting progress on a proposal.
 */
export interface VotingProgress {
  /** Total votes cast */
  readonly totalVotes: number;
  /** Votes needed to finalize */
  readonly requiredVotes: number;
  /** Current agreement percentage */
  readonly agreementPercentage: number;
  /** Threshold percentage needed */
  readonly threshold: number;
  /** Whether threshold has been reached */
  readonly thresholdReached: boolean;
  /** Vote counts by status */
  readonly voteCounts: Readonly<Record<VerdictStatus, number>>;
  /** Leading verdict status */
  readonly leadingStatus: VerdictStatus | null;
}

/**
 * Calculate voting progress for a proposal.
 */
export function calculateVotingProgress(proposal: VerdictProposal): VotingProgress {
  const voteCounts: Record<VerdictStatus, number> = {
    confirmed: 0,
    disputed: 0,
    false: 0,
    synthetic: 0,
    inconclusive: 0,
  };

  for (const vote of proposal.votes) {
    voteCounts[vote.decision]++;
  }

  const totalVotes = proposal.votes.length;
  let leadingStatus: VerdictStatus | null = null;
  let maxVotes = 0;

  for (const [status, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      leadingStatus = status as VerdictStatus;
    }
  }

  const agreementPercentage = totalVotes > 0 ? (maxVotes / totalVotes) * 100 : 0;
  const thresholdReached =
    totalVotes >= proposal.requiredVotes && agreementPercentage >= proposal.threshold;

  return {
    totalVotes,
    requiredVotes: proposal.requiredVotes,
    agreementPercentage,
    threshold: proposal.threshold,
    thresholdReached,
    voteCounts,
    leadingStatus,
  };
}

/**
 * Check if a member has already voted on a proposal.
 */
export function hasVoted(proposal: VerdictProposal, credential: DIMCredential): boolean {
  return proposal.votes.some((vote) => vote.voter === credential);
}

/**
 * Get a member's vote on a proposal, if they voted.
 */
export function getMemberVote(
  proposal: VerdictProposal,
  credential: DIMCredential
): VerdictVote | null {
  return proposal.votes.find((vote) => vote.voter === credential) ?? null;
}

// ============================================================================
// MobRule Utility Functions
// ============================================================================

/**
 * Determine the current case state based on time.
 * Transitions: open → ripe (when counter-evidence deadline passes) → done (when finalized)
 *
 * NOTE: This is a derived calculation, not a stored state. Two callers at the
 * boundary between states may get different results. For authoritative state
 * transitions (e.g., accepting votes), callers should use the stored `caseState`
 * field and update it explicitly via a state transition function. This function
 * is intended for display/UI purposes where eventual consistency is acceptable.
 */
export function getCaseState(proposal: VerdictProposalV2): CaseState {
  if (proposal.caseState === 'done') return 'done';

  const now = Date.now();

  // If still in counter-evidence window
  if (now < proposal.counterEvidenceDeadline) return 'open';

  // If voting period has ended (expired)
  if (now >= proposal.expiresAt) return 'done';

  // Otherwise we're in voting period
  return 'ripe';
}

/**
 * Check if turnout requirements are met.
 * Counts unique voters only (deduplicates by credential).
 */
export function checkTurnout(proposal: VerdictProposalV2): TurnoutCheckResult {
  // Deduplicate by voter credential to count unique voters only
  const uniqueVoters = new Set(proposal.votes.map((v) => v.voter));
  const voteCount = uniqueVoters.size;
  const percentage = proposal.eligibleVoters > 0 ? (voteCount / proposal.eligibleVoters) * 100 : 0;

  const nominalMet = voteCount >= proposal.turnout.minNominal;
  const percentageMet = percentage >= proposal.turnout.minPercentage;

  // Required is the max of nominal and percentage-based
  const percentageBasedRequired = Math.ceil(
    (proposal.eligibleVoters * proposal.turnout.minPercentage) / 100
  );
  const required = Math.max(proposal.turnout.minNominal, percentageBasedRequired);

  return {
    met: nominalMet && percentageMet,
    current: voteCount,
    required,
    currentPercentage: percentage,
  };
}

/**
 * Calculate time-weighted vote power (early votes count more).
 * Uses exponential decay with configurable half-life.
 *
 * @param vote - The vote to calculate weight for
 * @param proposalCreatedAt - When the proposal was created
 * @param halfLifeMs - Time for vote weight to decay by 50% (default: 24 hours)
 * @returns Vote weight between 0 and 1
 */
export function calculateVoteWeight(
  vote: VerdictVote,
  proposalCreatedAt: number,
  halfLifeMs: number = 24 * 60 * 60 * 1000
): number {
  const voteAge = vote.votedAt - proposalCreatedAt;
  if (voteAge <= 0) return 1.0;

  // Exponential decay: weight = 0.5^(age/halfLife)
  const decayFactor = Math.pow(0.5, voteAge / halfLifeMs);
  return decayFactor;
}

/**
 * Calculate weighted voting progress for a V2 proposal.
 * Incorporates time-weighted votes and turnout requirements.
 */
export function calculateWeightedVotingProgress(
  proposal: VerdictProposalV2,
  halfLifeMs: number = 24 * 60 * 60 * 1000
): WeightedVotingProgress {
  // Get base voting progress
  const baseProgress = calculateVotingProgress(proposal);

  // Calculate weighted vote counts
  const weightedVoteCounts: Record<VerdictStatus, number> = {
    confirmed: 0,
    disputed: 0,
    false: 0,
    synthetic: 0,
    inconclusive: 0,
  };

  let totalWeight = 0;

  for (const vote of proposal.votes) {
    const weight = calculateVoteWeight(vote, proposal.createdAt, halfLifeMs);
    weightedVoteCounts[vote.decision] += weight;
    totalWeight += weight;
  }

  // Find weighted leading status
  let weightedMaxVotes = 0;
  for (const count of Object.values(weightedVoteCounts)) {
    if (count > weightedMaxVotes) {
      weightedMaxVotes = count;
    }
  }

  const weightedAgreementPercentage = totalWeight > 0 ? (weightedMaxVotes / totalWeight) * 100 : 0;
  const turnoutResult = checkTurnout(proposal);

  // Ready to finalize when turnout is met AND weighted agreement meets threshold
  const readyToFinalize =
    turnoutResult.met &&
    baseProgress.totalVotes >= proposal.requiredVotes &&
    weightedAgreementPercentage >= proposal.threshold;

  return {
    ...baseProgress,
    weightedTotalVotes: totalWeight,
    weightedAgreementPercentage,
    turnout: turnoutResult,
    readyToFinalize,
  };
}

/**
 * Check if a proposal is a V2 proposal with MobRule features.
 */
export function isV2Proposal(
  proposal: VerdictProposal | VerdictProposalV2
): proposal is VerdictProposalV2 {
  return 'caseState' in proposal && 'turnout' in proposal && 'eligibleVoters' in proposal;
}

/**
 * Convert a V1 proposal to V2 format with defaults.
 * Useful for backward compatibility.
 */
export function toV2Proposal(
  proposal: VerdictProposal,
  defaults: {
    counterEvidenceWindowMs: number;
    eligibleVoters: number;
    minTurnoutNominal: number;
    minTurnoutPercent: number;
  }
): VerdictProposalV2 {
  const counterEvidenceDeadline = proposal.createdAt + defaults.counterEvidenceWindowMs;
  const now = Date.now();

  // Determine case state based on time
  let caseState: CaseState;
  if (proposal.status === 'approved' || proposal.status === 'rejected') {
    caseState = 'done';
  } else if (now < counterEvidenceDeadline) {
    caseState = 'open';
  } else if (now < proposal.expiresAt) {
    caseState = 'ripe';
  } else {
    caseState = 'done';
  }

  return {
    ...proposal,
    caseState,
    counterEvidenceDeadline,
    turnout: {
      minNominal: defaults.minTurnoutNominal,
      minPercentage: defaults.minTurnoutPercent,
    },
    eligibleVoters: defaults.eligibleVoters,
  };
}

/**
 * Format time remaining until a deadline as a human-readable string.
 */
export function formatTimeUntilDeadline(deadline: number): string {
  const remaining = deadline - Date.now();

  if (remaining <= 0) return 'Ended';

  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
