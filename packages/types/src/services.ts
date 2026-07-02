/**
 * Service interfaces for data access.
 *
 * All data access must go through these service abstractions.
 * This enables swapping mock implementations for chain implementations
 * without changing component code.
 */

import type {
  CampaignId,
  ChainId,
  ClaimId,
  CollectiveId,
  CorroborationId,
  DIMCredential,
  EscrowId,
  OutletId,
  PolkadotAddress,
  PostId,
  TransactionHash,
  VerdictId,
} from './brands';
import type {
  FireflyProfile,
  FireflyProfileUpdate,
  PublicFireflyProfile,
  PostPreviewForProfile,
} from './identity';
import type {
  Campaign,
  CampaignPayout,
  CampaignPreview,
  CampaignStatus,
  NewCampaign,
} from './campaign';
import type { ChainPreview, StoryChain } from './chain';
import type {
  Claim,
  ClaimPreview,
  ClaimStatus,
  NewClaim,
  NewClaimEvidence,
  NewVerdict,
  Verdict,
  VerdictStatus,
  // Enhanced claim types
  ClaimSource,
  ClaimPriority,
  AIFlaggedClaim,
  ClaimAssignment,
  PeerReviewRequest,
  PeerReview,
  StakeRecord,
  NewClaimAssignment,
  NewPeerReviewRequest,
  NewStake,
  EnhancedClaim,
} from './claim';
import type { NewPost, Post, PostPreview, PostStatus } from './post';
import type {
  Coin,
  CoinExponent,
  CoinWallet,
  ClaimTokenAllocation,
  RecyclerClaimToken,
  RecyclerVoucher,
  TransferPackage,
} from './coinage';
import type { Corroboration, NewCorroboration } from './corroboration';
import type { PUSDAmount, PUSDBalance } from './currency';
import type { Outlet, OutletPreview } from './outlet';
import type { PaymentMode } from './payment-mode';
import type { PersonhoodLevel, PersonhoodCapabilities } from './personhood';
import type { ReputationTopic } from './reputation-topics';

/**
 * Result type for operations that can fail.
 * Prefer this over throwing exceptions for expected failure cases.
 */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * Helper to create success result.
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Helper to create error result.
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Pagination parameters.
 */
export interface PaginationParams {
  readonly limit: number;
  readonly offset: number;
}

/**
 * Paginated result.
 */
export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly hasMore: boolean;
}

// ============================================================================
// Post Service (replaces SignalService)
// ============================================================================

/**
 * Post service interface.
 */
export interface PostService {
  /** Get a single post by ID */
  getPost(id: PostId, locale?: string): Promise<Post | null>;

  /** Get all posts in a chain */
  getChainPosts(chainId: ChainId, locale?: string): Promise<readonly Post[]>;

  /** Get recent posts, optionally filtered by topic or location */
  getRecentPosts(params: {
    topic?: string;
    location?: string;
    status?: PostStatus;
    pagination: PaginationParams;
    locale?: string;
  }): Promise<PaginatedResult<PostPreview>>;

  /**
   * Get recent posts with full data for display components.
   * Returns full Post objects instead of PostPreview.
   */
  getRecentPostsForDisplay(params: {
    topic?: string;
    location?: string;
    status?: PostStatus;
    pagination: PaginationParams;
    locale?: string;
  }): Promise<PaginatedResult<Post>>;

  /** Get all posts (used by the posts browse page) */
  getAllPosts(params: {
    pagination: PaginationParams;
    locale?: string;
  }): Promise<PaginatedResult<PostPreview>>;

  /** Illuminate a new post */
  illuminate(post: NewPost): Promise<Result<PostId, string>>;
}

/**
 * Chain service interface.
 */
export interface ChainService {
  /** Get a single chain by ID */
  getChain(id: ChainId, locale?: string): Promise<StoryChain | null>;

  /** Get chain previews, optionally filtered */
  getChains(params: {
    topic?: string;
    location?: string;
    status?: StoryChain['status'];
    pagination: PaginationParams;
    locale?: string;
  }): Promise<PaginatedResult<ChainPreview>>;

  /** Get featured/active chains for the explore page */
  getFeaturedChains(locale?: string): Promise<readonly ChainPreview[]>;
}

/**
 * Corroboration service interface.
 */
export interface CorroborationService {
  /** Get all corroborations for a post */
  getPostCorroborations(postId: PostId): Promise<readonly Corroboration[]>;

  /** Submit a corroboration */
  corroborate(corroboration: NewCorroboration): Promise<Result<CorroborationId, string>>;
}

/**
 * Campaign service interface.
 */
export interface CampaignService {
  /** Get a single campaign by ID */
  getCampaign(id: CampaignId, locale?: string): Promise<Campaign | null>;

  /** Get campaigns, optionally filtered */
  getCampaigns(params: {
    status?: CampaignStatus;
    topic?: string;
    location?: string;
    sponsorType?: 'outlet' | 'collective' | 'community';
    locale?: string;
    pagination: PaginationParams;
  }): Promise<PaginatedResult<CampaignPreview>>;

  /** Get active campaigns */
  getActiveCampaigns(params: {
    topic?: string;
    location?: string;
    locale?: string;
    pagination: PaginationParams;
  }): Promise<PaginatedResult<CampaignPreview>>;

  /** Create a new campaign */
  createCampaign(campaign: NewCampaign): Promise<Result<CampaignId, string>>;

  /** Contribute a post to a campaign */
  contributeToCampaign(campaignId: CampaignId, postId: PostId): Promise<Result<void, string>>;
}

/**
 * Outlet service interface.
 */
export interface OutletService {
  /** Get an outlet by ID */
  getOutlet(id: OutletId): Promise<Outlet | null>;

  /** Get outlets, optionally filtered */
  getOutlets(params: {
    country?: string;
    topic?: string;
    pagination: PaginationParams;
  }): Promise<PaginatedResult<OutletPreview>>;
}

// ============================================================================
// Enhanced Campaign Service
// ============================================================================

import type {
  EnhancedCampaign,
  CampaignTier,
  CampaignMilestone,
  CampaignSupporter,
  NewCampaignTier,
  NewCampaignMilestone,
  SupporterRegistration,
} from './campaign';

/**
 * Enhanced campaign service interface.
 *
 * Extends CampaignService with tiers, milestones, and supporter management.
 */
export interface EnhancedCampaignService extends CampaignService {
  /** Get an enhanced campaign with tiers and milestones */
  getEnhancedCampaign(id: CampaignId): Promise<EnhancedCampaign | null>;

  /** Add a contribution tier to a campaign */
  addTier(campaignId: CampaignId, tier: NewCampaignTier): Promise<Result<string, string>>;

