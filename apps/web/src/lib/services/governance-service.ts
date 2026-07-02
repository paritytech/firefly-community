/**
 * Governance Service implementation with Bulletin storage.
 *
 * Provides generalized multi-sig voting for organizations.
 * Uses session cache for immediate feedback and Bulletin Chain for persistence.
 */

import type {
  GovernanceService,
  GovernanceProposal,
  GovernanceProposalPreview,
  NewGovernanceProposal,
  NewGovernanceVote,
  GovernanceVote,
  VotingPower,
  ProposalType,
  GovernanceProposalStatus,
  OrganizationId,
  OrganizationPermission,
  DIMCredential,
  PaginationParams,
  PaginatedResult,
  Result,
} from '@cocuyo/types';
import {
  ok,
  err,
  calculateGovernanceVotingProgress,
  hasVotedOnProposal,
  proposalToPreview,
  roleHasPermission,
} from '@cocuyo/types';
import {
  paginate,
  fetchFromBulletin,
  uploadToBulletin,
  requireConnectedWallet,
  generateId,
} from './service-utils';
import { organizationService } from './organization-service';
import { createLogger } from '../logging';

const logger = createLogger('GovernanceService');

// Default proposal duration: 7 days
const DEFAULT_PROPOSAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Required permissions for executing different proposal types.
 */
const EXECUTION_PERMISSIONS: Record<ProposalType, OrganizationPermission> = {
  verdict: 'governance:vote',
  membership: 'members:invite',
  'role-change': 'members:invite', // Role changes require member management permission
  budget: 'treasury:approve',
  policy: 'governance:propose', // Policy changes are governance actions
  dispute: 'governance:propose',
};

// Session cache for proposals
const proposalsCache: GovernanceProposal[] = [];

/**
 * Generate a unique proposal ID.
 */
function generateProposalId(): string {
  return generateId('gov-proposal');
}

/**
 * Sign a vote (placeholder - in production this would use actual cryptographic signing).
 */
function signVote(vote: Omit<GovernanceVote, 'signature'>): string {
  const voteData = JSON.stringify({
    voter: vote.voter,
    decision: vote.decision,
    weight: vote.weight,
    rationale: vote.rationale,
    votedAt: vote.votedAt,
  });
  // Placeholder signature - would be replaced with actual signing
  return `gov-sig:${Buffer.from(voteData).toString('base64').slice(0, 32)}`;
}

export class GovernanceServiceImpl implements GovernanceService {
  async getProposal(proposalId: string): Promise<GovernanceProposal | null> {
    // Check cache first
    const cached = proposalsCache.find((p) => p.id === proposalId);
    if (cached) return cached;

    // Try Bulletin Chain
    return fetchFromBulletin<GovernanceProposal>(proposalId);
  }

  getProposalsForOrganization(params: {
    organizationId: OrganizationId;
    type?: ProposalType;
    status?: GovernanceProposalStatus;
    pagination: PaginationParams;
  }): Promise<PaginatedResult<GovernanceProposalPreview>> {
    let filtered = proposalsCache.filter((p) => p.organizationId === params.organizationId);

    // Filter by type
    if (params.type !== undefined) {
      filtered = filtered.filter((p) => p.proposalType === params.type);
    }

    // Filter by status
    if (params.status !== undefined) {
      filtered = filtered.filter((p) => p.status === params.status);
    }

    // Sort by creation time (newest first)
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    // Convert to previews
    const previews = filtered.map(proposalToPreview);

    return Promise.resolve(paginate(previews, params.pagination));
  }

  getActiveProposals(
    organizationId: OrganizationId
  ): Promise<readonly GovernanceProposalPreview[]> {
    const now = Date.now();
    const active = proposalsCache.filter(
      (p) => p.organizationId === organizationId && p.status === 'voting' && p.expiresAt > now
    );

    return Promise.resolve(active.map(proposalToPreview));
  }

  getProposalsByCreator(credential: DIMCredential): Promise<readonly GovernanceProposalPreview[]> {
    const proposals = proposalsCache.filter((p) => p.proposedBy === credential);
    return Promise.resolve(proposals.map(proposalToPreview));
  }

