/**
 * @cocuyo/types
 *
 * Shared TypeScript types for the Firefly Network.
 * These types are designed to map 1:1 to future on-chain data structures.
 */

// Branded types for type-safe identifiers
export type {
  ChainId,
  CorroborationId,
  CampaignId,
  FireflyId,
  CollectiveId,
  VerificationRequestId,
  DIMCredential,
  ContentHash,
  PolkadotAddress,
  H160Address,
  TransactionHash,
  EscrowId,
  CoinPublicKey,
  PostId,
  ClaimId,
  VerdictId,
  OutletId,
  CommunityId,
  OrganizationId,
  TreasuryId,
  PoolId,
  WithdrawalRequestId,
} from './brands';

export {
  createChainId,
  createCorroborationId,
  createCampaignId,
  createFireflyId,
  createCollectiveId,
  createVerificationRequestId,
  createDIMCredential,
  createContentHash,
  createPolkadotAddress,
  createH160Address,
  createTransactionHash,
  createEscrowId,
  createCoinPublicKey,
  createPostId,
  createClaimId,
  createVerdictId,
  createOutletId,
  createCommunityId,
  createOrganizationId,
  createTreasuryId,
  createPoolId,
  createWithdrawalRequestId,
} from './brands';

// Post types (replaces Signal types)
export type {
  PostStatus,
  GeoCoordinate,
  TimeRange,
  MediaAttachment,
  PostContent,
  PostContext,
  PostVerification,
  Post,
  PostPreview,
  NewPost,
} from './post';

export { MAX_POST_PHOTOS } from './post';