  /** Update a tier */
  updateTier(
    campaignId: CampaignId,
    tierId: string,
    updates: Partial<Omit<CampaignTier, 'id' | 'currentSupporters'>>
  ): Promise<Result<void, string>>;

  /** Remove a tier (only if no supporters) */
  removeTier(campaignId: CampaignId, tierId: string): Promise<Result<void, string>>;

  /** Register as a campaign supporter */
  registerSupporter(params: SupporterRegistration): Promise<Result<void, string>>;

  /** Get supporters for a campaign */
  getSupporters(params: {
    campaignId: CampaignId;
    tierId?: string;
    pagination: PaginationParams;
  }): Promise<PaginatedResult<CampaignSupporter>>;

  /** Add a milestone to a campaign */
  addMilestone(
    campaignId: CampaignId,
    milestone: NewCampaignMilestone
  ): Promise<Result<string, string>>;

  /** Update milestone progress and check if reached */
  checkMilestones(campaignId: CampaignId): Promise<readonly CampaignMilestone[]>;

  /** Link campaigns for cross-outlet amplification */
  linkCampaigns(campaignIds: readonly CampaignId[]): Promise<Result<void, string>>;

  /** Unlink a campaign */
  unlinkCampaign(
    campaignId: CampaignId,
    linkedCampaignId: CampaignId
  ): Promise<Result<void, string>>;

  /** Mint an NFT badge for a milestone (when reached) */
  mintBadge(
    campaignId: CampaignId,
    milestoneId: string,
    recipientCredential: DIMCredential
  ): Promise<Result<string, string>>;
}

// ============================================================================
// Claim Service
// ============================================================================

/**
 * Claim service interface.
 */
export interface ClaimService {
  /** Get a single claim by ID */
  getClaim(id: ClaimId, locale?: string): Promise<Claim | null>;

  /** Get claims by post ID */
  getClaimsByPost(postId: PostId, locale?: string): Promise<readonly Claim[]>;

  /** Get claims by status (for workbench) */
  getClaimsByStatus(params: {
    status?: ClaimStatus;
    topic?: string;
    pagination: PaginationParams;
    locale?: string;
  }): Promise<PaginatedResult<ClaimPreview>>;

  /** Get pending claims for workbench */
  getPendingClaims(params: {
    topic?: string;
    pagination: PaginationParams;
    locale?: string;
  }): Promise<PaginatedResult<ClaimPreview>>;

  /** Extract a claim from a post */
  extractClaim(claim: NewClaim): Promise<Result<ClaimId, string>>;

  /** Submit evidence to a claim */
  submitEvidence(claimId: ClaimId, evidence: NewClaimEvidence): Promise<Result<void, string>>;
}

// ============================================================================
// Enhanced Claim Service
// ============================================================================

/**
 * Enhanced claim service interface.
 *
 * Extends ClaimService with AI ingestion, assignment workflow,
 * peer review, and reputation staking.
 */
export interface EnhancedClaimService extends ClaimService {
  /** Get an enhanced claim with workbench metadata */
  getEnhancedClaim(id: ClaimId): Promise<EnhancedClaim | null>;

  /** Get AI-flagged claims awaiting review */
  getAIFlaggedClaims(params: {
    reviewStatus?: AIFlaggedClaim['reviewStatus'];
    minConfidence?: number;
    pagination: PaginationParams;
  }): Promise<PaginatedResult<AIFlaggedClaim>>;

  /** Ingest a claim from external source (API, AI, etc.) */
  ingestClaim(claim: {
    statement: string;
    sourceUrl?: string;
    source: ClaimSource;
    suggestedTopics: readonly string[];
    aiConfidence?: number;
    aiReason?: string;
  }): Promise<Result<ClaimId, string>>;

  /** Accept or reject an AI-flagged claim */
  reviewAIFlaggedClaim(
    flaggedClaimId: string,
    action: 'accept' | 'reject' | 'modify',
    modifiedStatement?: string
  ): Promise<Result<ClaimId | null, string>>;

  /** Assign a claim to a collective member */
  assignClaim(assignment: NewClaimAssignment): Promise<Result<string, string>>;

  /** Update assignment status */
  updateAssignment(
    assignmentId: string,
    status: ClaimAssignment['status']
  ): Promise<Result<void, string>>;

  /** Get claims assigned to a credential */
  getAssignedClaims(credential: DIMCredential): Promise<readonly ClaimAssignment[]>;

  /** Get claims by priority for a collective */
  getClaimsByPriority(params: {
    collectiveId: CollectiveId;
    priority?: ClaimPriority;
    pagination: PaginationParams;
  }): Promise<PaginatedResult<EnhancedClaim>>;

  /** Request a peer review for a claim */
  requestPeerReview(request: NewPeerReviewRequest): Promise<Result<string, string>>;

  /** Submit a peer review response */
  submitPeerReview(
    requestId: string,
    review: Omit<PeerReview, 'reviewer' | 'reviewedAt'>
  ): Promise<Result<void, string>>;

  /** Get pending peer review requests for a credential */
  getPendingPeerReviews(credential: DIMCredential): Promise<readonly PeerReviewRequest[]>;

  /** Stake reputation on a verdict outcome */
  stakeOnVerdict(stake: NewStake): Promise<Result<string, string>>;

  /** Get stakes for a claim */
  getStakesForClaim(claimId: ClaimId): Promise<readonly StakeRecord[]>;

  /** Resolve stakes after final verdict */
  resolveStakes(
    claimId: ClaimId,
    finalVerdict: VerdictStatus
  ): Promise<Result<readonly StakeRecord[], string>>;
}

// ============================================================================
// Verdict Service
// ============================================================================

/**
 * Verdict service interface.
 */
export interface VerdictService {
  /** Get a verdict by ID */
  getVerdict(id: VerdictId): Promise<Verdict | null>;

  /** Get verdict for a claim */
  getVerdictForClaim(claimId: ClaimId): Promise<Verdict | null>;

  /** Issue a verdict on a claim */
  issueVerdict(verdict: NewVerdict): Promise<Result<VerdictId, string>>;
}

// ============================================================================
// Collective Service
// ============================================================================

import type { Collective, CollectivePreview, MemberRole, CollectiveMember } from './collective';

/**
 * Collective service interface.
 *
 * Provides access to collective data and membership verification.
 */
export interface CollectiveService {
  /** Get a collective by ID */
  getCollective(id: CollectiveId): Promise<Collective | null>;

  /** Get all collectives */
  getCollectives(params: {
    topic?: string;
    pagination: PaginationParams;
  }): Promise<PaginatedResult<CollectivePreview>>;

  /** Check if a credential is a member of a collective */
  isMember(collectiveId: CollectiveId, credential: DIMCredential): Promise<boolean>;