  async createProposal(newProposal: NewGovernanceProposal): Promise<Result<string, string>> {
    const walletCheck = requireConnectedWallet('to create a proposal');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { credential } = walletCheck.value;

    // Verify user is a member of the organization
    const isMember = await organizationService.isMember(newProposal.organizationId, credential);
    if (!isMember) {
      return err('You must be a member of this organization to create proposals.');
    }

    // Verify user has governance:propose permission
    const canPropose = await organizationService.hasPermission(
      newProposal.organizationId,
      credential,
      'governance:propose'
    );
    if (!canPropose) {
      return err('You do not have permission to create proposals in this organization.');
    }

    // Get organization governance settings
    const org = await organizationService.getOrganization(newProposal.organizationId);
    if (!org) {
      return err('Organization not found.');
    }

    const now = Date.now();

    // Calculate proposer's voting power
    const votingPower = await this.calculateVotingPower(credential, newProposal.organizationId);

    // Create the proposer's vote automatically (they vote 'approve' on their own proposal)
    const proposerVote: GovernanceVote = {
      voter: credential,
      decision: 'approve',
      weight: votingPower.total,
      rationale: newProposal.description,
      signature: signVote({
        voter: credential,
        decision: 'approve',
        weight: votingPower.total,
        rationale: newProposal.description,
        votedAt: now,
      }),
      votedAt: now,
    };

    // Calculate required weight (sum of all members' base voting power)
    const activeMembers = org.members.filter((m) => m.status === 'active');
    const totalPossibleWeight = activeMembers.length; // Base weight of 1 per member

    // Calculate quorum: at least minVotesForProposal or 50% of total weight, but never exceed total possible
    // This prevents governance deadlock in small organizations
    const quorum = Math.ceil(totalPossibleWeight * 0.5);
    const requiredWeight = Math.min(
      totalPossibleWeight,
      Math.max(org.governance.minVotesForProposal, quorum)
    );

    // Build base proposal object
    const baseProposal = {
      id: generateProposalId(),
      organizationId: newProposal.organizationId,
      proposalType: newProposal.payload.type,
      proposedBy: credential,
      title: newProposal.title,
      description: newProposal.description,
      payload: newProposal.payload,
      votes: [proposerVote],
      requiredWeight,
      threshold: org.governance.proposalThreshold,
      status: 'voting' as const,
      createdAt: now,
      expiresAt: now + (org.governance.proposalDurationMs || DEFAULT_PROPOSAL_DURATION_MS),
    };

    // Add optional collectiveId only if provided
    const proposal: GovernanceProposal = {
      ...baseProposal,
      ...(newProposal.collectiveId !== undefined ? { collectiveId: newProposal.collectiveId } : {}),
    };

    // Upload to Bulletin Chain
    const uploadResult = await uploadToBulletin(proposal);
    if (!uploadResult.ok) {
      return err(uploadResult.error);
    }

    const proposalWithCid: GovernanceProposal = {
      ...proposal,
      id: uploadResult.value.cid,
    };

    proposalsCache.unshift(proposalWithCid);

    logger.debug('Governance proposal created', 'createProposal', {
      proposalId: proposalWithCid.id,
      organizationId: newProposal.organizationId,
      type: newProposal.payload.type,
      title: newProposal.title,
    });

    // Check if threshold is already reached (small orgs)
    await this.checkAndFinalize(proposalWithCid.id);

    return ok(proposalWithCid.id);
  }

  async vote(
    proposalId: string,
    newVote: NewGovernanceVote
  ): Promise<Result<GovernanceVote, string>> {
    const walletCheck = requireConnectedWallet('to vote');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { credential } = walletCheck.value;

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

    // Verify user is a member with voting permission
    const canVote = await organizationService.hasPermission(
      proposal.organizationId,
      credential,
      'governance:vote'
    );
    if (!canVote) {
      return err('You do not have permission to vote on proposals in this organization.');
    }

    // Check if already voted
    if (hasVotedOnProposal(proposal, credential)) {
      return err('You have already voted on this proposal.');
    }

    // Calculate voting power
    const votingPower = await this.calculateVotingPower(credential, proposal.organizationId);

    // Create the vote
    const now = Date.now();
    const voteBase = {
      voter: credential,
      decision: newVote.decision,
      weight: votingPower.total,
      votedAt: now,
    };

    const signatureInput =
      newVote.rationale !== undefined ? { ...voteBase, rationale: newVote.rationale } : voteBase;

    const vote: GovernanceVote =
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
    const updatedProposal: GovernanceProposal = {
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
      weight: votingPower.total,
    });

    // Check if we should finalize
    await this.checkAndFinalize(proposalId);

