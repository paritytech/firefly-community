/**
 * Collective types — fact-checking groups in F-Network.
 *
 * Collectives are groups of verified humans who collaboratively verify
 * signals. They have governance rules, reputation tracking, and
 * membership requirements.
 */

import type { CollectiveId, DIMCredential } from './brands';

/**
 * Role within a collective.
 */
export type MemberRole = 'founder' | 'moderator' | 'member';

/**
 * How new members can join.
 */
export type MembershipApproval = 'open' | 'vote' | 'invite';

/**
 * A member of a collective.
 */
export interface CollectiveMember {
  /** Member's DIM credential hash */
  readonly credentialHash: DIMCredential;
  /** Member's pseudonym */
  readonly pseudonym: string;
  /** Role in the collective */
  readonly role: MemberRole;
  /** When they joined */
  readonly joinedAt: number;
  /** Number of verifications completed in this collective */
  readonly verificationsCompleted: number;
}

/**
 * Governance rules for a collective.
 */
export interface CollectiveGovernance {
  /** Minimum votes needed to finalize a verdict */
  readonly minVotesForVerdict: number;
  /** Percentage agreement needed for verdict (0-100) */
  readonly verdictThreshold: number;
  /** How new members join */
  readonly membershipApproval: MembershipApproval;
}

/**
 * Reputation metrics for a collective.
 */
export interface CollectiveReputation {
  /** Overall reputation score 0-100 */
  readonly score: number;
  /** Total verifications completed */
  readonly verificationsCompleted: number;
  /** Accuracy rate (verdicts not overturned) */
  readonly accuracyRate: number;
  /** Average hours to reach verdict */
  readonly avgResponseTime: number;
}

/**
 * A fact-checking collective.
 */
export interface Collective {
  /** Unique identifier */
  readonly id: CollectiveId;
  /** CID on Bulletin Chain */
  readonly cid?: string;
  /** Collective name */
  readonly name: string;
  /** Short description */
  readonly description: string;
  /** Mission statement */
  readonly mission: string;
  /** Topics this collective focuses on */
  readonly topics: readonly string[];
  /** Current members */
  readonly members: readonly CollectiveMember[];
  /** Governance rules */
  readonly governance: CollectiveGovernance;
  /** Reputation metrics */
  readonly reputation: CollectiveReputation;
  /** When created */
  readonly createdAt: number;
  /** When last updated */
  readonly updatedAt: number;
}

/**
 * Preview card for collective listings.
 */
export interface CollectivePreview {
  readonly id: CollectiveId;
  readonly name: string;
  readonly description: string;
  readonly topics: readonly string[];
  readonly memberCount: number;
  readonly reputation: number;
  readonly verificationsCompleted: number;
}

/**
 * Data needed to create a new collective.
 */
export interface NewCollective {
  readonly name: string;
  readonly description: string;
  readonly mission: string;
  readonly topics: readonly string[];
  readonly governance: CollectiveGovernance;
}

/**
 * Status of a join request.
 */
export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

/**
 * A request to join a collective.
 */
export interface JoinRequest {
  /** Request ID */
  readonly id: string;
  /** Collective being joined */
  readonly collectiveId: CollectiveId;
  /** Applicant info */
  readonly applicant: {
    readonly credentialHash: DIMCredential;
    readonly pseudonym: string;
  };
  /** Message from applicant */
  readonly message: string;
  /** Current status */
  readonly status: JoinRequestStatus;
  /** Votes from existing members */
  readonly votes: readonly {
    readonly voter: DIMCredential;
    readonly approve: boolean;
    readonly votedAt: number;
  }[];
  /** When request was created */
  readonly createdAt: number;
  /** When request was resolved */
  readonly resolvedAt?: number;
}