  /** Get a member's role in a collective */
  getMemberRole(collectiveId: CollectiveId, credential: DIMCredential): Promise<MemberRole | null>;

  /** Get member details */
  getMember(
    collectiveId: CollectiveId,
    credential: DIMCredential
  ): Promise<CollectiveMember | null>;

  /** Get collectives a credential belongs to */
  getCollectivesForMember(credential: DIMCredential): Promise<readonly CollectivePreview[]>;
}

// ============================================================================
// Organization Service
// ============================================================================

import type {
  Organization,
  OrganizationPreview,
  OrganizationMember,
  OrganizationRole,
  OrganizationPermission,
  NewOrganization,
  OrganizationInvitation,
  OrganizationJoinRequest,
} from './organization';
import type { OrganizationId } from './brands';

/**
 * Organization service interface.
 *
 * Provides access to organization data, membership verification, and permissions.
 * Organizations are the foundational identity layer for professional media operations.
 */
export interface OrganizationService {
  /** Get an organization by ID */
  getOrganization(id: OrganizationId): Promise<Organization | null>;

  /** Get organizations, optionally filtered */
  getOrganizations(params: {
    type?: Organization['type'];
    topic?: string;
    location?: string;
    pagination: PaginationParams;
  }): Promise<PaginatedResult<OrganizationPreview>>;

  /** Create a new organization */
  createOrganization(org: NewOrganization): Promise<Result<OrganizationId, string>>;

  /** Check if a credential is a member of an organization */
  isMember(orgId: OrganizationId, credential: DIMCredential): Promise<boolean>;

  /** Get a member's role in an organization */
  getMemberRole(orgId: OrganizationId, credential: DIMCredential): Promise<OrganizationRole | null>;

  /** Get member details */
  getMember(orgId: OrganizationId, credential: DIMCredential): Promise<OrganizationMember | null>;

  /** Get all permissions for a member */
  getPermissions(
    orgId: OrganizationId,
    credential: DIMCredential
  ): Promise<readonly OrganizationPermission[]>;

  /** Check if a member has a specific permission */
  hasPermission(
    orgId: OrganizationId,
    credential: DIMCredential,
    permission: OrganizationPermission
  ): Promise<boolean>;

  /** Get organizations a credential belongs to */
  getOrganizationsForMember(credential: DIMCredential): Promise<readonly OrganizationPreview[]>;

  /** Invite a member to an organization */
  inviteMember(
    orgId: OrganizationId,
    invitee: DIMCredential,
    role: OrganizationRole,
    message?: string
  ): Promise<Result<string, string>>;

  /** Accept an invitation */
  acceptInvitation(invitationId: string): Promise<Result<void, string>>;

  /** Decline an invitation */
  declineInvitation(invitationId: string): Promise<Result<void, string>>;

  /** Get pending invitations for a credential */
  getPendingInvitations(credential: DIMCredential): Promise<readonly OrganizationInvitation[]>;

  /** Remove a member from an organization */
  removeMember(orgId: OrganizationId, credential: DIMCredential): Promise<Result<void, string>>;

  /** Update a member's role */
  updateMemberRole(
    orgId: OrganizationId,
    credential: DIMCredential,
    newRole: OrganizationRole
  ): Promise<Result<void, string>>;

  /** Submit a join request (for 'open' or 'vote' membership types) */
  submitJoinRequest(
    orgId: OrganizationId,
    message: string,
    requestedRole?: OrganizationRole
  ): Promise<Result<string, string>>;

  /** Get pending join requests for an organization */
  getPendingJoinRequests(orgId: OrganizationId): Promise<readonly OrganizationJoinRequest[]>;

  /** Vote on a join request (for 'vote' membership type) */
  voteOnJoinRequest(requestId: string, approve: boolean): Promise<Result<void, string>>;
}

// ============================================================================
// Verdict Proposal Service (Multi-sig Voting)
// ============================================================================

import type {
  VerdictProposal,
  NewVerdictProposal,
  NewVerdictVote,
  VerdictVote,
} from './verdict-voting';

/**
 * Verdict proposal service interface.
 *
 * Manages multi-sig voting on verdict proposals.
 */
export interface VerdictProposalService {
  /** Get a proposal by ID */
  getProposal(proposalId: string): Promise<VerdictProposal | null>;

  /** Get all proposals for a claim */
  getProposalsForClaim(claimId: ClaimId): Promise<readonly VerdictProposal[]>;

  /** Get active proposals for a collective */
  getActiveProposalsForCollective(collectiveId: CollectiveId): Promise<readonly VerdictProposal[]>;

  /** Create a new verdict proposal */
  createProposal(proposal: NewVerdictProposal): Promise<Result<string, string>>;

  /** Cast a vote on a proposal */
  vote(proposalId: string, vote: NewVerdictVote): Promise<Result<VerdictVote, string>>;

  /** Check and finalize a proposal if threshold reached */
  checkAndFinalize(proposalId: string): Promise<Result<VerdictId | null, string>>;
}

// ============================================================================
// Governance Service (Generalized Voting)
// ============================================================================

import type {
  GovernanceProposal,
  GovernanceProposalPreview,
  NewGovernanceProposal,
  NewGovernanceVote,
  GovernanceVote,
  VotingPower,
  ProposalType,
  GovernanceProposalStatus,
} from './governance';

/**
 * Error types for governance operations.
 */
export type GovernanceError =
  | { readonly type: 'NOT_MEMBER'; readonly organizationId: OrganizationId }
  | { readonly type: 'INSUFFICIENT_PERMISSION'; readonly required: string }
  | { readonly type: 'PROPOSAL_NOT_FOUND'; readonly proposalId: string }
  | { readonly type: 'PROPOSAL_EXPIRED'; readonly proposalId: string }
  | { readonly type: 'ALREADY_VOTED'; readonly credential: DIMCredential }
  | { readonly type: 'EXECUTION_FAILED'; readonly reason: string };

/**
 * Governance service interface.
 *
 * Provides generalized multi-sig voting for organizations.
 * Extends the verdict voting pattern to handle multiple proposal types.
 */
export interface GovernanceService {
  /** Get a proposal by ID */
  getProposal(proposalId: string): Promise<GovernanceProposal | null>;

  /** Get proposals for an organization */
  getProposalsForOrganization(params: {
    organizationId: OrganizationId;
    type?: ProposalType;
    status?: GovernanceProposalStatus;
    pagination: PaginationParams;
  }): Promise<PaginatedResult<GovernanceProposalPreview>>;

  /** Get active proposals for an organization */
  getActiveProposals(organizationId: OrganizationId): Promise<readonly GovernanceProposalPreview[]>;

