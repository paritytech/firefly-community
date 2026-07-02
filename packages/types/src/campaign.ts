/**
 * Campaign types — sponsored fact-checking efforts.
 *
 * A campaign is a funded request for verification of specific claims or topics.
 * Sponsored by outlets, collectives, or community funding.
 */

import type {
  CampaignId,
  ChainId,
  ClaimId,
  CollectiveId,
  CommunityId,
  DIMCredential,
  EscrowId,
  OutletId,
  PolkadotAddress,
  PostId,
  TransactionHash,
} from './brands';
import type { PUSDAmount } from './currency';
import type { PaymentMode } from './payment-mode';

/** Status of a campaign */
export type CampaignStatus =
  | 'active' // Accepting contributions
  | 'completed' // Deliverables met
  | 'expired' // Time limit reached
  | 'cancelled'; // Cancelled by sponsor

/** Discriminated union for type-safe sponsors */
export type CampaignSponsor =
  | { readonly type: 'outlet'; readonly id: OutletId; readonly name: string }
  | { readonly type: 'collective'; readonly id: CollectiveId; readonly name: string }
  | { readonly type: 'community'; readonly id: CommunityId; readonly name: string }
  | { readonly type: 'firefly'; readonly credential: DIMCredential; readonly pseudonym: string };

/** Types of deliverables for campaign completion */
export type DeliverableType =
  | 'evidence_gathered'
  | 'sources_verified'
  | 'verdict_issued'
  | 'story_published';

/** A single deliverable with progress tracking */
export interface CampaignDeliverable {
  readonly type: DeliverableType;
  readonly target: number;
  readonly current: number;
}

/**
 * A campaign — a funded request for fact-checking.
 */
export interface Campaign {
  readonly id: CampaignId;
  readonly title: string;
  readonly description: string;
  readonly topics: readonly string[];
  readonly location?: string;
  readonly sponsor: CampaignSponsor;
  readonly status: CampaignStatus;
  readonly fundingAmount: PUSDAmount;
  /**
   * On-chain escrow holding this campaign's funds. Present only for campaigns
   * funded through the real escrow flow; omitted when no on-chain escrow exists
   * (e.g. simulated/dev funding) rather than carrying a fabricated id.
   */
  readonly escrowId?: EscrowId;
  /**
   * Hash of the real on-chain funding transaction. Present only when funding
   * confirmed on chain; omitted when there is no real transaction rather than
   * carrying a fabricated hash that would masquerade as a confirmed payment.
   */
  readonly fundingTxHash?: TransactionHash;
  /**
   * Deterministic bytes32 id of the on-chain BountyEscrow bounty this campaign
   * funded (keccak256-hashed). Present only for campaigns funded via the real
   * Revive escrow; lets the persisted record reference the exact on-chain bounty.
   */
  readonly onChainBountyId?: string;
  readonly payoutMode: PaymentMode;
  readonly deliverables: readonly CampaignDeliverable[];
  readonly assignedCollectiveId?: CollectiveId;
  readonly contributingPostIds: readonly PostId[];
  readonly targetClaimIds?: readonly ClaimId[];
  readonly relatedChainId?: ChainId;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly cid?: string;
}

/**
 * Lightweight preview of a campaign for list views.
 */
export interface CampaignPreview {
  readonly id: CampaignId;
  readonly title: string;
  readonly topics: readonly string[];
  readonly location?: string;
  readonly sponsor: CampaignSponsor;
  readonly status: CampaignStatus;
  readonly fundingAmount: PUSDAmount;
  readonly payoutMode: PaymentMode;
  readonly contributionCount: number;
  readonly deliverableProgress: number;
  readonly expiresAt: number;
}

/**
 * Input type for creating a new campaign.
 */
export interface NewCampaign {
  readonly title: string;
  readonly description: string;
  readonly topics: readonly string[];
  readonly location?: string;
  readonly sponsor: CampaignSponsor;
  readonly fundingAmount: PUSDAmount;
  readonly payoutMode?: PaymentMode;
  readonly deliverables: readonly Omit<CampaignDeliverable, 'current'>[];
  readonly targetClaimIds?: readonly ClaimId[];
  readonly duration: number;
}

/**
 * Payout record for a completed campaign.
 */
export interface CampaignPayout {
  readonly campaignId: CampaignId;
  readonly totalAmount: PUSDAmount;
  readonly distributions: readonly PayoutDistribution[];
  readonly txHash?: TransactionHash;
  readonly executedAt: number;
}

/**
 * Individual payout to a campaign contributor.
 */
export interface PayoutDistribution {
  readonly postId: PostId;
  readonly recipientAddress?: PolkadotAddress;
  readonly recipientCredential: DIMCredential;
  readonly amount: PUSDAmount;
  readonly percentage: number;
}

/**
 * A tracked contribution to a campaign.
 */
