/**
 * Alliance Governance Service implementation.
 *
 * Provides on-chain Alliance governance with snapshot-based voting.
 * Uses session cache for immediate feedback and Bulletin Chain for persistence.
 *
 * Governance Features:
 * - Proposal creation (BEACON+ tier required)
 * - Voting with snapshotted weights (SPARK+ tier required)
 * - Proposal execution after timelock
 * - Emergency proposals with higher thresholds
 */

import type {
  AllianceGovernanceService,
  AllianceGovernanceError,
  AllianceProposal,
  AllianceProposalPreview,
  AllianceProposalType,
  AllianceProposalStatus,
  AllianceVote,
  AllianceVotingProgress,
  AllianceGovernanceConfig,
  NewAllianceProposal,
  NewAllianceVote,
  PoolId,
  PolkadotAddress,
  TransactionHash,
  PaginationParams,
  PaginatedResult,
  Result,
  ContributorTier,
} from '@cocuyo/types';
import {
  ok,
  err,
  calculateAllianceVotingProgress,
  hasVotedOnAllianceProposal,
  allianceProposalToPreview,
  canCreateProposal,
  canVoteOnProposal,
  DEFAULT_ALLIANCE_GOVERNANCE,
  createTransactionHash,
} from '@cocuyo/types';
import {
  paginate,
  fetchFromBulletin,
  uploadToBulletin,
  getConnectedWallet,
  getConnectedCredential,
  getConnectedSigner,
  generateId,
} from './service-utils';
import { crowdstackingService } from './crowdstacking-service';
import { createLogger } from '../logging';
import { CHAIN_CONFIG } from '../chain/config';
import {
  getAllianceGovernanceClient,
  type AllianceGovernanceClient,
} from '../chain/contracts/alliance-governance';

const logger = createLogger('AllianceGovernanceService');

// ============================================================
// Constants
// ============================================================

/** Default voting duration in milliseconds (7 days) */
const DEFAULT_VOTING_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// Note: Execution delay constants are defined in DEFAULT_ALLIANCE_GOVERNANCE
// and will be used when implementing actual timelock execution

// ============================================================
// Session Cache
// ============================================================

const proposalsCache: AllianceProposal[] = [];
const CACHE_MAX_SIZE = 100;

// ============================================================
// Implementation
// ============================================================

export class AllianceGovernanceServiceImpl implements AllianceGovernanceService {
  async getProposal(proposalId: string): Promise<AllianceProposal | null> {
    // Check cache first
    const cached = proposalsCache.find((p) => p.id === proposalId);
    if (cached) return cached;

    // Try Bulletin Chain
    return fetchFromBulletin<AllianceProposal>(proposalId);
  }

  getProposalsForPool(params: {
    poolId: PoolId;
    type?: AllianceProposalType;
    status?: AllianceProposalStatus;
    pagination: PaginationParams;
  }): Promise<PaginatedResult<AllianceProposalPreview>> {
    let filtered = proposalsCache.filter((p) => p.poolId === params.poolId);

    // Filter by type
    if (params.type !== undefined) {
      filtered = filtered.filter((p) => p.proposalType === params.type);
    }

    // Filter by status (considering time-based status)
    if (params.status !== undefined) {
      filtered = filtered.filter((p) => this.computeStatus(p) === params.status);
    }

    // Sort by creation time (newest first)
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    // Convert to previews with computed status
    const previews = filtered.map((p) => ({
      ...allianceProposalToPreview(p),
      status: this.computeStatus(p),
    }));

    return Promise.resolve(paginate(previews, params.pagination));
  }

  getActiveProposals(poolId: PoolId): Promise<readonly AllianceProposalPreview[]> {
    const now = Date.now();
    const active = proposalsCache.filter(
      (p) => p.poolId === poolId && p.status === 'voting' && p.expiresAt > now
    );

    return Promise.resolve(
      active.map((p) => ({
        ...allianceProposalToPreview(p),
        status: this.computeStatus(p),
      }))
    );
  }