  /** Get proposals created by a credential */
  getProposalsByCreator(credential: DIMCredential): Promise<readonly GovernanceProposalPreview[]>;

  /** Create a new governance proposal */
  createProposal(proposal: NewGovernanceProposal): Promise<Result<string, string>>;

  /** Cast a vote on a proposal */
  vote(proposalId: string, vote: NewGovernanceVote): Promise<Result<GovernanceVote, string>>;

  /** Calculate voting power for a member in an organization */
  calculateVotingPower(
    credential: DIMCredential,
    organizationId: OrganizationId
  ): Promise<VotingPower>;

  /** Check if proposal threshold is reached and finalize if so */
  checkAndFinalize(proposalId: string): Promise<Result<void, string>>;

  /** Execute an approved proposal (for proposals that require execution) */
  executeProposal(proposalId: string): Promise<Result<string, string>>;

  /** Cancel a proposal (only by proposer before voting starts) */
  cancelProposal(proposalId: string): Promise<Result<void, string>>;
}

// ============================================================================
// Treasury Service
// ============================================================================

import type {
  TreasuryBalance,
  TreasuryTransaction,
  TreasuryConfig,
  BudgetSummary,
  NewTreasury,
  WithdrawalProposal,
  TreasuryTransactionStatus,
} from './treasury';
import type { TreasuryId } from './brands';

/**
 * Error types for treasury operations.
 */
export type TreasuryError =
  | { readonly type: 'TREASURY_NOT_FOUND'; readonly treasuryId: TreasuryId }
  | {
      readonly type: 'INSUFFICIENT_BALANCE';
      readonly available: PUSDAmount;
      readonly required: PUSDAmount;
    }
  | { readonly type: 'UNAUTHORIZED'; readonly reason: string }
  | { readonly type: 'APPROVAL_ALREADY_GIVEN'; readonly credential: DIMCredential }
  | { readonly type: 'TRANSACTION_FAILED'; readonly reason: string }
  | { readonly type: 'LIMIT_EXCEEDED'; readonly limit: PUSDAmount; readonly requested: PUSDAmount };

/**
 * Treasury service interface.
 *
 * Provides multi-sig treasury management for organizations.
 */
export interface TreasuryService {
  /** Get treasury balance by ID */
  getTreasury(treasuryId: TreasuryId): Promise<TreasuryBalance | null>;

  /** Get treasury for an organization */
  getTreasuryForOrganization(organizationId: OrganizationId): Promise<TreasuryBalance | null>;

  /** Get treasury configuration */
  getTreasuryConfig(treasuryId: TreasuryId): Promise<TreasuryConfig | null>;

  /** Create a new treasury for an organization */
  createTreasury(params: NewTreasury): Promise<Result<TreasuryId, string>>;

  /** Get transaction history for a treasury */
  getTransactionHistory(params: {
    treasuryId: TreasuryId;
    status?: TreasuryTransactionStatus;
    pagination: PaginationParams;
  }): Promise<PaginatedResult<TreasuryTransaction>>;

  /** Get a specific transaction */
  getTransaction(transactionId: string): Promise<TreasuryTransaction | null>;

  /** Propose a withdrawal (creates pending transaction) */
  proposeWithdrawal(params: WithdrawalProposal): Promise<Result<string, string>>;

  /** Approve a pending withdrawal (multi-sig) */
  approveWithdrawal(transactionId: string): Promise<Result<void, string>>;

  /** Execute an approved withdrawal (after threshold reached) */
  executeWithdrawal(transactionId: string): Promise<Result<TransactionHash, string>>;

  /** Cancel a pending withdrawal */
  cancelWithdrawal(transactionId: string): Promise<Result<void, string>>;

  /** Deposit funds to treasury */
  deposit(params: {
    treasuryId: TreasuryId;
    amount: PUSDAmount;
    source: PolkadotAddress;
    category?: import('./governance').BudgetCategory;
  }): Promise<Result<string, string>>;

  /** Get budget summary for a time period */
  getBudgetSummary(params: {
    treasuryId: TreasuryId;
    periodStart: number;
    periodEnd: number;
  }): Promise<BudgetSummary>;

  /** Update treasury configuration (requires governance) */
  updateConfig(
    treasuryId: TreasuryId,
    updates: Partial<Omit<TreasuryConfig, 'treasuryId' | 'organizationId' | 'updatedAt'>>
  ): Promise<Result<void, string>>;

  /** Check if an address is a signer for a treasury */
  isSigner(treasuryId: TreasuryId, address: PolkadotAddress): Promise<boolean>;
}

// ============================================================================
// Reputation Service
// ============================================================================

/**
 * Error types for reputation operations.
 */
export type ReputationError =
  | { readonly type: 'CREDENTIAL_NOT_FOUND'; readonly credential: DIMCredential }
  | { readonly type: 'INVALID_TOPIC'; readonly topic: string }
  | { readonly type: 'UPDATE_FAILED'; readonly reason: string };

/**
 * Topic-specific reputation score (0-1000 scale).
 */
export interface TopicReputationScore {
  /** The topic domain */
  readonly topic: ReputationTopic;
  /** Score from 0 to 1000 (500 = neutral starting point) */
  readonly score: number;
  /** Number of corroborations given in this topic */
  readonly corroborationsGiven: number;
  /** Number of corroborations received in this topic */
  readonly corroborationsReceived: number;
  /** Number of successful challenges in this topic */
  readonly challengesWon: number;
  /** Number of times challenged and lost */
  readonly challengesLost: number;
}

/**
 * Complete reputation profile for a firefly.
 */
export interface ReputationProfile {
  /** DIM credential */
  readonly credential: DIMCredential;
  /** Reputation scores by topic */
  readonly scores: Readonly<Record<ReputationTopic, TopicReputationScore>>;
  /** Overall reputation (weighted average across topics) */
  readonly overallScore: number;
  /** Total corroborations across all topics */
  readonly totalCorroborations: number;
  /** When reputation was last updated */
  readonly lastUpdated: number;
  /** Timestamp of last qualifying activity (for decay calculation) */
  readonly lastActivityAt: number;
}

/**
 * Reputation service interface.
 *
 * Manages topic-weighted reputation for fireflies. Reputation is earned
 * through corroborated contributions and lost through failed challenges.
 */
export interface ReputationService {
  /** Get full reputation profile for a credential */
  getReputation(credential: DIMCredential): Promise<ReputationProfile | null>;

  /** Get reputation score for a specific topic */
  getTopicScore(credential: DIMCredential, topic: ReputationTopic): Promise<number>;

  /** Get average reputation across specified topics */
  getAverageScore(credential: DIMCredential, topics: readonly ReputationTopic[]): Promise<number>;