    return ok(vote);
  }

  async calculateVotingPower(
    credential: DIMCredential,
    organizationId: OrganizationId
  ): Promise<VotingPower> {
    const member = await organizationService.getMember(organizationId, credential);

    if (!member) {
      return {
        base: 0,
        reputationBonus: 0,
        roleMultiplier: 1,
        total: 0,
      };
    }

    // Base voting power: 1 per member
    const base = 1;

    // Role multiplier (founders/owners get slightly more weight)
    let roleMultiplier = 1;
    if (member.role === 'owner') {
      roleMultiplier = 1.5;
    } else if (member.role === 'admin') {
      roleMultiplier = 1.2;
    }

    // Reputation bonus (placeholder - would be based on actual reputation)
    // For now, simple tenure-based bonus
    const tenureMonths = (Date.now() - member.joinedAt) / (30 * 24 * 60 * 60 * 1000);
    const reputationBonus = Math.min(tenureMonths * 0.1, 0.5); // Max 0.5 bonus

    const total = base * roleMultiplier + reputationBonus;

    return {
      base,
      reputationBonus,
      roleMultiplier,
      total: Math.round(total * 100) / 100, // Round to 2 decimals
    };
  }

  async checkAndFinalize(proposalId: string): Promise<Result<void, string>> {
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
      return ok(undefined);
    }

    // Check if expired
    if (proposal.expiresAt < Date.now()) {
      const expiredProposal: GovernanceProposal = {
        ...proposal,
        status: 'expired',
        finalizedAt: Date.now(),
      };
      proposalsCache[proposalIndex] = expiredProposal;

      const uploadResult = await uploadToBulletin(expiredProposal);
      if (!uploadResult.ok) {
        logger.warn('Failed to persist expired proposal', 'checkAndFinalize', {
          proposalId,
          error: uploadResult.error,
        });
      }

      return ok(undefined);
    }

    // Calculate voting progress
    const progress = calculateGovernanceVotingProgress(proposal);

    if (!progress.thresholdReached) {
      return ok(undefined); // Not ready to finalize
    }

    // Threshold reached - determine outcome
    const isApproved = progress.approvalPercentage >= proposal.threshold;
    const finalStatus: GovernanceProposalStatus = isApproved ? 'approved' : 'rejected';

    const finalizedProposal: GovernanceProposal = {
      ...proposal,
      status: finalStatus,
      finalizedAt: Date.now(),
    };

    proposalsCache[proposalIndex] = finalizedProposal;

    const uploadResult = await uploadToBulletin(finalizedProposal);
    if (!uploadResult.ok) {
      logger.warn('Failed to persist finalized proposal', 'checkAndFinalize', {
        proposalId,
        error: uploadResult.error,
      });
    }

    logger.info('Proposal finalized', 'checkAndFinalize', {
      proposalId,
      status: finalStatus,
      votes: proposal.votes.length,
      approval: progress.approvalPercentage,
    });

    return ok(undefined);
  }

  async executeProposal(proposalId: string): Promise<Result<string, string>> {
    const walletCheck = requireConnectedWallet('to execute proposals');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { credential } = walletCheck.value;

    const proposalIndex = proposalsCache.findIndex((p) => p.id === proposalId);
    if (proposalIndex === -1) {
      return err('Proposal not found.');
    }

    const proposal = proposalsCache[proposalIndex];
    if (!proposal) {
      return err('Proposal not found.');
    }

    // Can only execute approved proposals
    if (proposal.status !== 'approved') {
      return err(`Proposal cannot be executed (status: ${proposal.status}).`);
    }

    // Verify user has permission to execute based on proposal type
    const requiredPermission = EXECUTION_PERMISSIONS[proposal.payload.type];

    const role = await organizationService.getMemberRole(proposal.organizationId, credential);
    if (role === null || !roleHasPermission(role, requiredPermission)) {
      return err('You do not have permission to execute this proposal.');
    }

    // Execute based on proposal type
    let executionResult: Result<string, string>;

    switch (proposal.payload.type) {
      case 'membership':
        executionResult = await this.executeMembershipProposal(proposal);
        break;
      case 'role-change':
        executionResult = await this.executeRoleChangeProposal(proposal);
        break;
      case 'budget':
        // Budget proposals would interact with treasury contract
        executionResult = ok('budget-execution-pending');
        logger.info('Budget proposal ready for treasury execution', 'executeProposal', {
          proposalId,
          amount: proposal.payload.amount,
          category: proposal.payload.category,
        });
        break;
      case 'policy':
        executionResult = await this.executePolicyProposal(proposal);
        break;
      case 'verdict':
      case 'dispute':
        // These are handled by specific services
        executionResult = ok('handled-externally');
        break;
      default:
        executionResult = err('Unknown proposal type.');
    }

    if (!executionResult.ok) {
      return executionResult;
    }

    // Mark proposal as executed
    const executedProposal: GovernanceProposal = {
      ...proposal,
      status: 'executed',
      executionTxHash: executionResult.value,
    };

    proposalsCache[proposalIndex] = executedProposal;

    const uploadResult = await uploadToBulletin(executedProposal);
    if (!uploadResult.ok) {
      logger.warn('Failed to persist executed proposal', 'executeProposal', {
        proposalId,
        error: uploadResult.error,
      });
    }

    logger.info('Proposal executed', 'executeProposal', {
      proposalId,
      type: proposal.payload.type,
      txHash: executionResult.value,
    });

    return ok(executionResult.value);
  }

  async cancelProposal(proposalId: string): Promise<Result<void, string>> {
    const walletCheck = requireConnectedWallet('to cancel proposals');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { credential } = walletCheck.value;

    const proposalIndex = proposalsCache.findIndex((p) => p.id === proposalId);
    if (proposalIndex === -1) {
      return err('Proposal not found.');
    }

    const proposal = proposalsCache[proposalIndex];
    if (!proposal) {
      return err('Proposal not found.');
    }

    // Only the proposer can cancel
    if (proposal.proposedBy !== credential) {
      return err('Only the proposer can cancel a proposal.');
    }

    // Can only cancel voting proposals
    if (proposal.status !== 'voting') {
      return err(`Proposal cannot be cancelled (status: ${proposal.status}).`);
    }

    // Can only cancel if only the proposer has voted
    if (proposal.votes.length > 1) {
      return err('Cannot cancel a proposal after other members have voted.');
    }

    // Mark as rejected (cancelled)
    const cancelledProposal: GovernanceProposal = {
      ...proposal,
      status: 'rejected',
      finalizedAt: Date.now(),
    };

    proposalsCache[proposalIndex] = cancelledProposal;

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

  /**
   * Execute a membership proposal.
   */
  private async executeMembershipProposal(
    proposal: GovernanceProposal
  ): Promise<Result<string, string>> {
    if (proposal.payload.type !== 'membership') {
      return err('Invalid proposal type.');
    }

    const { action, credential, role } = proposal.payload;

    if (action === 'add') {
      // Add member via organization service - create invitation and auto-accept it
      const inviteResult = await organizationService.inviteMember(
        proposal.organizationId,
        credential,
        role ?? 'contributor',
        `Added via governance proposal ${proposal.id}`
      );

      if (!inviteResult.ok) {
        return err(inviteResult.error);
      }

      // Auto-accept the invitation since it was approved via governance
      const acceptResult = await organizationService.acceptInvitation(inviteResult.value);
      if (!acceptResult.ok) {
        return err(`Invitation created but auto-accept failed: ${acceptResult.error}`);
      }

      return ok(`membership-add-${credential}`);
    } else {
      // Remove member
      const removeResult = await organizationService.removeMember(
        proposal.organizationId,
        credential
      );

      if (!removeResult.ok) {
        return err(removeResult.error);
      }

      return ok(`membership-remove-${credential}`);
    }
  }

  /**
   * Execute a role change proposal.
   */
  private async executeRoleChangeProposal(
    proposal: GovernanceProposal
  ): Promise<Result<string, string>> {
    if (proposal.payload.type !== 'role-change') {
      return err('Invalid proposal type.');
    }

    const { credential, newRole } = proposal.payload;

    const updateResult = await organizationService.updateMemberRole(
      proposal.organizationId,
      credential,
      newRole
    );

    if (!updateResult.ok) {
      return err(updateResult.error);
    }

    return ok(`role-change-${credential}-${newRole}`);
  }

  /**
   * Execute a policy change proposal.
   */
  private executePolicyProposal(proposal: GovernanceProposal): Promise<Result<string, string>> {
    if (proposal.payload.type !== 'policy') {
      return Promise.resolve(err('Invalid proposal type.'));
    }

    // Policy changes would update the organization's governance settings
    // For now, log the changes that would be applied
    logger.info('Policy proposal execution', 'executePolicyProposal', {
      proposalId: proposal.id,
      changes: proposal.payload.changes,
    });

    return Promise.resolve(ok(`policy-change-${proposal.id}`));
  }
}

// ============================================================
// Test Helpers (exported for test isolation)
// ============================================================

const CACHE_MAX_SIZE = 100;

/**
 * Clear all governance caches. Use in tests for isolation.
 */
export function clearGovernanceCache(): void {
  proposalsCache.length = 0;
}

/**
 * Add a proposal directly to cache. Use in tests for seeding.
 */
export function addProposalToCache(proposal: GovernanceProposal): void {
  proposalsCache.unshift(proposal);
  // Enforce size limit
  while (proposalsCache.length > CACHE_MAX_SIZE) {
    proposalsCache.pop();
  }
}

/**
 * Get cache stats for debugging.
 */
export function getGovernanceCacheStats(): {
  proposalsCount: number;
  maxSize: number;
} {
  return {
    proposalsCount: proposalsCache.length,
    maxSize: CACHE_MAX_SIZE,
  };
}
