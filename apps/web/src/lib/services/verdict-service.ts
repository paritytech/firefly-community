/**
 * Verdict Service implementation with multi-sig voting.
 *
 * Provides:
 * - Verdict proposal creation and voting
 * - Threshold checking and finalization
 * - Bulletin Chain storage for proposals and verdicts
 *
 * Extended with MobRule-style dispute resolution (Stewardship Court):
 * - Counter-evidence windows for respondent defense
 * - Turnout requirements for valid verdicts
 * - Time-weighted voting (early votes count more)
 * - Settlement callbacks for post-verdict actions
 */

import type {
  VerdictService,
  VerdictProposalService,
  Verdict,
  VerdictId,
  ClaimId,
  CollectiveId,
  Result,
  NewVerdict,
  VerdictProposal,
  NewVerdictProposal,
  NewVerdictVote,
  VerdictVote,
  VerdictStatus,
  // MobRule types
  VerdictProposalV2,
  NewVerdictProposalV2,
  CounterEvidence,
  CaseState,
  WeightedVotingProgress,
} from '@cocuyo/types';
import {
  ok,
  err,
  createVerdictId,
  calculateVotingProgress,
  hasVoted,
  // MobRule utilities
  getCaseState,
  calculateWeightedVotingProgress,
  isV2Proposal,
  toV2Proposal,
} from '@cocuyo/types';
import {
  getConnectedWallet,
  getConnectedCredential,
  uploadToBulletin,
  fetchFromBulletin,
  generateId,
} from './service-utils';
import { collectiveService } from './collective-service';
import { createLogger } from '../logging';
import {
  COUNTER_EVIDENCE_WINDOW_MS,
  VOTING_PERIOD_MS,
  VOTE_DECAY_HALF_LIFE_MS,
  DEFAULT_TURNOUT,
} from './verdict-constants';

const logger = createLogger('VerdictService');

/**
 * Session caches — in-memory storage for verdicts and proposals.
 *
 * INVALIDATION STRATEGY: These caches persist for the lifetime of the JS module.
 * - In development: Hot reloads clear the cache (new module instance).
 * - In production (serverless): Each cold start clears the cache.
 * - In production (long-lived): Cache grows unbounded until process restart.
 *
 * For production use, consider:
 * 1. Adding TTL-based eviction
 * 2. Using external cache (Redis) for shared state across instances
 * 3. Implementing cache size limits with LRU eviction
 *
 * Current design is acceptable for development and low-traffic scenarios.
 */
const verdictsCache: Verdict[] = [];
const proposalsCache: (VerdictProposal | VerdictProposalV2)[] = [];

// Map of claim ID to verdict ID for quick lookup
const claimToVerdictMap = new Map<string, string>();

// Default proposal expiry: 7 days (counter-evidence + voting period)
const DEFAULT_PROPOSAL_EXPIRY_MS = COUNTER_EVIDENCE_WINDOW_MS + VOTING_PERIOD_MS;

/**
 * Generate a unique proposal ID.
 */
function generateProposalId(): string {
  return generateId('proposal');
}

/**
 * Sign a vote (placeholder - in production this would use actual cryptographic signing).
 */
function signVote(vote: Omit<VerdictVote, 'signature'>): string {
  // In production, this would use the wallet's signRaw to sign the vote data
  const voteData = JSON.stringify({
    voter: vote.voter,
    decision: vote.decision,
    rationale: vote.rationale,
    votedAt: vote.votedAt,
  });
  // Placeholder signature - would be replaced with actual signing
  return `sig:${Buffer.from(voteData).toString('base64').slice(0, 32)}`;
}

export class VerdictServiceImpl implements VerdictService {
  async getVerdict(id: VerdictId): Promise<Verdict | null> {
    // Check cache first
    const cached = verdictsCache.find((v) => v.id === id);
    if (cached) return cached;

    // Try Bulletin Chain
    return fetchFromBulletin<Verdict>(id);
  }