  /**
   * Record a corroboration event.
   * Increases reputation for both the corroborator and post author.
   */
  recordCorroboration(params: {
    corroboratorCredential: DIMCredential;
    postAuthorCredential: DIMCredential;
    postId: PostId;
    topics: readonly ReputationTopic[];
  }): Promise<Result<void, ReputationError>>;

  /**
   * Record a successful challenge.
   * Decreases reputation for the post author.
   */
  recordChallenge(params: {
    challengedCredential: DIMCredential;
    postId: PostId;
    topics: readonly ReputationTopic[];
  }): Promise<Result<void, ReputationError>>;

  /**
   * Get effective reputation with decay applied.
   * Returns the current reputation after accounting for inactivity decay.
   */
  getEffectiveReputation(credential: DIMCredential): Promise<number>;

  /**
   * Record an activity that resets the decay timer.
   * Called automatically by other methods but can be called manually.
   */
  recordActivity(
    credential: DIMCredential,
    action: 'illuminate' | 'corroborate' | 'challenge' | 'vote' | 'fund' | 'claim'
  ): Promise<void>;

  /**
   * Get the timestamp of the last qualifying activity.
   * Returns null if no activity recorded.
   */
  getLastActivity(credential: DIMCredential): Promise<number | null>;

  /**
   * Check if reputation is currently decaying due to inactivity.
   */
  isDecaying(credential: DIMCredential): Promise<boolean>;

  /**
   * Get days remaining until decay starts.
   * Returns 0 if already decaying.
   */
  getDaysUntilDecay(credential: DIMCredential): Promise<number>;
}

// ============================================================================
// Personhood Service
// ============================================================================

/**
 * Error types for personhood operations.
 */
export type PersonhoodError =
  | { readonly type: 'CREDENTIAL_NOT_FOUND'; readonly credential: DIMCredential }
  | { readonly type: 'VERIFICATION_FAILED'; readonly reason: string }
  | { readonly type: 'ALREADY_VERIFIED'; readonly level: PersonhoodLevel };

/**
 * Personhood verification state.
 */
export interface PersonhoodState {
  /** DIM credential */
  readonly credential: DIMCredential;
  /** Current verification level */
  readonly level: PersonhoodLevel;
  /** When verification was completed */
  readonly verifiedAt: number | null;
  /** Verification method used (for audit) */
  readonly verificationMethod?: string;
}

/**
 * Personhood service interface.
 *
 * Manages DIM verification levels and capability checks.
 */
export interface PersonhoodService {
  /** Get personhood state for a credential */
  getPersonhood(credential: DIMCredential): Promise<PersonhoodState | null>;

  /** Get personhood level (convenience method) */
  getLevel(credential: DIMCredential): Promise<PersonhoodLevel>;

  /** Get capabilities for a credential */
  getCapabilities(credential: DIMCredential): Promise<PersonhoodCapabilities>;

  /** Check if a specific action is allowed */
  canPerform(
    credential: DIMCredential,
    action: keyof Omit<PersonhoodCapabilities, 'maxBountyFunding' | 'maxBountyClaim'>
  ): Promise<boolean>;

  /** Check if a funding amount is within limits */
  canFundAmount(credential: DIMCredential, amount: PUSDAmount): Promise<boolean>;

  /** Check if a claim amount is within limits */
  canClaimAmount(credential: DIMCredential, amount: PUSDAmount): Promise<boolean>;

  /**
   * Initiate verification process.
   * Returns a verification URL or session ID.
   */
  startVerification(params: {
    credential: DIMCredential;
    targetLevel: PersonhoodLevel;
  }): Promise<Result<{ verificationUrl: string }, PersonhoodError>>;

  /**
   * Complete verification (called after external verification succeeds).
   */
  completeVerification(params: {
    credential: DIMCredential;
    verificationToken: string;
  }): Promise<Result<PersonhoodState, PersonhoodError>>;
}

/**
 * Attestation status for an account.
 */
export type AttestationStatus =
  | { readonly status: 'not_registered' }
  | { readonly status: 'registered'; readonly verifiedAt: number }
  | { readonly status: 'pending_attestation' };

/**
 * Attestation eligibility result.
 */
export interface AttestationEligibility {
  /** Whether the address is eligible for attestation */
  readonly eligible: boolean;
  /** Reason if not eligible */
  readonly reason?: string;
}

/**
 * Extended personhood service with attestation support.
 *
 * Adds methods for checking attestation status, subscribing to changes,
 * and generating attestation messages.
 */
export interface ExtendedPersonhoodService extends PersonhoodService {
  /**
   * Get full attestation status (includes pending state).
   */
  getAttestationStatus(address: PolkadotAddress): Promise<AttestationStatus>;

  /**
   * Subscribe to personhood changes.
   * Returns an unsubscribe function.
   */
  subscribePersonhood(
    credential: DIMCredential,
    onUpdate: (state: PersonhoodState | null) => void
  ): () => void;

  /**
   * Check if user can be attested (prerequisites met).
   */
  canBeAttested(address: PolkadotAddress): Promise<AttestationEligibility>;

  /**
   * Generate attestation message for signing.
   * The candidate must sign this message to prove ownership of their account.
   */
  generateAttestationMessage(candidate: PolkadotAddress, ringVrfKey: Uint8Array): Uint8Array;

  /**
   * Invalidate cached personhood state for a credential.
   * Useful after attestation completes.
   */
  invalidateCache(credential: DIMCredential): void;
}

// ============================================================================
// Payment Services
// ============================================================================

/**
 * Error types for payment operations.
 */
export type PaymentError =
  | {
      readonly type: 'INSUFFICIENT_BALANCE';
      readonly available: PUSDAmount;
      readonly required: PUSDAmount;
    }
  | { readonly type: 'INVALID_ADDRESS'; readonly address: string }
  | { readonly type: 'BELOW_MINIMUM'; readonly amount: PUSDAmount; readonly minimum: PUSDAmount }
  | { readonly type: 'TRANSACTION_FAILED'; readonly reason: string }
  | { readonly type: 'NETWORK_ERROR'; readonly reason: string };

/**
 * Payment service for public pUSD transfers.
 */
export interface PaymentService {
  /** Get pUSD balance for an address */
  getBalance(address: PolkadotAddress): Promise<PUSDBalance>;

  /** Transfer pUSD between addresses */
  transfer(params: {
    from: PolkadotAddress;
    to: PolkadotAddress;
    amount: PUSDAmount;
    memo?: string;
  }): Promise<Result<TransactionHash, PaymentError>>;

  /** Watch for incoming transfers to an address */
  watchTransfers(
    address: PolkadotAddress,
    callback: (transfer: {
      from: PolkadotAddress;
      amount: PUSDAmount;
      txHash: TransactionHash;
      timestamp: number;
    }) => void
  ): () => void; // Returns unsubscribe function
}