  async createProposal(
    newProposal: NewAllianceProposal
  ): Promise<Result<string, AllianceGovernanceError>> {
    const wallet = getConnectedWallet();
    const credential = getConnectedCredential();

    if (wallet === null || credential === null) {
      return err({ type: 'WALLET_NOT_CONNECTED' });
    }

    const address = wallet as PolkadotAddress;

    // Get contributor tier
    const position = await crowdstackingService.getPosition(address);
    const tier: ContributorTier = position?.tier ?? 'none';

    // Check if tier is sufficient for proposal creation
    const config = await this.getConfig(newProposal.poolId);
    if (!config) {
      // Use defaults
      if (
        !canCreateProposal(tier, { ...DEFAULT_ALLIANCE_GOVERNANCE, poolId: newProposal.poolId })
      ) {
        return err({
          type: 'BELOW_MIN_TIER',
          currentTier: tier,
          requiredTier: DEFAULT_ALLIANCE_GOVERNANCE.minProposalTier,
        });
      }
    } else if (!canCreateProposal(tier, config)) {
      return err({
        type: 'BELOW_MIN_TIER',
        currentTier: tier,
        requiredTier: config.minProposalTier,
      });
    }

    const now = Date.now();
    const votingDuration =
      newProposal.votingDuration !== undefined && newProposal.votingDuration > 0
        ? newProposal.votingDuration * 1000
        : DEFAULT_VOTING_DURATION_MS;

    // Determine thresholds based on proposal type
    const isEmergency = newProposal.payload.type === 'emergency';
    const approvalThreshold = isEmergency
      ? (config?.emergencyApprovalThreshold ??
        DEFAULT_ALLIANCE_GOVERNANCE.emergencyApprovalThreshold)
      : (config?.approvalThreshold ?? DEFAULT_ALLIANCE_GOVERNANCE.approvalThreshold);
    const quorumRequired =
      config?.quorumRequirement ?? DEFAULT_ALLIANCE_GOVERNANCE.quorumRequirement;

    // Get proposer's voting weight
    const weight = this.getWeightForTier(tier);

    // Create proposer's automatic vote
    const proposerVote: AllianceVote = {
      voter: credential,
      voterAddress: address,
      decision: 'approve',
      weight,
      voterTier: tier,
      rationale: `Proposer's automatic approval: ${newProposal.description}`,
      votedAt: now,
    };

    // Generate proposal ID
    const proposalId = generateId('alliance-proposal');

    const proposal: AllianceProposal = {
      id: proposalId,
      poolId: newProposal.poolId,
      proposalType: newProposal.payload.type,
      proposedBy: credential,
      proposerTier: tier,
      title: newProposal.title,
      description: newProposal.description,
      payload: newProposal.payload,
      votes: [proposerVote],
      minVotingTier: config?.minVotingTier ?? DEFAULT_ALLIANCE_GOVERNANCE.minVotingTier,
      quorumRequired,
      approvalThreshold,
      status: 'voting',
      createdAt: now,
      expiresAt: now + votingDuration,
    };

    // Upload to Bulletin Chain
    const uploadResult = await uploadToBulletin(proposal);
    if (!uploadResult.ok) {
      return err({ type: 'EXECUTION_FAILED', reason: uploadResult.error });
    }

    const proposalWithCid: AllianceProposal = {
      ...proposal,
      id: uploadResult.value.cid,
    };

    // Add to cache
    proposalsCache.unshift(proposalWithCid);
    while (proposalsCache.length > CACHE_MAX_SIZE) {
      proposalsCache.pop();
    }

    logger.info('Alliance proposal created', 'createProposal', {
      proposalId: proposalWithCid.id,
      poolId: newProposal.poolId,
      type: newProposal.payload.type,
      proposer: credential,
    });

    return ok(proposalWithCid.id);
  }