// Claim types
export type {
  ClaimStatus,
  ClaimEvidence,
  ClaimVerdict,
  Claim,
  ClaimPreview,
  NewClaim,
  NewClaimEvidence,
  VerdictStatus,
  Verdict,
  NewVerdict,
  // Enhanced claim types (Newsroom OS)
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

// Verdict voting types (multi-sig)
export type {
  ProposalStatus,
  VerdictVote,
  VerdictProposal,
  NewVerdictProposal,
  NewVerdictVote,
  VotingProgress,
  // MobRule extensions (Stewardship Court)
  CaseState,
  CounterEvidence,
  TurnoutRequirement,
  SettlementCallback,
  VerdictProposalV2,
  NewVerdictProposalV2,
  TurnoutCheckResult,
  WeightedVotingProgress,
} from './verdict-voting';

export {
  calculateVotingProgress,
  hasVoted,
  getMemberVote,
  // MobRule utilities
  getCaseState,
  checkTurnout,
  calculateVoteWeight,
  calculateWeightedVotingProgress,
  isV2Proposal,
  toV2Proposal,
  formatTimeUntilDeadline,
} from './verdict-voting';

// Identity types
export type {
  DisclosureLevel,
  PublicProfileInfo,
  ReputationScore,
  FireflyStats,
  FireflyProfile,
  FireflyAuthor,
  NewFireflyProfile,
  FactCheckerStatus,
  CollectiveMembershipSummary,
  FireflyProfileUpdate,
  PublicFireflyProfile,
  PostPreviewForProfile,
  // User identity (RFC 0014)
  DotNsIdentifier,
  UserIdentity,
  UserIdentityError,
} from './identity';

export { createDotNsIdentifier } from './identity';

// Collective types
export type {
  MemberRole,
  MembershipApproval,
  CollectiveMember,
  CollectiveGovernance,
  CollectiveReputation,
  Collective,
  CollectivePreview,
  NewCollective,
  JoinRequestStatus,
  JoinRequest,
} from './collective';

// Organization types
export type {
  OrganizationType,
  OrganizationRole,
  OrganizationPermission,
  OrganizationMembershipApproval,
  OrganizationMember,
  OrganizationGovernance,
  OrganizationReputation,
  Organization,
  OrganizationPreview,
  NewOrganization,
  InvitationStatus,
  OrganizationInvitation,
  OrganizationJoinRequest,
} from './organization';

export {
  ROLE_PERMISSIONS,
  DEFAULT_GOVERNANCE,
  getPermissionsForRole,
  roleHasPermission,
  organizationToPreview,
} from './organization';

// Governance types
export type {
  ProposalType,
  GovernanceProposalStatus,
  BudgetCategory,
  VerdictProposalPayload,
  MembershipProposalPayload,
  RoleChangeProposalPayload,
  BudgetProposalPayload,
  PolicyChange,
  PolicyProposalPayload,
  DisputeProposalPayload,
  ProposalPayload,
  VoteDecision,
  GovernanceVote,
  VotingPower,
  GovernanceProposal,
  GovernanceProposalPreview,
  NewGovernanceProposal,
  NewGovernanceVote,
  GovernanceVotingProgress,
} from './governance';

export {
  calculateGovernanceVotingProgress,
  hasVotedOnProposal,
  getMemberProposalVote,
  proposalToPreview,
} from './governance';

// Treasury types
export type {
  TreasuryTransactionType,
  TreasuryTransactionStatus,
  DepositSource,
  TreasuryBalance,
  TreasuryTransaction,
  TreasuryConfig,
  BudgetSummary,
  BalanceSnapshot,
  NewTreasury,
  WithdrawalProposal,
  TreasuryPreview,
} from './treasury';

export { createEmptyBalance, requiresMoreApprovals, hasApproved } from './treasury';

// Verification types
export type {
  VerificationStatus,
  VerificationRequestStatus,
  VerificationEvidence,
  VerificationVote,
  VoteSummary,
  VerificationVerdict,
  VerificationRequest,
  VerificationRequestPreview,
  NewEvidence,
  NewVote,
} from './verification';

// Chain types
export type { ChainStatus, ChainStats, StoryChain, ChainPreview } from './chain';

// Corroboration types
export type {
  CorroborationType,
  EvidenceType,
  EvidenceQuality,
  Corroboration,
  CorroborationSummary,
  NewCorroboration,
} from './corroboration';

export { emptyCorroborationSummary } from './corroboration';

// Campaign types
export type {
  CampaignStatus,
  CampaignSponsor,
  DeliverableType,
  CampaignDeliverable,
  Campaign,
  CampaignPreview,
  NewCampaign,
  CampaignPayout,
  PayoutDistribution,
  CampaignContribution,
  AllocationShare,
  AllocationInput,
  AllocationResult,
  // Enhanced campaign types
  TierReward,
  CampaignTier,
  CampaignSupporter,
  CampaignMilestone,
  EnhancedCampaign,
  NewCampaignTier,
  NewCampaignMilestone,
  SupporterRegistration,
} from './campaign';

// Outlet types
export type { Outlet, OutletPreview } from './outlet';

// Firefly types
export type {
  TopicReputation,
  FireflyState,
  WalletStatus,
  WalletState,
  WalletActions,
} from './firefly';

// Personhood types
export type { PersonhoodLevel, PersonhoodCapabilities } from './personhood';
export {
  PERSONHOOD_CAPABILITIES,
  getCapabilities,
  canPerform,
  canFundAmount,
  canClaimAmount,
} from './personhood';

// Reputation topic types
export type { ReputationTopic, TopicMetadata } from './reputation-topics';
export {
  REPUTATION_TOPICS,
  TOPIC_METADATA,
  isReputationTopic,
  getTopicMetadata,
  classifyTopics,
} from './reputation-topics';

// Reputation decay types
export type { ReputationAction, ReputationDecayConfig, ActivityRecord } from './reputation-decay';
export {
  REPUTATION_ACTIONS,
  DEFAULT_DECAY_CONFIG,
  AGGRESSIVE_DECAY_CONFIG,
  LENIENT_DECAY_CONFIG,
  calculateDecayedReputation,
  getDaysUntilDecay,
  isDecaying,
  getDecayPercentage,
  projectReputation,
  isDecayResetAction,
} from './reputation-decay';

// Analytics types
export type {
  AnalyticsPeriod,
  FundingBreakdown,
  FundingMetrics,
  ReachMetrics,
  TopicCount,
  VerdictAccuracy,
  ImpactMetrics,
  NetworkActivity,
  NetworkHealthMetrics,
  RankingCategory,
  OutletRanking,
  LeaderboardResult,
  ContributorMetrics,
  PeriodComparison,
} from './analytics';

// Service interfaces
export type {
  Result,
  PaginationParams,
  PaginatedResult,
  PostService,
  ChainService,
  CorroborationService,
  CampaignService,
  EnhancedCampaignService,
  OutletService,
  ClaimService,
  EnhancedClaimService,
  VerdictService,
  CollectiveService,
  VerdictProposalService,
  // Organization services
  OrganizationService,
  // Governance services
  GovernanceError,
  GovernanceService,
  // Alliance Governance services
  AllianceGovernanceError,
  AllianceGovernanceService,
  // Treasury services
  TreasuryError,
  TreasuryService,
  // Reputation services
  ReputationError,
  TopicReputationScore,
  ReputationProfile,
  ReputationService,
  // Personhood services
  PersonhoodError,
  PersonhoodState,
  PersonhoodService,
  AttestationStatus,
  AttestationEligibility,
  ExtendedPersonhoodService,
  // Payment services
  PaymentError,
  PaymentService,
  EscrowError,
  EscrowState,
  EscrowService,
  CoinageError,
  CoinageService,
  PaymentRouter,
  // Profile services
  FireflyProfileService,
  // Analytics services
  AnalyticsError,
  AnalyticsService,
  // CoinPayment services (RFC 0017)
  CoinPaymentResult,
  CoinPaymentService,
  // Notification services (RFC 0019)
  NotificationResult,
  NotificationService,
} from './services';

export { ok, err } from './services';

// Currency types (pUSD)
export type { PUSDAmount, PUSDBalance } from './currency';
export {
  PUSD,
  createPUSDAmount,
  parsePUSD,
  parsePUSDCents,
  toPUSDCents,
  formatPUSD,
  formatPUSDCompact,
  addPUSD,
  subtractPUSD,
  multiplyPUSD,
  comparePUSD,
  meetsMinimumTransfer,
  createPUSDBalance,
  ZERO_PUSD,
} from './currency';

// Coinage types (private payments)
export type {
  CoinExponent,
  Coin,
  CoinWallet,
  PendingTransfer,
  TransferPackage,
  RecyclerVoucher,
  RecyclerClaimToken,
  ClaimTokenAllocation,
  CoinHoldingsSummary,
} from './coinage';
export {
  COIN_VALUES_CENTS,
  COINAGE_CONFIG,
  getCoinValueCents,
  getCoinValueDollars,
  formatCoinValue,
  canTransfer,
  canRecycle,
  mustRecycle,
  decomposeAmountCents,
  totalCoinValueCents,
  validateSplit,
  createEmptyCoinWallet,
  calculateHoldingsSummary,
} from './coinage';

// Payment mode types
export type { PaymentMode, PaymentUseCase, PaymentModeContext } from './payment-mode';
export {
  DEFAULT_MODES,
  HIGH_SENSITIVITY_CASES,
  PUBLIC_REQUIRED_CASES,
  selectPaymentMode,
  supportsBothModes,
  describePaymentMode,
  getRecommendation,
} from './payment-mode';

// Crowdstacking types (pooled capital for outlets)
export type {
  ContributorTier,
  ContributorPosition,
  WithdrawalRequestStatus,
  WithdrawalRequest,
  PoolState,
  OutletAllocation,
  DistributionEvent,
  PoolStats,
} from './crowdstacking';

export {
  TIER_THRESHOLDS,
  TIER_GOVERNANCE_WEIGHTS,
  SHARE_PRECISION,
  INITIAL_SHARE_PRICE,
  WITHDRAWAL_COOLDOWN_SECONDS,
  MIN_CONTRIBUTION,
  BASIS_POINTS,
  getTierForAmount,
  getGovernanceWeight,
  getNextTier,
  calculateShareValue,
  calculateSharesForContribution,
  calculateSharePriceAfterYield,
  calculateSharePriceAfterLoss,
  meetsMinimumContribution,
  getWithdrawalCooldownRemaining,
  isWithdrawalReady,
  validateOutletWeights,
  calculateDistributions,
} from './crowdstacking';

// Alliance Governance types (crowdstacking-specific governance)
export type {
  AllianceProposalType,
  AllianceProposalStatus,
  OutletAddPayload,
  OutletRemovePayload,
  WeightChangePayload,
  PoolParameter,
  ParameterChangePayload,
  EmergencyAction,
  EmergencyPayload,
  AllianceProposalPayload,
  AllianceVoteDecision,
  AllianceVote,
  AllianceVoteTally,
  AllianceProposal,
  AllianceProposalPreview,
  NewAllianceProposal,
  NewAllianceVote,
  AllianceVotingProgress,
  AllianceGovernanceConfig,
} from './alliance-governance';

export {
  DEFAULT_ALLIANCE_GOVERNANCE,
  calculateAllianceVotingProgress,
  hasVotedOnAllianceProposal,
  getAllianceVote,
  allianceProposalToPreview,
  canCreateProposal,
  canVoteOnProposal,
  validateWeightChange,
} from './alliance-governance';

// Product Account types (ProductAccountId signing)
export type {
  DerivationIndex,
  ProductAccountId,
  SignerPayloadJSON,
  SigningResult,
} from './product-account';

export {
  createDerivationIndex,
  createProductAccountId,
  getDefaultProductAccountId,
  getAccountIdentifier,
  getAccountDerivationIndex,
  isDefaultAccount,
  formatProductAccountId,
} from './product-account';

// Notification types (RFC 0019 - scheduled notifications)
export type {
  NotificationId,
  PushNotificationRequest,
  NotificationDeliveryStatus,
  ScheduledNotificationInfo,
  PushNotificationError,
} from './notification';

export {
  createNotificationId,
  SCHEDULED_NOTIFICATION_LIMIT,
  isScheduledNotification,
  validateScheduledTime,
} from './notification';

// CoinPayment types (RFC 0017 - dotUSD purse management)
export type {
  CoinPaymentPurseId,
  CoinPaymentBalance,
  CoinPaymentReceivable,
  CoinPaymentPurseInfo,
  CoinPaymentCheque,
  CoinPaymentClearingReference,
  CoinPaymentStatus,
  CoinPaymentError,
  CoinPaymentChannel,
  CoinPaymentListenItem,
} from './coin-payment';

export {
  MAIN_PURSE,
  MAX_PURSES,
  createCoinPaymentPurseId,
  createCoinPaymentBalance,
  createCoinPaymentReceivable,
  formatCoinPaymentBalance,
  parseCoinPaymentBalance,
  isMainPurse,
} from './coin-payment';

// Credential derivation (canonical source of truth)
export {
  deriveCredential,
  deriveCredentialFromString,
  extractAddressFromCredential,
  credentialMatchesAddress,
} from './credential';

// URL safety utilities
export {
  isSafeUrl,
  isSafeUrlWithHttp,
  sanitizeUrl,
  extractDomain,
  isFromAllowedDomain,
} from './url-utils';

// Validators (runtime type checking for external data)
export {
  // Schemas
  StoryChainSchema,
  PostSchema,
  ChainPreviewSchema,
  PostPreviewSchema,
  // Parse functions (throw on invalid)
  parseStoryChain,
  parsePost,
  parseChainPreview,
  parsePostPreview,
  // Safe parse functions (return null on invalid)
  safeParseStoryChain,
  safeParsePost,
  safeParseChainPreview,
  safeParsePostPreview,
  // DIM credential validation
  validateDIMCredential,
  // CoinPayment validators (RFC 0017)
  CoinPaymentPurseIdSchema,
  CoinPaymentBalanceSchema,
  CoinPaymentReceivableSchema,
  CoinPaymentPurseInfoSchema,
  CoinPaymentChequeSchema,
  CoinPaymentClearingReferenceSchema,
  CoinPaymentErrorSchema,
  parseCoinPaymentPurseInfo,
  safeParseCoinPaymentPurseInfo,
  parseCoinPaymentCheque,
  safeParseCoinPaymentCheque,
} from './validators';