/**
 * Error types for escrow operations.
 */
export type EscrowError =
  | {
      readonly type: 'INSUFFICIENT_BALANCE';
      readonly available: PUSDAmount;
      readonly required: PUSDAmount;
    }
  | { readonly type: 'ESCROW_NOT_FOUND'; readonly escrowId: EscrowId }
  | { readonly type: 'ESCROW_ALREADY_SETTLED'; readonly escrowId: EscrowId }
  | { readonly type: 'INVALID_DISTRIBUTION'; readonly reason: string }
  | { readonly type: 'UNAUTHORIZED'; readonly reason: string }
  | { readonly type: 'TRANSACTION_FAILED'; readonly reason: string };

/**
 * Escrow state for a campaign.
 */
export interface EscrowState {
  /** Escrow identifier */
  readonly id: EscrowId;
  /** Associated campaign */
  readonly campaignId: CampaignId;
  /** Funder's address */
  readonly funderAddress: PolkadotAddress;
  /** Funder's DIM credential */
  readonly funderCredential: DIMCredential;
  /** Total escrowed amount */
  readonly amount: PUSDAmount;
  /** Current status */
  readonly status: 'active' | 'released' | 'refunded';
  /** Payout mode */
  readonly payoutMode: PaymentMode;
  /** Deposit transaction hash */
  readonly depositTxHash: TransactionHash;
  /** Release/refund transaction hash (if completed) */
  readonly settlementTxHash?: TransactionHash;
  /** When escrow was created */
  readonly createdAt: number;
}

/**
 * Escrow service for campaign fund management.
 */
export interface EscrowService {
  /** Create a new escrow for a campaign */
  createEscrow(params: {
    campaignId: CampaignId;
    funderAddress: PolkadotAddress;
    funderCredential: DIMCredential;
    amount: PUSDAmount;
    payoutMode: PaymentMode;
  }): Promise<Result<EscrowState, EscrowError>>;

  /** Get escrow state */
  getEscrow(escrowId: EscrowId): Promise<EscrowState | null>;

  /** Get escrow by campaign ID */
  getEscrowByCampaign(campaignId: CampaignId): Promise<EscrowState | null>;

  /** Release funds to campaign contributors */
  releaseFunds(params: {
    escrowId: EscrowId;
    distributions: readonly {
      recipientAddress: PolkadotAddress;
      recipientCredential: DIMCredential;
      postId: PostId;
      amount: PUSDAmount;
    }[];
  }): Promise<Result<CampaignPayout, EscrowError>>;

  /** Refund funds to funder */
  refundFunds(escrowId: EscrowId): Promise<Result<TransactionHash, EscrowError>>;
}

/**
 * Error types for coinage operations.
 */
export type CoinageError =
  | { readonly type: 'INSUFFICIENT_COINS'; readonly available: number; readonly required: number }
  | { readonly type: 'COIN_NOT_FOUND'; readonly derivationIndex: number }
  | { readonly type: 'COIN_AT_MAX_AGE'; readonly coin: Coin }
  | { readonly type: 'INVALID_SPLIT'; readonly reason: string }
  | { readonly type: 'TRANSFER_EXPIRED'; readonly transferId: string }
  | { readonly type: 'NO_CLAIM_TOKENS'; readonly reason: string }
  | { readonly type: 'RECYCLER_FAILED'; readonly reason: string };

/**
 * Coinage service for private payments.
 */
export interface CoinageService {
  /** Scan chain for user's coins */
  scanForCoins(): Promise<CoinWallet>;

  /** Get current coin wallet state (cached, faster than scan) */
  getWallet(): CoinWallet;

  /** Onboard: convert pUSD to private coins */
  onboard(params: {
    amount: PUSDAmount;
    sourceAddress: PolkadotAddress;
  }): Promise<Result<RecyclerVoucher[], CoinageError>>;

  /** Claim coins from recycler vouchers */
  claimCoins(params: {
    vouchers: readonly RecyclerVoucher[];
    claimToken: RecyclerClaimToken;
  }): Promise<Result<Coin[], CoinageError>>;

  /** Split a coin into smaller denominations */
  splitCoin(params: {
    coin: Coin;
    into: readonly CoinExponent[];
  }): Promise<Result<Coin[], CoinageError>>;

  /** Prepare transfer (returns keys to share off-chain) */
  prepareTransfer(params: { coins: readonly Coin[]; expiresInSeconds?: number }): TransferPackage;

  /** Claim incoming transfer */
  claimTransfer(params: { keys: readonly string[] }): Promise<Result<Coin[], CoinageError>>;

  /** Cancel pending transfer (reclaim coins to self) */
  cancelTransfer(params: { coins: readonly Coin[] }): Promise<Result<Coin[], CoinageError>>;

  /** Recycle coins to reset age */
  recycleCoin(params: {
    coins: readonly Coin[];
    claimToken: RecyclerClaimToken;
  }): Promise<Result<Coin[], CoinageError>>;

  /** Offboard: convert private coins to pUSD */
  offboard(params: {
    coins: readonly Coin[];
    destinationAddress: PolkadotAddress;
    claimToken: RecyclerClaimToken;
  }): Promise<Result<TransactionHash, CoinageError>>;

  /** Get free claim token allocation for DIM-verified user */
  getClaimTokenAllocation(credential: DIMCredential): Promise<ClaimTokenAllocation>;
}

/**
 * Payment router for selecting between public and private payments.
 */
export interface PaymentRouter {
  /** Get recommended payment mode for a use case */
  getRecommendedMode(params: {
    useCase: string;
    senderPreference?: PaymentMode;
    receiverPreference?: PaymentMode;
    complianceRequired?: boolean;
    receiverHasCoinage?: boolean;
  }): { mode: PaymentMode; reason: string; warning?: string };

  /** Execute a public payment */
  sendPublicPayment(params: {
    from: PolkadotAddress;
    to: PolkadotAddress;
    amount: PUSDAmount;
    memo?: string;
  }): Promise<Result<TransactionHash, PaymentError>>;

  /** Prepare a private payment (returns transfer package) */
  preparePrivatePayment(params: {
    amountCents: number;
  }): Promise<Result<TransferPackage, CoinageError>>;
}

// ============================================================================
// Firefly Profile Service
// ============================================================================

/**
 * Firefly profile service interface.
 *
 * Manages firefly profiles, combining stored editable data with
 * system-derived fields (personhood level, collective memberships).
 */