  async getVerdictForClaim(claimId: ClaimId): Promise<Verdict | null> {
    // Check mapping first
    const verdictId = claimToVerdictMap.get(claimId);
    if (verdictId !== undefined) {
      return this.getVerdict(verdictId as VerdictId);
    }

    // Search cache
    const cached = verdictsCache.find((v) => v.claimId === claimId);
    if (cached) {
      claimToVerdictMap.set(claimId, cached.id);
      return cached;
    }

    return null;
  }

  async issueVerdict(newVerdict: NewVerdict): Promise<Result<VerdictId, string>> {
    const credential = getConnectedCredential();
    if (!credential) {
      return err('Wallet not connected. Please connect to issue a verdict.');
    }

    // Create verdict with temporary ID
    const verdict: Verdict = {
      id: '' as VerdictId,
      claimId: newVerdict.claimId,
      collectiveId: 'system' as CollectiveId, // Direct verdicts are from system
      status: newVerdict.status,
      rationale: newVerdict.rationale,
      issuedAt: Date.now(),
    };

    // Upload to Bulletin Chain
    const uploadResult = await uploadToBulletin(verdict);
    if (!uploadResult.ok) {
      return err(uploadResult.error);
    }

    const verdictWithId: Verdict = {
      ...verdict,
      id: createVerdictId(uploadResult.value.cid),
    };

    verdictsCache.unshift(verdictWithId);
    claimToVerdictMap.set(newVerdict.claimId, verdictWithId.id);

    logger.debug('Verdict issued', 'issueVerdict', {
      verdictId: verdictWithId.id,
      claimId: newVerdict.claimId,
      status: newVerdict.status,
    });

    return ok(verdictWithId.id);
  }
}

export class VerdictProposalServiceImpl implements VerdictProposalService {
  async getProposal(proposalId: string): Promise<VerdictProposal | null> {
    // Check cache first
    const cached = proposalsCache.find((p) => p.id === proposalId);
    if (cached) return cached;

    // Try Bulletin Chain
    return fetchFromBulletin<VerdictProposal>(proposalId);
  }

  getProposalsForClaim(claimId: ClaimId): Promise<readonly VerdictProposal[]> {
    // Return all proposals for this claim from cache
    return Promise.resolve(proposalsCache.filter((p) => p.claimId === claimId));
  }

  getActiveProposalsForCollective(collectiveId: CollectiveId): Promise<readonly VerdictProposal[]> {
    const now = Date.now();
    return Promise.resolve(
      proposalsCache.filter(
        (p) => p.collectiveId === collectiveId && p.status === 'voting' && p.expiresAt > now
      )
    );
  }

  async createProposal(newProposal: NewVerdictProposal): Promise<Result<string, string>> {
    const wallet = getConnectedWallet();
    const credential = getConnectedCredential();

    if (wallet === null || credential === null) {
      return err('Wallet not connected. Please connect to create a proposal.');
    }

    // Verify user is a member of the collective
    const isMember = await collectiveService.isMember(newProposal.collectiveId, credential);
    if (!isMember) {
      return err('You must be a member of this collective to create proposals.');
    }

    // Get collective governance settings
    const collective = await collectiveService.getCollective(newProposal.collectiveId);
    if (!collective) {
      return err('Collective not found.');
    }

    // Check for existing active proposals on this claim
    const existingProposals = await this.getProposalsForClaim(newProposal.claimId);
    const activeProposal = existingProposals.find(
      (p) => p.collectiveId === newProposal.collectiveId && p.status === 'voting'
    );
    if (activeProposal) {
      return err('An active proposal already exists for this claim from your collective.');
    }

    const now = Date.now();
    const proposalId = generateProposalId();

    // Create the proposer's vote automatically
    const proposerVote: VerdictVote = {
      voter: credential,
      decision: newProposal.proposedStatus,
      rationale: newProposal.rationale,
      signature: signVote({
        voter: credential,
        decision: newProposal.proposedStatus,
        rationale: newProposal.rationale,
        votedAt: now,
      }),
      votedAt: now,
    };

    const proposal: VerdictProposal = {
      id: proposalId,
      claimId: newProposal.claimId,
      collectiveId: newProposal.collectiveId,
      proposedBy: credential,
      proposedStatus: newProposal.proposedStatus,
      rationale: newProposal.rationale,
      votes: [proposerVote],
      requiredVotes: collective.governance.minVotesForVerdict,
      threshold: collective.governance.verdictThreshold,
      status: 'voting',
      createdAt: now,
      expiresAt: now + DEFAULT_PROPOSAL_EXPIRY_MS,
    };

    // Upload to Bulletin Chain
    const uploadResult = await uploadToBulletin(proposal);
    if (!uploadResult.ok) {
      return err(uploadResult.error);
    }

    // Update proposal with CID as new ID
    const proposalWithCid: VerdictProposal = {
      ...proposal,
      id: uploadResult.value.cid,
    };

    proposalsCache.unshift(proposalWithCid);

    logger.debug('Proposal created', 'createProposal', {
      proposalId: proposalWithCid.id,
      claimId: newProposal.claimId,
      collectiveId: newProposal.collectiveId,
      proposedStatus: newProposal.proposedStatus,
    });

    return ok(proposalWithCid.id);
  }