  async vote(
    proposalId: string,
    newVote: NewAllianceVote
  ): Promise<Result<AllianceVote, AllianceGovernanceError>> {
    const wallet = getConnectedWallet();
    const credential = getConnectedCredential();

    if (wallet === null || credential === null) {
      return err({ type: 'WALLET_NOT_CONNECTED' });
    }

    const address = wallet as PolkadotAddress;

    // Find proposal
    const proposalIndex = proposalsCache.findIndex((p) => p.id === proposalId);
    if (proposalIndex === -1) {
      return err({ type: 'PROPOSAL_NOT_FOUND', proposalId });
    }

    const proposal = proposalsCache[proposalIndex];
    if (!proposal) {
      return err({ type: 'PROPOSAL_NOT_FOUND', proposalId });
    }

    // Check status
    const currentStatus = this.computeStatus(proposal);
    if (currentStatus !== 'voting') {
      return err({ type: 'PROPOSAL_NOT_ACTIVE', status: currentStatus });
    }

    // Check voting period
    if (Date.now() > proposal.expiresAt) {
      return err({ type: 'VOTING_PERIOD_ENDED' });
    }

    // Check if already voted
    if (hasVotedOnAllianceProposal(proposal, credential)) {
      return err({ type: 'ALREADY_VOTED', voter: credential });
    }

    // Get contributor tier
    const position = await crowdstackingService.getPosition(address);
    const tier: ContributorTier = position?.tier ?? 'none';

    // Check voting eligibility
    const config = await this.getConfig(proposal.poolId);
    const effectiveConfig = config ?? { ...DEFAULT_ALLIANCE_GOVERNANCE, poolId: proposal.poolId };
    if (!canVoteOnProposal(tier, effectiveConfig)) {
      return err({
        type: 'BELOW_MIN_TIER',
        currentTier: tier,
        requiredTier: effectiveConfig.minVotingTier,
      });
    }

    // Get voting weight
    const weight = this.getWeightForTier(tier);

    const now = Date.now();

    // Create vote
    const voteRecord: AllianceVote = {
      voter: credential,
      voterAddress: address,
      decision: newVote.decision,
      weight,
      voterTier: tier,
      votedAt: now,
      ...(newVote.rationale !== undefined && newVote.rationale !== ''
        ? { rationale: newVote.rationale }
        : {}),
    };

    // Update proposal
    const updatedProposal: AllianceProposal = {
      ...proposal,
      votes: [...proposal.votes, voteRecord],
    };

    // Update cache
    proposalsCache[proposalIndex] = updatedProposal;

    // Persist to Bulletin Chain
    const uploadResult = await uploadToBulletin(updatedProposal);
    if (!uploadResult.ok) {
      // Rollback cache
      proposalsCache[proposalIndex] = proposal;
      return err({ type: 'EXECUTION_FAILED', reason: uploadResult.error });
    }

    logger.info('Vote cast', 'vote', {
      proposalId,
      voter: credential,
      decision: newVote.decision,
      weight,
    });

    return ok(voteRecord);
  }