export interface FireflyProfileService {
  /**
   * Get a public profile by credential hash.
   * Assembles stored data with derived system fields.
   * Filters publicInfo based on disclosure level.
   */
  getPublicProfile(
    credentialHash: DIMCredential,
    locale?: string
  ): Promise<PublicFireflyProfile | null>;

  /**
   * Get the user's own full profile.
   * Returns all data without disclosure filtering.
   */
  getOwnProfile(credentialHash: DIMCredential): Promise<FireflyProfile | null>;

  /**
   * Update editable profile fields.
   * Only pseudonym, disclosureLevel, and publicInfo can be updated.
   */
  updateProfile(
    credentialHash: DIMCredential,
    updates: FireflyProfileUpdate
  ): Promise<Result<FireflyProfile, string>>;

  /**
   * Get posts authored by a credential.
   * Returns paginated post previews for profile display.
   */
  getPostsByAuthor(
    credentialHash: DIMCredential,
    pagination: PaginationParams,
    locale?: string
  ): Promise<PaginatedResult<PostPreviewForProfile>>;
}

// ============================================================================
// Analytics Service
// ============================================================================

import type {
  AnalyticsPeriod,
  FundingMetrics,
  ImpactMetrics,
  NetworkHealthMetrics,
  RankingCategory,
  LeaderboardResult,
  ContributorMetrics,
  PeriodComparison,
} from './analytics';

/**
 * Error types for analytics operations.
 */
export type AnalyticsError =
  | { readonly type: 'ORGANIZATION_NOT_FOUND'; readonly organizationId: OrganizationId }
  | { readonly type: 'INVALID_PERIOD'; readonly reason: string }
  | { readonly type: 'COMPUTATION_FAILED'; readonly reason: string };

/**
 * Analytics service interface.
 *
 * Provides funding metrics, impact metrics, and network health
 * for organizations, outlets, and the overall network.
 */
export interface AnalyticsService {
  /**
   * Get funding metrics for an organization.
   */
  getFundingMetrics(
    organizationId: OrganizationId,
    period: AnalyticsPeriod
  ): Promise<Result<FundingMetrics, AnalyticsError>>;

  /**
   * Get impact metrics for an organization.
   */
  getImpactMetrics(
    organizationId: OrganizationId,
    period: AnalyticsPeriod
  ): Promise<Result<ImpactMetrics, AnalyticsError>>;

  /**
   * Get network-wide health metrics.
   */
  getNetworkHealth(period?: AnalyticsPeriod): Promise<NetworkHealthMetrics>;

  /**
   * Get outlet/organization leaderboard.
   */
  getOutletLeaderboard(params: {
    category: RankingCategory;
    period: AnalyticsPeriod;
    limit?: number;
    offset?: number;
  }): Promise<LeaderboardResult>;

  /**
   * Get contributor metrics for a firefly.
   */
  getContributorMetrics(
    credential: DIMCredential,
    period: AnalyticsPeriod
  ): Promise<ContributorMetrics>;

  /**
   * Get funding metrics with period-over-period comparison.
   */
  getFundingComparison(
    organizationId: OrganizationId,
    currentPeriod: AnalyticsPeriod,
    previousPeriod: AnalyticsPeriod
  ): Promise<Result<PeriodComparison<FundingMetrics>, AnalyticsError>>;

  /**
   * Get impact metrics with period-over-period comparison.
   */
  getImpactComparison(
    organizationId: OrganizationId,
    currentPeriod: AnalyticsPeriod,
    previousPeriod: AnalyticsPeriod
  ): Promise<Result<PeriodComparison<ImpactMetrics>, AnalyticsError>>;
}

// ============================================================================
// Alliance Governance Service
// ============================================================================

import type {
  AllianceProposal,
  AllianceProposalPreview,
  AllianceProposalType,
  AllianceProposalStatus,
  AllianceVote,
  AllianceVotingProgress,
  AllianceGovernanceConfig,
  NewAllianceProposal,
  NewAllianceVote,
} from './alliance-governance';
import type { PoolId, ContributorTier } from './crowdstacking';

/**
 * Error types for Alliance governance operations.
 */
export type AllianceGovernanceError =
  | { readonly type: 'NOT_CONTRIBUTOR'; readonly address: PolkadotAddress }
  | {
      readonly type: 'BELOW_MIN_TIER';
      readonly currentTier: ContributorTier;
      readonly requiredTier: ContributorTier;
    }
  | { readonly type: 'PROPOSAL_NOT_FOUND'; readonly proposalId: string }
  | { readonly type: 'PROPOSAL_NOT_ACTIVE'; readonly status: AllianceProposalStatus }
  | { readonly type: 'ALREADY_VOTED'; readonly voter: DIMCredential }
  | { readonly type: 'EXECUTION_FAILED'; readonly reason: string }
  | { readonly type: 'WALLET_NOT_CONNECTED' }
  | { readonly type: 'VOTING_PERIOD_ENDED' }
  | { readonly type: 'NOT_SUCCEEDED'; readonly status: AllianceProposalStatus }
  | { readonly type: 'TIMELOCK_NOT_EXPIRED'; readonly availableAt: number };

/**
 * Alliance governance service interface.
 *
 * Provides on-chain Alliance governance with snapshot-based voting for
 * contributor-driven management of outlets, weights, and pool parameters.
 */
export interface AllianceGovernanceService {
  /**
   * Get a proposal by ID.
   */
  getProposal(proposalId: string): Promise<AllianceProposal | null>;

  /**
   * Get proposals for a pool with optional filters.
   */
  getProposalsForPool(params: {
    poolId: PoolId;
    type?: AllianceProposalType;
    status?: AllianceProposalStatus;
    pagination: PaginationParams;
  }): Promise<PaginatedResult<AllianceProposalPreview>>;

  /**
   * Get active proposals for a pool.
   */
  getActiveProposals(poolId: PoolId): Promise<readonly AllianceProposalPreview[]>;

  /**
   * Create a new proposal.
   * Requires BEACON tier or higher.
   */
  createProposal(proposal: NewAllianceProposal): Promise<Result<string, AllianceGovernanceError>>;

  /**
   * Cast a vote on a proposal.
   * Requires SPARK tier or higher.
   */
  vote(
    proposalId: string,
    vote: NewAllianceVote
  ): Promise<Result<AllianceVote, AllianceGovernanceError>>;

  /**
   * Get voting progress for a proposal.
   */
  getVotingProgress(proposalId: string): Promise<AllianceVotingProgress | null>;

  /**
   * Get voting power for an address on a proposal.
   * Uses snapshotted weight if available.
   */
  getVotingPower(address: PolkadotAddress, proposalId: string): Promise<number>;

  /**
   * Check if an address has voted on a proposal.
   */
  hasVoted(proposalId: string, address: PolkadotAddress): Promise<boolean>;

