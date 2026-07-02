/**
 * Verification types — fact-checking workflow in F-Network.
 *
 * Posts can be submitted for verification by collectives.
 * Members review evidence, vote on verdicts, and publish
 * on-chain attestations.
 */

import type { PostId, CollectiveId, VerificationRequestId, DIMCredential } from './brands';

/**
 * Verification status of a post.
 */
export type VerificationStatus =
  | 'unverified' // No verification requested
  | 'pending' // Verification requested, waiting for collective
  | 'in_review' // Collective is actively reviewing
  | 'verified' // Collective confirmed as accurate
  | 'disputed' // Evidence is conflicting
  | 'false' // Collective determined to be inaccurate
  | 'synthetic'; // Content is AI-generated

/**
 * Status of a verification request workflow.
 */
export type VerificationRequestStatus =
  | 'pending' // Waiting for collective to pick up
  | 'in_review' // Evidence being gathered
  | 'voting' // Members voting on verdict
  | 'completed'; // Verdict finalized

/**
 * Evidence submitted during verification.
 */
export interface VerificationEvidence {
  /** Who submitted this evidence */
  readonly submittedBy: DIMCredential;
  /** Pseudonym of submitter */
  readonly submitterPseudonym: string;
  /** Description of the evidence */
  readonly content: string;
  /** Source URLs */
  readonly sources: readonly string[];
  /** Media attachments (CIDs) */
  readonly mediaCids?: readonly string[];
  /** Whether this supports or contradicts the post */
  readonly supports: boolean;
  /** When submitted */
  readonly submittedAt: number;
}

/**
 * A vote on a verification verdict.
 */
export interface VerificationVote {
  /** Who voted */
  readonly voter: DIMCredential;
  /** Voter's pseudonym */
  readonly voterPseudonym: string;
  /** Their verdict */
  readonly verdict: VerificationStatus;
  /** Optional reasoning */
  readonly reasoning?: string;
  /** When they voted */
  readonly votedAt: number;
}

/**
 * Summary of votes for display.
 */
export interface VoteSummary {
  readonly verified: number;
  readonly disputed: number;
  readonly false: number;
  readonly synthetic: number;
}

/**
 * The final verdict on a post.
 */
export interface VerificationVerdict {
  /** Final status */
  readonly status: VerificationStatus;
  /** Collective's reasoning */
  readonly reasoning: string;
  /** Sources cited */
  readonly sources: readonly string[];
  /** Vote breakdown */
  readonly voteSummary: VoteSummary;
  /** CID of on-chain attestation */
  readonly attestationCid?: string;
  /** When verdict was finalized */
  readonly completedAt: number;
}

/**
 * A verification request for a post.
 */
export interface VerificationRequest {
  /** Unique identifier */
  readonly id: VerificationRequestId;
  /** CID on Bulletin Chain */
  readonly cid?: string;
  /** Post being verified */
  readonly postId: PostId;
  /** CID of the post */
  readonly postCid: string;
  /** Collective handling verification */
  readonly collectiveId: CollectiveId;
  /** Current workflow status */
  readonly status: VerificationRequestStatus;
  /** Evidence submitted */
  readonly evidence: readonly VerificationEvidence[];
  /** Votes cast */
  readonly votes: readonly VerificationVote[];
  /** Final verdict (when complete) */
  readonly verdict?: VerificationVerdict;
  /** When request was created */
  readonly createdAt: number;
  /** When last updated */
  readonly updatedAt: number;
}

/**
 * Preview for verification queue listing.
 */
export interface VerificationRequestPreview {
  readonly id: VerificationRequestId;
  readonly postId: PostId;
  readonly collectiveId: CollectiveId;
  readonly status: VerificationRequestStatus;
  readonly evidenceCount: number;
  readonly voteCount: number;
  readonly createdAt: number;
}

/**
 * Data to submit new evidence.
 */
export interface NewEvidence {
  readonly content: string;
  readonly sources: readonly string[];
  readonly mediaCids?: readonly string[];
  readonly supports: boolean;
}

/**
 * Data to submit a vote.
 */
export interface NewVote {
  readonly verdict: VerificationStatus;
  readonly reasoning?: string;
}