  async getVotingProgress(proposalId: string): Promise<AllianceVotingProgress | null> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) return null;

    return calculateAllianceVotingProgress(proposal);
  }

  async getVotingPower(address: PolkadotAddress, _proposalId: string): Promise<number> {
    // Get current tier (in production, would use snapshotted weight from contract)
    const position = await crowdstackingService.getPosition(address);
    const tier: ContributorTier = position?.tier ?? 'none';

    return this.getWeightForTier(tier);
  }

  async hasVoted(proposalId: string, address: PolkadotAddress): Promise<boolean> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) return false;

    return proposal.votes.some((v) => v.voterAddress === address);
  }

  async executeProposal(
    proposalId: string
  ): Promise<Result<TransactionHash, AllianceGovernanceError>> {
    const proposalIndex = proposalsCache.findIndex((p) => p.id === proposalId);
    if (proposalIndex === -1) {
      return err({ type: 'PROPOSAL_NOT_FOUND', proposalId });
    }

    const proposal = proposalsCache[proposalIndex];
    if (!proposal) {
      return err({ type: 'PROPOSAL_NOT_FOUND', proposalId });
    }

    // Check status
    const currentStatus = this.computeStatus(proposal);
    if (currentStatus !== 'approved') {
      return err({ type: 'NOT_SUCCEEDED', status: currentStatus });
    }

    // Check timelock
    const config = await this.getConfig(proposal.poolId);
    const executionDelay =
      proposal.proposalType === 'emergency'
        ? (config?.emergencyExecutionDelay ?? DEFAULT_ALLIANCE_GOVERNANCE.emergencyExecutionDelay) *
          1000
        : (config?.executionDelay ?? DEFAULT_ALLIANCE_GOVERNANCE.executionDelay) * 1000;

    const finalizedAt = proposal.finalizedAt ?? proposal.expiresAt;
    const availableAt = finalizedAt + executionDelay;

    if (Date.now() < availableAt) {
      return err({ type: 'TIMELOCK_NOT_EXPIRED', availableAt });
    }

    // Execute proposal (in production, this would call the contract)
    const now = Date.now();
    const txHash = createTransactionHash(
      `0x${now.toString(16)}${Math.random().toString(16).slice(2)}`
    );

    // Update proposal status
    const executedProposal: AllianceProposal = {
      ...proposal,
      status: 'executed',
      finalizedAt: proposal.finalizedAt ?? now,
      executionTxHash: txHash,
    };

    proposalsCache[proposalIndex] = executedProposal;

    // Persist
    const uploadResult = await uploadToBulletin(executedProposal);
    if (!uploadResult.ok) {
      logger.warn('Failed to persist executed proposal', 'executeProposal', {
        proposalId,
        error: uploadResult.error,
      });
    }

    logger.info('Proposal executed', 'executeProposal', {
      proposalId,
      type: proposal.proposalType,
      txHash,
    });

    return ok(txHash);
  }

  async cancelProposal(proposalId: string): Promise<Result<void, AllianceGovernanceError>> {
    const credential = getConnectedCredential();

    if (credential === null) {
      return err({ type: 'WALLET_NOT_CONNECTED' });
    }

    const proposalIndex = proposalsCache.findIndex((p) => p.id === proposalId);
    if (proposalIndex === -1) {
      return err({ type: 'PROPOSAL_NOT_FOUND', proposalId });
    }

    const proposal = proposalsCache[proposalIndex];
    if (!proposal) {
      return err({ type: 'PROPOSAL_NOT_FOUND', proposalId });
    }

    // Only proposer can cancel
    if (proposal.proposedBy !== credential) {
      return err({ type: 'EXECUTION_FAILED', reason: 'Only the proposer can cancel' });
    }

    // Can only cancel active proposals
    if (proposal.status !== 'voting') {
      return err({ type: 'PROPOSAL_NOT_ACTIVE', status: proposal.status });
    }

    // Update status
    const cancelledProposal: AllianceProposal = {
      ...proposal,
      status: 'rejected', // Cancelled = rejected
      finalizedAt: Date.now(),
    };

    proposalsCache[proposalIndex] = cancelledProposal;

    // Persist
    const uploadResult = await uploadToBulletin(cancelledProposal);
    if (!uploadResult.ok) {
      logger.warn('Failed to persist cancelled proposal', 'cancelProposal', {
        proposalId,
        error: uploadResult.error,
      });
    }

    logger.info('Proposal cancelled', 'cancelProposal', { proposalId });

    return ok(undefined);
  }

  getConfig(poolId: PoolId): Promise<AllianceGovernanceConfig | null> {
    // Return default config (in production, would fetch from contract)
    return Promise.resolve({
      poolId,
      ...DEFAULT_ALLIANCE_GOVERNANCE,
    });
  }

  async canCreateProposal(address: PolkadotAddress, poolId: PoolId): Promise<boolean> {
    const position = await crowdstackingService.getPosition(address);
    const tier: ContributorTier = position?.tier ?? 'none';

    const config = await this.getConfig(poolId);
    return canCreateProposal(tier, config ?? { ...DEFAULT_ALLIANCE_GOVERNANCE, poolId });
  }

  async canVote(address: PolkadotAddress, poolId: PoolId): Promise<boolean> {
    const position = await crowdstackingService.getPosition(address);
    const tier: ContributorTier = position?.tier ?? 'none';

    const config = await this.getConfig(poolId);
    return canVoteOnProposal(tier, config ?? { ...DEFAULT_ALLIANCE_GOVERNANCE, poolId });
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * Compute the effective status of a proposal based on votes and time.
   */
  private computeStatus(proposal: AllianceProposal): AllianceProposalStatus {
    // If already finalized, return that status
    if (proposal.status === 'executed') return 'executed';
    if (proposal.status === 'rejected' && proposal.finalizedAt !== undefined) return 'rejected';

    const now = Date.now();

    // Still voting?
    if (proposal.status === 'voting' && now <= proposal.expiresAt) {
      return 'voting';
    }

    // Voting ended - compute outcome
    const progress = calculateAllianceVotingProgress(proposal);

    if (!progress.quorumReached) {
      return 'expired';
    }

    if (progress.thresholdReached) {
      return 'approved';
    }

    return 'rejected';
  }

  /**
   * Get governance weight for a tier.
   */
  private getWeightForTier(tier: ContributorTier): number {
    switch (tier) {
      case 'lighthouse':
        return 25;
      case 'beacon':
        return 10;
      case 'flame':
        return 3;
      case 'spark':
        return 1;
      default:
        return 0;
    }
  }
}