export interface CampaignContribution {
  readonly postId: PostId;
  readonly campaignId: CampaignId;
  readonly contributorCredential: DIMCredential;
  readonly topics: readonly string[];
  readonly corroborationCount: number;
  readonly createdAt: number;
}

/**
 * A computed allocation share for a campaign contributor.
 */
export interface AllocationShare {
  readonly contributorCredential: DIMCredential;
  readonly recipientAddress: PolkadotAddress;
  readonly postIds: readonly PostId[];
  readonly corroborationCount: number;
  readonly sharePercent: number;
  readonly amount: PUSDAmount;
}

/**
 * Input for computing campaign allocation.
 */
export interface AllocationInput {
  readonly contributions: readonly CampaignContribution[];
  readonly campaignTopics: readonly string[];
  readonly totalFunding: PUSDAmount;
}

/**
 * Result of allocation computation.
 */
export interface AllocationResult {
  readonly shares: readonly AllocationShare[];
  readonly totalCorroborations: number;
  readonly contributorCount: number;
}

// ============================================================================
// Enhanced Campaign Types (Newsroom OS Extension)
// ============================================================================

/**
 * Types of rewards for campaign tiers.
 */
export type TierReward =
  | { readonly type: 'badge'; readonly badgeCid: string; readonly name: string }
  | { readonly type: 'recognition'; readonly level: 'bronze' | 'silver' | 'gold' | 'platinum' }
  | { readonly type: 'access'; readonly description: string };

/**
 * A contribution tier for a campaign.
 * Allows supporters to get different rewards based on contribution level.
 */
export interface CampaignTier {
  /** Unique identifier for the tier */
  readonly id: string;
  /** Display name */
  readonly name: string;
  /** Description of what this tier includes */
  readonly description: string;
  /** Minimum contribution amount for this tier */
  readonly minContribution: PUSDAmount;
  /** Rewards for this tier */
  readonly rewards: readonly TierReward[];
  /** Maximum supporters for this tier (optional limit) */
  readonly maxSupporters?: number;
  /** Current number of supporters at this tier */
  readonly currentSupporters: number;
}

/**
 * A supporter who has contributed to a campaign.
 */
export interface CampaignSupporter {
  /** Supporter's DIM credential */
  readonly credential: DIMCredential;
  /** Supporter's display pseudonym */
  readonly pseudonym: string;
  /** Tier they joined */
  readonly tierId: string;
  /** Total contribution amount */
  readonly contribution: PUSDAmount;
  /** Whether they opted in for contact */
  readonly optedInContact: boolean;
  /** Encrypted contact info (if opted in) */
  readonly contactInfo?: string;
  /** When they became a supporter */
  readonly supportedAt: number;
  /** Badges earned */
  readonly earnedBadges: readonly string[];
}

/**
 * A milestone for a campaign with optional NFT badge rewards.
 */
export interface CampaignMilestone {
  /** Unique identifier */
  readonly id: string;
  /** Milestone name */
  readonly name: string;
  /** Description of what this milestone represents */
  readonly description: string;
  /** Target amount to reach this milestone */
  readonly targetAmount: PUSDAmount;
  /** Current amount raised */
  readonly currentAmount: PUSDAmount;
  /** NFT badge CID to mint when milestone is reached (optional) */
  readonly badgeToMint?: string;
  /** Whether this milestone has been reached */
  readonly reached: boolean;
  /** When the milestone was reached (if applicable) */
  readonly reachedAt?: number;
}

/**
 * Extended campaign with tiers and milestones.
 */
export interface EnhancedCampaign extends Campaign {
  /** Contribution tiers */
  readonly tiers?: readonly CampaignTier[];
  /** Campaign milestones */
  readonly milestones?: readonly CampaignMilestone[];
  /** Supporters list (may be paginated in implementation) */
  readonly supporters?: readonly CampaignSupporter[];
  /** Total number of supporters */
  readonly supporterCount: number;
  /** Linked campaign IDs for cross-outlet amplification */
  readonly linkedCampaignIds?: readonly CampaignId[];
}

/**
 * Input for creating a campaign tier.
 */
export interface NewCampaignTier {
  readonly name: string;
  readonly description: string;
  readonly minContribution: PUSDAmount;
  readonly rewards: readonly TierReward[];
  readonly maxSupporters?: number;
}

/**
 * Input for creating a campaign milestone.
 */
export interface NewCampaignMilestone {
  readonly name: string;
  readonly description: string;
  readonly targetAmount: PUSDAmount;
  readonly badgeToMint?: string;
}

/**
 * Parameters for registering as a campaign supporter.
 */
export interface SupporterRegistration {
  readonly campaignId: CampaignId;
  readonly tierId: string;
  readonly contribution: PUSDAmount;
  readonly optInContact: boolean;
  readonly contactInfo?: string;
}