  async vote(proposalId: string, newVote: NewVerdictVote): Promise<Result<VerdictVote, string>> {
    const wallet = getConnectedWallet();
    const credential = getConnectedCredential();

    if (wallet === null || credential === null) {
      return err('Wallet not connected. Please connect to vote.');
    }

    // Get the proposal
    const proposalIndex = proposalsCache.findIndex((p) => p.id === proposalId);
    if (proposalIndex === -1) {
      return err('Proposal not found.');
    }

    const proposal = proposalsCache[proposalIndex];
    if (!proposal) {
      return err('Proposal not found.');
    }

    // Check proposal is still active
    if (proposal.status !== 'voting') {
      return err(`Proposal is no longer accepting votes (status: ${proposal.status}).`);
    }

    if (proposal.expiresAt < Date.now()) {
      return err('Proposal has expired.');
    }

    // Verify user is a member of the collective
    const isMember = await collectiveService.isMember(proposal.collectiveId, credential);
    if (!isMember) {
      return err('You must be a member of this collective to vote.');
    }

    // Check if already voted
    if (hasVoted(proposal, credential)) {
      return err('You have already voted on this proposal.');
    }

    // Create the vote
    const now = Date.now();
    const voteBase = {
      voter: credential,
      decision: newVote.decision,
      votedAt: now,
    };
    const signatureInput =
      newVote.rationale !== undefined ? { ...voteBase, rationale: newVote.rationale } : voteBase;
    const vote: VerdictVote =
      newVote.rationale !== undefined
        ? {
            ...voteBase,
            rationale: newVote.rationale,
            signature: signVote(signatureInput),
          }
        : {
            ...voteBase,
            signature: signVote(signatureInput),
          };

    // Update proposal with new vote
    const updatedProposal: VerdictProposal = {
      ...proposal,
      votes: [...proposal.votes, vote],
    };

    // Replace in cache
    proposalsCache[proposalIndex] = updatedProposal;

    // Upload updated proposal to Bulletin Chain
    const uploadResult = await uploadToBulletin(updatedProposal);
    if (!uploadResult.ok) {
      // Rollback cache on persistence failure
      proposalsCache[proposalIndex] = proposal;
      return err(`Vote recorded but persistence failed: ${uploadResult.error}`);
    }

    logger.debug('Vote cast', 'vote', {
      proposalId,
      voter: credential,
      decision: newVote.decision,
    });

    // Check if we should finalize
    await this.checkAndFinalize(proposalId);

    return ok(vote);
  }