// ============================================================
// Chain-Backed Implementation
// ============================================================

/**
 * Chain-backed implementation of AllianceGovernanceService.
 *
 * Uses the AllianceGovernance smart contract for on-chain governance.
 * Falls back to cache for data that requires event indexing.
 */
export class ChainAllianceGovernanceServiceImpl implements AllianceGovernanceService {
  private readonly client: AllianceGovernanceClient;
  private readonly sessionFallback: AllianceGovernanceServiceImpl;

  constructor() {
    this.client = getAllianceGovernanceClient();
    this.sessionFallback = new AllianceGovernanceServiceImpl();
  }

  async getProposal(proposalId: string): Promise<AllianceProposal | null> {
    // Try chain first
    const chainProposal = await this.client.getProposal(proposalId);
    if (chainProposal) return chainProposal;

    // Fall back to session cache (for proposals created this session)
    return this.sessionFallback.getProposal(proposalId);
  }

  async getProposalsForPool(params: {
    poolId: PoolId;
    type?: AllianceProposalType;
    status?: AllianceProposalStatus;
    pagination: PaginationParams;
  }): Promise<PaginatedResult<AllianceProposalPreview>> {
    // Chain doesn't support querying by pool - would need event indexing
    // Use session fallback
    return this.sessionFallback.getProposalsForPool(params);
  }

  async getActiveProposals(poolId: PoolId): Promise<readonly AllianceProposalPreview[]> {
    // Would need event indexing to query active proposals
    return this.sessionFallback.getActiveProposals(poolId);
  }