  /**
   * Execute an approved proposal.
   * Requires timelock to have expired.
   */
  executeProposal(proposalId: string): Promise<Result<TransactionHash, AllianceGovernanceError>>;

  /**
   * Cancel a proposal.
   * Only the proposer or owner can cancel.
   */
  cancelProposal(proposalId: string): Promise<Result<void, AllianceGovernanceError>>;

  /**
   * Get governance configuration for a pool.
   */
  getConfig(poolId: PoolId): Promise<AllianceGovernanceConfig | null>;

  /**
   * Check if an address can create proposals.
   * Requires BEACON tier or higher.
   */
  canCreateProposal(address: PolkadotAddress, poolId: PoolId): Promise<boolean>;

  /**
   * Check if an address can vote.
   * Requires SPARK tier or higher.
   */
  canVote(address: PolkadotAddress, poolId: PoolId): Promise<boolean>;
}

// ============================================================================
// Notification Service (RFC 0019)
// ============================================================================

import type {
  NotificationId,
  PushNotificationRequest,
  PushNotificationError,
  ScheduledNotificationInfo,
} from './notification';

/**
 * Alias for Result with PushNotificationError.
 */
export type NotificationResult<T> = Result<T, PushNotificationError>;

/**
 * Notification service with scheduling support.
 * Host queue limit: 64 scheduled notifications.
 *
 * Permission: Requires DevicePermission::Notifications from host.
 *
 * BREAKING CHANGE from v0.7.x: sendPushNotification now returns NotificationId
 * instead of void. All scheduled notifications get an ID that can be used
 * for cancellation.
 */
export interface NotificationService {
  /**
   * Check if notification permission is granted.
   * Should be called before attempting to send notifications.
   */
  hasPermission(): Promise<boolean>;

  /**
   * Request notification permission from the host.
   * @returns true if granted, false if denied
   */
  requestPermission(): Promise<boolean>;

  /**
   * Send a push notification.
   * BREAKING CHANGE from v0.7.x: Now returns NotificationId (was void).
   * Wire ID: 4
   * @param request - Notification request (include scheduledAt for scheduling)
   */
  sendPushNotification(
    request: PushNotificationRequest
  ): Promise<NotificationResult<NotificationId>>;

  /**
   * Cancel a scheduled notification.
   * Idempotent - always returns Ok regardless of notification state.
   * Wire ID: 134
   * @param id - Notification ID to cancel
   */
  cancelPushNotification(id: NotificationId): Promise<NotificationResult<void>>;

  /**
   * Get count of currently scheduled notifications.
   * Useful for UI to show remaining capacity (64 - count).
   */
  getScheduledCount(): Promise<number>;

  /**
   * Get list of scheduled notifications.
   */
  getScheduledNotifications(): Promise<readonly ScheduledNotificationInfo[]>;
}

// ============================================================================
// CoinPayment Service (RFC 0017)
// ============================================================================

import type {
  CoinPaymentPurseId,
  CoinPaymentPurseInfo,
  CoinPaymentBalance,
  CoinPaymentReceivable,
  CoinPaymentCheque,
  CoinPaymentStatus,
  CoinPaymentError,
  CoinPaymentListenItem,
} from './coin-payment';

/**
 * Alias for Result with CoinPaymentError.
 * Keeps service method signatures concise.
 */
export type CoinPaymentResult<T> = Result<T, CoinPaymentError>;

/**
 * CoinPayment service for firewalled dotUSD purse management.
 *
 * This service provides ISOLATED payment purses that are privacy-preserving.
 * Products never see coin secrets, derivation paths, or raw proofs.
 *
 * Wire IDs: 136-162. MAIN_PURSE = u32::MAX.
 *
 * Integration: Consider adding as adapter behind PaymentRouter if replacing
 * existing coinage flows. Currently designed as separate service for clarity.
 */
export interface CoinPaymentService {
  /**
   * Create a new named purse.
   * Wire ID: 136
   * @param name - User-friendly name for the purse (max 64 chars)
   */
  createPurse(name: string): Promise<CoinPaymentResult<CoinPaymentPurseId>>;

  /**
   * Query purse info including current balance.
   * Wire ID: 138
   * @param purse - Purse ID to query
   */
  queryPurse(purse: CoinPaymentPurseId): Promise<CoinPaymentResult<CoinPaymentPurseInfo>>;

  /**
   * List all purses for the current user.
   */
  listPurses(): Promise<CoinPaymentResult<readonly CoinPaymentPurseInfo[]>>;

  /**
   * Rebalance funds between purses.
   * Wire IDs: 140-142 (streaming)
   * @param from - Source purse
   * @param to - Destination purse
   * @param amount - Amount in cents to transfer
   */
  rebalancePurse(
    from: CoinPaymentPurseId,
    to: CoinPaymentPurseId,
    amount: CoinPaymentBalance
  ): AsyncIterable<CoinPaymentStatus>;

  /**
   * Delete a purse, draining remaining funds to another purse.
   * Wire IDs: 144-146 (streaming)
   * @param target - Purse to delete
   * @param drainInto - Purse to receive remaining funds
   */
  deletePurse(
    target: CoinPaymentPurseId,
    drainInto: CoinPaymentPurseId
  ): AsyncIterable<CoinPaymentStatus>;

  /**
   * Create a receivable address for incoming payments.
   * Wire ID: 148
   * @param intoPurse - Purse to receive funds
   */
  createReceivable(
    intoPurse: CoinPaymentPurseId
  ): Promise<CoinPaymentResult<CoinPaymentReceivable>>;

  /**
   * Create a cheque for outgoing payment.
   * Wire ID: 150
   * @param from - Source purse
   * @param to - Destination receivable
   * @param amount - Amount in cents
   */
  createCheque(
    from: CoinPaymentPurseId,
    to: CoinPaymentReceivable,
    amount: CoinPaymentBalance
  ): Promise<CoinPaymentResult<CoinPaymentCheque>>;

  /**
   * Deposit a received cheque into your purse.
   * Wire IDs: 152-154 (streaming)
   * @param cheque - Cheque to deposit
   */
  deposit(cheque: CoinPaymentCheque): AsyncIterable<CoinPaymentStatus>;

  /**
   * Refund a receivable back to the sender.
   * Wire IDs: 156-158 (streaming)
   * @param receivable - Receivable to refund
   */
  refund(receivable: CoinPaymentReceivable): AsyncIterable<CoinPaymentStatus>;

  /**
   * Listen for incoming payments on a receivable.
   * Wire IDs: 160-162 (streaming)
   * @param receivable - Receivable to monitor
   */
  listenForPayment(receivable: CoinPaymentReceivable): AsyncIterable<CoinPaymentListenItem>;
}