  async checkAndFinalize(proposalId: string): Promise<Result<VerdictId | null, string>> {
    const proposalIndex = proposalsCache.findIndex((p) => p.id === proposalId);
    if (proposalIndex === -1) {
      return err('Proposal not found.');
    }

    const proposal = proposalsCache[proposalIndex];
    if (!proposal) {
      return err('Proposal not found.');
    }

    // Can't finalize if not in voting status
    if (proposal.status !== 'voting') {
      return ok(null);
    }

    // Check if expired
    if (proposal.expiresAt < Date.now()) {
      const expiredProposal: VerdictProposal = {
        ...proposal,
        status: 'expired',
      };
      proposalsCache[proposalIndex] = expiredProposal;
      const expiredUploadResult = await uploadToBulletin(expiredProposal);
      if (!expiredUploadResult.ok) {
        logger.swallowed('Failed to persist expired proposal', 'checkAndFinalize', undefined, {
          proposalId,
          error: expiredUploadResult.error,
        });
      }
      return ok(null);
    }

    // Calculate voting progress
    const progress = calculateVotingProgress(proposal);

    if (!progress.thresholdReached) {
      return ok(null); // Not ready to finalize
    }

    // Threshold reached - create verdict
    const verdictService = new VerdictServiceImpl();
    const verdictResult = await verdictService.issueVerdict({
      claimId: proposal.claimId,
      status: progress.leadingStatus ?? proposal.proposedStatus,
      rationale: `Verdict reached by ${proposal.votes.length} votes with ${progress.agreementPercentage.toFixed(0)}% agreement. ${proposal.rationale}`,
    });

    if (!verdictResult.ok) {
      return err(verdictResult.error);
    }

    // Update proposal status
    const approvedProposal: VerdictProposal = {
      ...proposal,
      status: 'approved',
    };
    proposalsCache[proposalIndex] = approvedProposal;
    const approvedUploadResult = await uploadToBulletin(approvedProposal);
    if (!approvedUploadResult.ok) {
      logger.swallowed('Failed to persist approved proposal', 'checkAndFinalize', undefined, {
        proposalId,
        error: approvedUploadResult.error,
      });
    }

    logger.info('Proposal finalized', 'checkAndFinalize', {
      proposalId,
      verdictId: verdictResult.value,
      status: progress.leadingStatus,
      votes: proposal.votes.length,
      agreement: progress.agreementPercentage,
    });

    return ok(verdictResult.value);
  }
}

// ============================================================================
// MobRule V2 Service Extension
// ============================================================================

/**
 * Extended verdict proposal service with MobRule features.
 *
 * Adds:
 * - Counter-evidence submission
 * - Case state management (open → ripe → done)
 * - Turnout requirements
 * - Time-weighted voting
 * - Settlement callbacks
 */
export class VerdictProposalServiceV2Impl extends VerdictProposalServiceImpl {
  /**
   * Create a V2 proposal with MobRule features.
   */
  async createProposalV2(newProposal: NewVerdictProposalV2): Promise<Result<string, string>> {
    const wallet = getConnectedWallet();
    const credential = getConnectedCredential();

    if (wallet === null || credential === null) {
      return err('Wallet not connected. Please connect to create a proposal.');
    }

    // Verify user is a member of the collective
    const isMember = await collectiveService.isMember(newProposal.collectiveId, credential);
    if (!isMember) {
      return err('You must be a member of this collective to create proposals.');
    }

    // Get collective governance settings
    const collective = await collectiveService.getCollective(newProposal.collectiveId);
    if (!collective) {
      return err('Collective not found.');
    }

    // Check for existing active proposals on this claim
    const existingProposals = await this.getProposalsForClaim(newProposal.claimId);
    const activeProposal = existingProposals.find(
      (p) => p.collectiveId === newProposal.collectiveId && p.status === 'voting'
    );
    if (activeProposal) {
      return err('An active proposal already exists for this claim from your collective.');
    }

    const now = Date.now();
    const proposalId = generateProposalId();

    // Create the proposer's vote automatically
    const proposerVote: VerdictVote = {
      voter: credential,
      decision: newProposal.proposedStatus,
      rationale: newProposal.rationale,
      signature: signVote({
        voter: credential,
        decision: newProposal.proposedStatus,
        rationale: newProposal.rationale,
        votedAt: now,
      }),
      votedAt: now,
    };

    // Calculate eligible voters (collective member count)
    const eligibleVoters = collective.members.length;

    // Create V2 proposal with MobRule features
    const proposal: VerdictProposalV2 = {
      id: proposalId,
      claimId: newProposal.claimId,
      collectiveId: newProposal.collectiveId,
      proposedBy: credential,
      proposedStatus: newProposal.proposedStatus,
      rationale: newProposal.rationale,
      votes: [proposerVote],
      requiredVotes: collective.governance.minVotesForVerdict,
      threshold: collective.governance.verdictThreshold,
      status: 'voting',
      createdAt: now,
      expiresAt: now + DEFAULT_PROPOSAL_EXPIRY_MS,
      // V2 fields
      caseState: 'open',
      counterEvidenceDeadline: now + COUNTER_EVIDENCE_WINDOW_MS,
      turnout: {
        minNominal: newProposal.turnout?.minNominal ?? DEFAULT_TURNOUT.minNominal,
        minPercentage: newProposal.turnout?.minPercentage ?? DEFAULT_TURNOUT.minPercentage,
      },
      eligibleVoters,
      // Only include optional fields if they have values
      ...(newProposal.respondent !== undefined && { respondent: newProposal.respondent }),
      ...(newProposal.settlements !== undefined && { settlements: newProposal.settlements }),
    };

    // Upload to Bulletin Chain
    const uploadResult = await uploadToBulletin(proposal);
    if (!uploadResult.ok) {
      return err(uploadResult.error);
    }

    // Update proposal with CID as new ID
    const proposalWithCid: VerdictProposalV2 = {
      ...proposal,
      id: uploadResult.value.cid,
    };

    proposalsCache.unshift(proposalWithCid);

    logger.debug('V2 Proposal created', 'createProposalV2', {
      proposalId: proposalWithCid.id,
      claimId: newProposal.claimId,
      collectiveId: newProposal.collectiveId,
      proposedStatus: newProposal.proposedStatus,
      caseState: 'open',
      eligibleVoters,
    });

    return ok(proposalWithCid.id);
  }