  async createProposal(
    newProposal: NewAllianceProposal
  ): Promise<Result<string, AllianceGovernanceError>> {
    const wallet = getConnectedWallet();
    const credential = getConnectedCredential();
    const signer = getConnectedSigner();

    if (wallet === null || credential === null || signer === null) {
      return err({ type: 'WALLET_NOT_CONNECTED' });
    }

    const address = wallet as PolkadotAddress;

    // Get contributor tier
    const position = await crowdstackingService.getPosition(address);
    const tier: ContributorTier = position?.tier ?? 'none';

    // Check if tier is sufficient for proposal creation
    const config = await this.getConfig(newProposal.poolId);
    if (!config) {
      if (
        !canCreateProposal(tier, { ...DEFAULT_ALLIANCE_GOVERNANCE, poolId: newProposal.poolId })
      ) {
        return err({
          type: 'BELOW_MIN_TIER',
          currentTier: tier,
          requiredTier: DEFAULT_ALLIANCE_GOVERNANCE.minProposalTier,
        });
      }
    } else if (!canCreateProposal(tier, config)) {
      return err({
        type: 'BELOW_MIN_TIER',
        currentTier: tier,
        requiredTier: config.minProposalTier,
      });
    }

    try {
      // Encode payload based on type
      let payloadData: string;
      switch (newProposal.payload.type) {
        case 'outlet-add':
          payloadData = this.client.encodeOutletAdd(
            newProposal.payload.outletId,
            newProposal.payload.treasury as `0x${string}`,
            BigInt(newProposal.payload.initialWeight)
          );
          break;
        case 'outlet-remove':
          payloadData = this.client.encodeOutletRemove(newProposal.payload.outletId);
          break;
        case 'weight-change':
          payloadData = this.client.encodeWeightChange(
            newProposal.payload.newWeights.map((c) => c.outletId),
            newProposal.payload.newWeights.map((c) => BigInt(c.weight))
          );
          break;
        default:
          // For parameter-change and emergency, encode as JSON
          payloadData = '0x' + Buffer.from(JSON.stringify(newProposal.payload)).toString('hex');
      }

      // Create proposal on chain
      const result = await this.client.createProposal(
        newProposal.payload.type,
        payloadData,
        newProposal.description,
        signer
      );

      logger.info('Alliance proposal created on chain', 'createProposal', {
        proposalId: result.proposalId,
        txHash: result.txHash,
        type: newProposal.payload.type,
      });

      return ok(result.proposalId);
    } catch (error) {
      logger.error('Failed to create proposal on chain', 'createProposal', { error });
      return err({
        type: 'EXECUTION_FAILED',
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async vote(
    proposalId: string,
    newVote: NewAllianceVote
  ): Promise<Result<AllianceVote, AllianceGovernanceError>> {
    const wallet = getConnectedWallet();
    const credential = getConnectedCredential();
    const signer = getConnectedSigner();

    if (wallet === null || credential === null || signer === null) {
      return err({ type: 'WALLET_NOT_CONNECTED' });
    }

    const address = wallet as PolkadotAddress;

    // Get proposal from chain
    const proposal = await this.getProposal(proposalId);
    if (!proposal) {
      return err({ type: 'PROPOSAL_NOT_FOUND', proposalId });
    }

    // Check if already voted
    const alreadyVoted = await this.client.hasVoted(proposalId, address);
    if (alreadyVoted) {
      return err({ type: 'ALREADY_VOTED', voter: credential });
    }

    // Get contributor tier
    const position = await crowdstackingService.getPosition(address);
    const tier: ContributorTier = position?.tier ?? 'none';

    // Check voting eligibility
    const config = await this.getConfig(proposal.poolId);
    const effectiveConfig = config ?? { ...DEFAULT_ALLIANCE_GOVERNANCE, poolId: proposal.poolId };
    if (!canVoteOnProposal(tier, effectiveConfig)) {
      return err({
        type: 'BELOW_MIN_TIER',
        currentTier: tier,
        requiredTier: effectiveConfig.minVotingTier,
      });
    }

    try {
      // Cast vote on chain
      const txHash = await this.client.castVote(
        proposalId,
        newVote.decision,
        signer,
        newVote.rationale
      );

      // Get voting power for the vote record
      const weight = await this.client.getVotingPower(address, proposalId);

      const voteRecord: AllianceVote = {
        voter: credential,
        voterAddress: address,
        decision: newVote.decision,
        weight,
        voterTier: tier,
        votedAt: Date.now(),
        ...(newVote.rationale !== undefined && newVote.rationale !== ''
          ? { rationale: newVote.rationale }
          : {}),
      };

      logger.info('Vote cast on chain', 'vote', {
        proposalId,
        voter: credential,
        decision: newVote.decision,
        txHash,
      });

      return ok(voteRecord);
    } catch (error) {
      logger.error('Failed to cast vote on chain', 'vote', { error });
      return err({
        type: 'EXECUTION_FAILED',
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getVotingProgress(proposalId: string): Promise<AllianceVotingProgress | null> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) return null;

    return calculateAllianceVotingProgress(proposal);
  }

  async getVotingPower(address: PolkadotAddress, proposalId: string): Promise<number> {
    return this.client.getVotingPower(address, proposalId);
  }

  async hasVoted(proposalId: string, address: PolkadotAddress): Promise<boolean> {
    return this.client.hasVoted(proposalId, address);
  }

  async executeProposal(
    proposalId: string
  ): Promise<Result<TransactionHash, AllianceGovernanceError>> {
    const signer = getConnectedSigner();

    if (signer === null) {
      return err({ type: 'WALLET_NOT_CONNECTED' });
    }

    // Check proposal state
    const state = await this.client.getProposalState(proposalId);
    if (state !== 'approved') {
      return err({ type: 'NOT_SUCCEEDED', status: state });
    }

    try {
      const txHash = await this.client.executeProposal(proposalId, signer);

      logger.info('Proposal executed on chain', 'executeProposal', {
        proposalId,
        txHash,
      });

      return ok(txHash);
    } catch (error) {
      logger.error('Failed to execute proposal on chain', 'executeProposal', { error });

      // Check if it's a timelock error
      if (error instanceof Error && error.message.includes('timelock')) {
        return err({ type: 'TIMELOCK_NOT_EXPIRED', availableAt: Date.now() + 60000 });
      }

      return err({
        type: 'EXECUTION_FAILED',
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async cancelProposal(proposalId: string): Promise<Result<void, AllianceGovernanceError>> {
    const signer = getConnectedSigner();

    if (signer === null) {
      return err({ type: 'WALLET_NOT_CONNECTED' });
    }

    try {
      await this.client.cancelProposal(proposalId, signer);

      logger.info('Proposal cancelled on chain', 'cancelProposal', { proposalId });

      return ok(undefined);
    } catch (error) {
      logger.error('Failed to cancel proposal on chain', 'cancelProposal', { error });
      return err({
        type: 'EXECUTION_FAILED',
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getConfig(poolId: PoolId): Promise<AllianceGovernanceConfig | null> {
    // Get config from chain for default proposal type
    const chainConfig = await this.client.getConfig('outlet-add');
    if (chainConfig) {
      return chainConfig;
    }

    // Fall back to defaults
    return {
      poolId,
      ...DEFAULT_ALLIANCE_GOVERNANCE,
    };
  }

  async canCreateProposal(address: PolkadotAddress, poolId: PoolId): Promise<boolean> {
    const position = await crowdstackingService.getPosition(address);
    const tier: ContributorTier = position?.tier ?? 'none';

    const config = await this.getConfig(poolId);
    return canCreateProposal(tier, config ?? { ...DEFAULT_ALLIANCE_GOVERNANCE, poolId });
  }

  async canVote(address: PolkadotAddress, poolId: PoolId): Promise<boolean> {
    const position = await crowdstackingService.getPosition(address);
    const tier: ContributorTier = position?.tier ?? 'none';

    const config = await this.getConfig(poolId);
    return canVoteOnProposal(tier, config ?? { ...DEFAULT_ALLIANCE_GOVERNANCE, poolId });
  }
}

// ============================================================
// Singleton Export
// ============================================================

let serviceInstance: AllianceGovernanceService | null = null;

/**
 * Get the alliance governance service singleton.
 * Uses chain-backed implementation when CHAIN_CONFIG.features.useChainContracts is true.
 */
export function getAllianceGovernanceService(): AllianceGovernanceService {
  serviceInstance ??= CHAIN_CONFIG.features.useChainContracts
    ? new ChainAllianceGovernanceServiceImpl()
    : new AllianceGovernanceServiceImpl();
  return serviceInstance;
}

// ============================================================
// Test Helpers
// ============================================================

/**
 * Clear all Alliance governance caches. Use in tests for isolation.
 */
export function clearAllianceGovernanceCache(): void {
  proposalsCache.length = 0;
}

/**
 * Add a proposal directly to cache. Use in tests for seeding.
 */
export function addAllianceProposalToCache(proposal: AllianceProposal): void {
  proposalsCache.unshift(proposal);
  while (proposalsCache.length > CACHE_MAX_SIZE) {
    proposalsCache.pop();
  }
}

/**
 * Get cache stats for debugging.
 */
export function getAllianceGovernanceCacheStats(): {
  proposalsCount: number;
  maxSize: number;
} {
  return {
    proposalsCount: proposalsCache.length,
    maxSize: CACHE_MAX_SIZE,
  };
}
