/**
 * Public and internal types for the app-state domain hooks and provider.
 *
 * The public surface (AppState, AppStateActions, AppStateContextValue) is the
 * exact contract consumed via useAppState() and MUST NOT change shape.
 */

import type {
  Post,
  PostId,
  NewPost,
  Corroboration,
  CorroborationId,
  Claim,
  ClaimId,
  Campaign,
  CampaignId,
  StoryChain,
  ChainId,
  Verdict,
  VerdictId,
  VerdictStatus,
  DIMCredential,
  Result,
} from '@cocuyo/types';

/** Evidence input for corroborate/dispute actions */
export interface EvidenceInput {
  type: import('@cocuyo/types').EvidenceType;
  content: string;
  description?: string;
}

/** Input for creating a campaign */
export interface NewCampaignInput {
  title: string;
  description: string;
  topics: string[];
  fundingAmount: number;
  expiresInDays: number;
  targetClaimIds?: ClaimId[];
  /** Real on-chain funding tx hash, when the bounty was funded via a native-PAS payment. */
  fundingTxHash?: string;
  /**
   * Deterministic bytes32 id of the on-chain BountyEscrow bounty this campaign
   * funded. Recorded so the persisted campaign references the exact on-chain
   * bounty (enables later reconciliation of an orphaned on-chain transfer).
   */
  onChainBountyId?: string;
}

/** Input for issuing a verdict */
export interface VerdictInput {
  status: VerdictStatus;
  rationale: string;
}

/** User state within the app */
export interface CurrentUser {
  /** Whether wallet is connected */
  isConnected: boolean;
  /** Whether user can create bounties (outlet/collective mode) */
  isOutletAccount: boolean;
  /** DIM credential hash (derived from wallet address) */
  credentialHash: DIMCredential | null;
  /** User's pseudonym */
  pseudonym: string | null;
  /** IDs of posts created by this user in current session */
  createdPostIds: PostId[];
  /** IDs of stories created by this user in current session */
  createdStoryIds: ChainId[];
  /** IDs of corroborations made by this user in current session */
  corroborationIds: CorroborationId[];
}

/** Core application state */
export interface AppState {
  // Core entities
  posts: Map<PostId, Post>;
  corroborations: Map<CorroborationId, Corroboration>;
  claims: Map<ClaimId, Claim>;
  campaigns: Map<CampaignId, Campaign>;
  storyChains: Map<ChainId, StoryChain>;
  verdicts: Map<VerdictId, Verdict>;

  // User state
  currentUser: CurrentUser;

  // Derived mappings
  postClaims: Map<PostId, ClaimId[]>;
  postCorroborations: Map<PostId, CorroborationId[]>;
  postCampaigns: Map<PostId, CampaignId[]>;
  campaignPosts: Map<CampaignId, PostId[]>;
  claimVerdicts: Map<ClaimId, VerdictId | null>;
  claimCampaigns: Map<ClaimId, CampaignId[]>;
}

/** Actions available on the app state */
export interface AppStateActions {
  /** Create a new post */
  createPost: (input: NewPost) => Post | null;
  /** Submit a corroboration or dispute with evidence (uploads to Bulletin Chain) */
  submitCorroboration: (
    postId: PostId,
    type: 'corroborate' | 'dispute',
    evidence?: EvidenceInput
  ) => Promise<Result<Corroboration, string>>;
  /** Extract a claim from a post (uploads to Bulletin Chain) */
  extractClaim: (postId: PostId, statement: string, topics?: string[]) => Promise<Claim | null>;
  /** Create a campaign (requires outlet mode) */
  createCampaign: (input: NewCampaignInput, targetPostId?: PostId) => Campaign | null;
  /** Contribute a post to a campaign */
  contributeToCampaign: (campaignId: CampaignId, postId: PostId) => boolean;
  /** Issue a verdict on a claim (requires outlet mode) */
  issueVerdict: (claimId: ClaimId, verdict: VerdictInput) => Verdict | null;
  /** Submit a claim for fact-checking by collectives */
  submitClaimForFactCheck: (claimId: ClaimId) => boolean;
  /** Create a new story chain */
  createStory: (
    title: string,
    description: string,
    firstPostId: PostId,
    topics?: string[]
  ) => StoryChain | null;
  /** Add a post to an existing story */
  addPostToStory: (chainId: ChainId, postId: PostId) => boolean;
  /** Toggle outlet mode for demos */
  toggleOutletMode: () => void;

  // Getters for convenience
  getPost: (id: PostId) => Post | undefined;
  getClaim: (id: ClaimId) => Claim | undefined;
  getCampaign: (id: CampaignId) => Campaign | undefined;
  getStory: (id: ChainId) => StoryChain | undefined;
  getPostClaims: (postId: PostId) => Claim[];
  getPostCorroborations: (postId: PostId) => Corroboration[];
  getPostCampaigns: (postId: PostId) => Campaign[];
  getClaimCampaigns: (claimId: ClaimId) => Campaign[];
  getAllPosts: () => Post[];
  getAllClaims: () => Claim[];
  getAllCampaigns: () => Campaign[];
  getAllStories: () => StoryChain[];
}

/** Combined context value */
export type AppStateContextValue = AppState & AppStateActions;