  /**
   * Submit counter-evidence as the respondent.
   * Only allowed during the 'open' case state.
   */
  async submitCounterEvidence(
    proposalId: string,
    evidence: { content: string; evidenceUrls?: readonly string[] }
  ): Promise<Result<CounterEvidence, string>> {
    const credential = getConnectedCredential();
    if (!credential) {
      return err('Wallet not connected. Please connect to submit counter-evidence.');
    }

    // Find proposal
    const proposalIndex = proposalsCache.findIndex((p) => p.id === proposalId);
    if (proposalIndex === -1) {
      return err('Proposal not found.');
    }

    const proposal = proposalsCache[proposalIndex];
    if (!proposal) {
      return err('Proposal not found.');
    }

    // Must be a V2 proposal
    if (!isV2Proposal(proposal)) {
      return err('This proposal does not support counter-evidence.');
    }

    // Check case state
    const currentState = getCaseState(proposal);
    if (currentState !== 'open') {
      return err(
        `Counter-evidence can only be submitted during the open phase. Current state: ${currentState}`
      );
    }

    // Verify caller is the respondent
    if (proposal.respondent && proposal.respondent !== credential) {
      return err('Only the respondent can submit counter-evidence.');
    }

    // Check if counter-evidence already submitted
    if (proposal.counterEvidence) {
      return err('Counter-evidence has already been submitted for this proposal.');
    }

    const now = Date.now();
    const counterEvidence: CounterEvidence = {
      submittedBy: credential,
      content: evidence.content,
      submittedAt: now,
      // Only include evidenceUrls if provided
      ...(evidence.evidenceUrls !== undefined && { evidenceUrls: evidence.evidenceUrls }),
    };

    // Update proposal with counter-evidence
    const updatedProposal: VerdictProposalV2 = {
      ...proposal,
      counterEvidence,
    };

    // Replace in cache
    proposalsCache[proposalIndex] = updatedProposal;

    // Upload to Bulletin Chain
    const uploadResult = await uploadToBulletin(updatedProposal);
    if (!uploadResult.ok) {
      // Rollback cache on persistence failure
      proposalsCache[proposalIndex] = proposal;
      return err(`Counter-evidence saved but persistence failed: ${uploadResult.error}`);
    }

    logger.debug('Counter-evidence submitted', 'submitCounterEvidence', {
      proposalId,
      submittedBy: credential,
    });

    return ok(counterEvidence);
  }

  /**
   * Get the V2 proposal with current case state.
   * Converts V1 proposals to V2 format with defaults.
   */
  async getProposalV2(proposalId: string): Promise<VerdictProposalV2 | null> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) return null;

    if (isV2Proposal(proposal)) {
      // Return with updated case state based on time
      const currentState = getCaseState(proposal);
      if (currentState !== proposal.caseState) {
        return { ...proposal, caseState: currentState };
      }
      return proposal;
    }

    // Convert V1 to V2 with defaults
    return toV2Proposal(proposal, {
      counterEvidenceWindowMs: COUNTER_EVIDENCE_WINDOW_MS,
      eligibleVoters: 10, // Default for V1 proposals
      minTurnoutNominal: DEFAULT_TURNOUT.minNominal,
      minTurnoutPercent: DEFAULT_TURNOUT.minPercentage,
    });
  }

  /**
   * Get weighted voting progress for a V2 proposal.
   */
  async getWeightedProgress(proposalId: string): Promise<WeightedVotingProgress | null> {
    const proposal = await this.getProposalV2(proposalId);
    if (!proposal) return null;

    return calculateWeightedVotingProgress(proposal, VOTE_DECAY_HALF_LIFE_MS);
  }

  /**
   * Vote on a V2 proposal.
   * Enforces case state check (must be 'ripe' to vote).
   */
  async voteV2(proposalId: string, newVote: NewVerdictVote): Promise<Result<VerdictVote, string>> {
    const proposal = await this.getProposalV2(proposalId);
    if (!proposal) {
      return err('Proposal not found.');
    }

    // For V2 proposals, check case state
    const currentState = getCaseState(proposal);
    if (currentState === 'open') {
      return err('Voting has not started yet. Counter-evidence window is still active.');
    }
    if (currentState === 'done') {
      return err('This proposal has already been finalized.');
    }

    // Delegate to base vote method
    return this.vote(proposalId, newVote);
  }

  /**
   * Check and finalize a V2 proposal.
   * Includes turnout requirements and settlement execution.
   */
  async checkAndFinalizeV2(proposalId: string): Promise<Result<VerdictId | null, string>> {
    const proposalIndex = proposalsCache.findIndex((p) => p.id === proposalId);
    if (proposalIndex === -1) {
      return err('Proposal not found.');
    }

    const proposal = proposalsCache[proposalIndex];
    if (!proposal) {
      return err('Proposal not found.');
    }

    // Can't finalize if not in voting status
    if (proposal.status !== 'voting') {
      return ok(null);
    }

    const now = Date.now();

    // For V2 proposals, check case state
    if (isV2Proposal(proposal)) {
      const currentState = getCaseState(proposal);

      // If still in counter-evidence window, update state but don't finalize
      if (currentState === 'open') {
        return ok(null);
      }

      // If expired, mark as expired
      if (now >= proposal.expiresAt) {
        const expiredProposal: VerdictProposalV2 = {
          ...proposal,
          status: 'expired',
          caseState: 'done',
        };
        proposalsCache[proposalIndex] = expiredProposal;
        await uploadToBulletin(expiredProposal);
        return ok(null);
      }

      // Calculate weighted progress
      const progress = calculateWeightedVotingProgress(proposal, VOTE_DECAY_HALF_LIFE_MS);

      // Check turnout requirements
      if (!progress.turnout.met) {
        logger.debug('Turnout not met', 'checkAndFinalizeV2', {
          proposalId,
          current: progress.turnout.current,
          required: progress.turnout.required,
        });
        return ok(null);
      }

      // Check weighted threshold
      if (!progress.readyToFinalize) {
        return ok(null);
      }

      // Ready to finalize - create verdict
      const verdictService = new VerdictServiceImpl();
      const verdictResult = await verdictService.issueVerdict({
        claimId: proposal.claimId,
        status: progress.leadingStatus ?? proposal.proposedStatus,
        rationale: `Verdict reached by ${proposal.votes.length} votes (${progress.weightedTotalVotes.toFixed(1)} weighted) with ${progress.weightedAgreementPercentage.toFixed(0)}% weighted agreement. ${proposal.rationale}`,
      });

      if (!verdictResult.ok) {
        return err(verdictResult.error);
      }

      // Execute settlements
      if (proposal.settlements && proposal.settlements.length > 0) {
        await this.executeSettlements(proposal, progress.leadingStatus ?? proposal.proposedStatus);
      }

      // Update proposal status
      const approvedProposal: VerdictProposalV2 = {
        ...proposal,
        status: 'approved',
        caseState: 'done',
      };
      proposalsCache[proposalIndex] = approvedProposal;
      await uploadToBulletin(approvedProposal);

      logger.info('V2 Proposal finalized', 'checkAndFinalizeV2', {
        proposalId,
        verdictId: verdictResult.value,
        status: progress.leadingStatus,
        votes: proposal.votes.length,
        weightedVotes: progress.weightedTotalVotes,
        agreement: progress.weightedAgreementPercentage,
        turnout: progress.turnout,
      });

      return ok(verdictResult.value);
    }

    // Fall back to base V1 finalization
    return this.checkAndFinalize(proposalId);
  }

  /**
   * Execute settlement callbacks for a finalized proposal.
   * Note: In production, this would integrate with actual on-chain settlement.
   */
  private executeSettlements(
    proposal: VerdictProposalV2,
    _finalStatus: VerdictStatus
  ): Promise<void> {
    if (!proposal.settlements) return Promise.resolve();

    for (const settlement of proposal.settlements) {
      try {
        switch (settlement.action) {
          case 'refund':
            logger.info('Settlement: Refund', 'executeSettlements', {
              proposalId: proposal.id,
              target: settlement.target,
              amount: settlement.amount?.toString(),
            });
            // In production: trigger pUSD refund via payment service
            break;

          case 'slash':
            logger.info('Settlement: Slash reputation', 'executeSettlements', {
              proposalId: proposal.id,
              target: settlement.target,
              amount: settlement.amount?.toString(),
            });
            // In production: reduce reputation via reputation service
            break;

          case 'restore':
            logger.info('Settlement: Restore content', 'executeSettlements', {
              proposalId: proposal.id,
              target: settlement.target,
            });
            // In production: restore disputed content
            break;

          case 'transfer':
            logger.info('Settlement: Transfer', 'executeSettlements', {
              proposalId: proposal.id,
              target: settlement.target,
              amount: settlement.amount?.toString(),
            });
            // In production: trigger pUSD transfer
            break;

          case 'custom':
            logger.info('Settlement: Custom action', 'executeSettlements', {
              proposalId: proposal.id,
              target: settlement.target,
              payload: settlement.payload,
            });
            // In production: execute custom settlement logic
            break;
        }
      } catch (error) {
        logger.swallowed('Settlement execution failed', 'executeSettlements', error, {
          proposalId: proposal.id,
          action: settlement.action,
          target: settlement.target,
        });
      }
    }
    return Promise.resolve();
  }

  /**
   * Transition a proposal's case state if needed.
   * Called periodically or on proposal access.
   */
  async transitionCaseState(proposalId: string): Promise<CaseState | null> {
    const proposal = await this.getProposalV2(proposalId);
    if (!proposal) return null;

    const newState = getCaseState(proposal);

    // If state changed, update cache
    if (newState !== proposal.caseState) {
      const proposalIndex = proposalsCache.findIndex((p) => p.id === proposalId);
      if (proposalIndex !== -1) {
        const updatedProposal: VerdictProposalV2 = {
          ...proposal,
          caseState: newState,
        };
        proposalsCache[proposalIndex] = updatedProposal;

        logger.debug('Case state transitioned', 'transitionCaseState', {
          proposalId,
          from: proposal.caseState,
          to: newState,
        });

        // If transitioning to 'ripe', persist the change
        if (newState === 'ripe') {
          await uploadToBulletin(updatedProposal);
        }
      }
    }

    return newState;
  }
}

// Export singleton instances
export const verdictProposalService: VerdictProposalService = new VerdictProposalServiceImpl();
export const verdictProposalServiceV2 = new VerdictProposalServiceV2Impl();
