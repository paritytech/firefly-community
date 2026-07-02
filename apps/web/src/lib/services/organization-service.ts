/**
 * Organization Service implementation with Bulletin storage.
 *
 * Provides organization membership verification, permission checking, and data access.
 * Uses session cache for immediate feedback and Bulletin Chain for persistence.
 */

import type {
  OrganizationService,
  Organization,
  OrganizationPreview,
  OrganizationMember,
  OrganizationRole,
  OrganizationPermission,
  OrganizationId,
  DIMCredential,
  PaginationParams,
  PaginatedResult,
  Result,
  NewOrganization,
  OrganizationInvitation,
  OrganizationJoinRequest,
} from '@cocuyo/types';
import {
  createOrganizationId,
  ok,
  err,
  organizationToPreview,
  getPermissionsForRole,
  roleHasPermission,
  DEFAULT_GOVERNANCE,
} from '@cocuyo/types';
import {
  paginate,
  filterByTopic,
  fetchFromBulletin,
  uploadToBulletin,
  requireConnectedWallet,
  generatePseudonym,
  generateId,
} from './service-utils';
import { createLogger } from '../logging';

const logger = createLogger('OrganizationService');

// Default invitation expiry: 7 days
const DEFAULT_INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// Cache configuration
const CACHE_MAX_SIZE = 100;

// Session caches with size limits
const organizationsCache: Organization[] = [];
const invitationsCache: OrganizationInvitation[] = [];
const joinRequestsCache: OrganizationJoinRequest[] = [];

// Track membership in session (credential -> organization IDs)
const membershipCache = new Map<string, Set<string>>();

/**
 * Enforce cache size limit by removing oldest entries.
 */
function enforceCacheLimit(cache: unknown[], maxSize: number): void {
  while (cache.length > maxSize) {
    cache.pop(); // Remove oldest (at end since we unshift new items)
  }
}

export class OrganizationServiceImpl implements OrganizationService {
  async getOrganization(id: OrganizationId): Promise<Organization | null> {
    // Check cache first
    const cached = organizationsCache.find((o) => o.id === id);
    if (cached) return cached;

    // Try Bulletin Chain
    return fetchFromBulletin<Organization>(id);
  }

  getOrganizations(params: {
    type?: Organization['type'];
    topic?: string;
    location?: string;
    pagination: PaginationParams;
  }): Promise<PaginatedResult<OrganizationPreview>> {
    let filtered = organizationsCache.map(organizationToPreview);

    // Filter by type
    if (params.type !== undefined) {
      filtered = filtered.filter((o) => o.type === params.type);
    }

    // Filter by topic
    filtered = filterByTopic(filtered, (o) => o.topics, params.topic);

    // Filter by location
    if (params.location !== undefined) {
      const locationLower = params.location.toLowerCase();
      filtered = filtered.filter((o) => o.location?.toLowerCase().includes(locationLower) ?? false);
    }

    // Sort by reputation (highest first)
    filtered.sort((a, b) => b.reputation - a.reputation);

    return Promise.resolve(paginate(filtered, params.pagination));
  }

  async createOrganization(newOrg: NewOrganization): Promise<Result<OrganizationId, string>> {
    const walletCheck = requireConnectedWallet('to create an organization');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { wallet, credential } = walletCheck.value;

    const now = Date.now();

    // Create the founder as the first member
    const founder: OrganizationMember = {
      credentialHash: credential,
      pseudonym: generatePseudonym(wallet),
      role: 'owner',
      joinedAt: now,
      status: 'active',
    };

    // Merge provided governance with defaults
    const governance = {
      ...DEFAULT_GOVERNANCE,
      ...newOrg.governance,
    };

    // Validate governance configuration
    // minVotesForProposal should be achievable (at least 1 member exists - the founder)
    if (governance.minVotesForProposal < 1) {
      return err('Governance error: minVotesForProposal must be at least 1.');
    }

    // Warn if minVotesForProposal is set higher than 1 for a new org
    // (only founder exists initially)
    if (governance.minVotesForProposal > 1) {
      logger.warn(
        'minVotesForProposal exceeds initial member count - proposals will require more members',
        'createOrganization',
        { minVotesForProposal: governance.minVotesForProposal, initialMembers: 1 }
      );
    }

    if (governance.proposalThreshold < 0 || governance.proposalThreshold > 100) {
      return err('Governance error: proposalThreshold must be between 0 and 100.');
    }

    if (governance.proposalDurationMs < 3600000) {
      return err('Governance error: proposalDurationMs must be at least 1 hour (3600000ms).');
    }

    // Create organization with temporary ID
    // Build base org object, only including optional fields if they have values
    const baseOrg = {
      id: '' as OrganizationId,
      type: newOrg.type,
      name: newOrg.name,
      description: newOrg.description,
      mission: newOrg.mission,
      topics: newOrg.topics,
      members: [founder],
      governance,
      reputation: {
        score: 50, // Starting reputation
        contentPublished: 0,
        engagementScore: 50,
        ...(newOrg.type === 'collective' ? { verificationsCompleted: 0, accuracyRate: 0 } : {}),
      },
      createdAt: now,
      updatedAt: now,
    };

    // Add optional fields only if they have values
    const org: Organization = {
      ...baseOrg,
      ...(newOrg.location !== undefined ? { location: newOrg.location } : {}),
      ...(newOrg.websiteUrl !== undefined ? { websiteUrl: newOrg.websiteUrl } : {}),
    };

    // Upload to Bulletin Chain
    const uploadResult = await uploadToBulletin(org);
    if (!uploadResult.ok) {
      return err(uploadResult.error);
    }

    const orgWithId: Organization = {
      ...org,
      id: createOrganizationId(uploadResult.value.cid),
      cid: uploadResult.value.cid,
    };

    organizationsCache.unshift(orgWithId);
    enforceCacheLimit(organizationsCache, CACHE_MAX_SIZE);

    // Update membership cache
    let memberships = membershipCache.get(credential);
    if (!memberships) {
      memberships = new Set();
      membershipCache.set(credential, memberships);
    }
    memberships.add(orgWithId.id);

    logger.debug('Organization created', 'createOrganization', {
      orgId: orgWithId.id,
      type: newOrg.type,
      name: newOrg.name,
    });

    return ok(orgWithId.id);
  }

  async isMember(orgId: OrganizationId, credential: DIMCredential): Promise<boolean> {
    // Check membership cache first
    const memberships = membershipCache.get(credential);
    if (memberships?.has(orgId) === true) return true;

    // Check organization members
    const org = await this.getOrganization(orgId);
    if (!org) return false;

    return org.members.some((m) => m.credentialHash === credential && m.status === 'active');
  }

  async getMemberRole(
    orgId: OrganizationId,
    credential: DIMCredential
  ): Promise<OrganizationRole | null> {
    const member = await this.getMember(orgId, credential);
    // Only return role for active members - suspended/pending members have no role for permission purposes
    if (member?.status !== 'active') return null;
    return member.role;
  }

  async getMember(
    orgId: OrganizationId,
    credential: DIMCredential
  ): Promise<OrganizationMember | null> {
    const org = await this.getOrganization(orgId);
    if (!org) return null;

    return org.members.find((m) => m.credentialHash === credential) ?? null;
  }

  async getPermissions(
    orgId: OrganizationId,
    credential: DIMCredential
  ): Promise<readonly OrganizationPermission[]> {
    const role = await this.getMemberRole(orgId, credential);
    if (role === null) return [];

    return getPermissionsForRole(role);
  }

  async hasPermission(
    orgId: OrganizationId,
    credential: DIMCredential,
    permission: OrganizationPermission
  ): Promise<boolean> {
    const role = await this.getMemberRole(orgId, credential);
    if (role === null) return false;

    return roleHasPermission(role, permission);
  }

  async getOrganizationsForMember(
    credential: DIMCredential
  ): Promise<readonly OrganizationPreview[]> {
    // Get from membership cache
    const memberships = membershipCache.get(credential);
    if (!memberships || memberships.size === 0) {
      // Check all cached organizations
      const results: OrganizationPreview[] = [];
      for (const org of organizationsCache) {
        if (org.members.some((m) => m.credentialHash === credential && m.status === 'active')) {
          results.push(organizationToPreview(org));
        }
      }
      return results;
    }

    // Fetch each organization the user is a member of
    const results: OrganizationPreview[] = [];
    for (const orgId of memberships) {
      const org = await this.getOrganization(orgId as OrganizationId);
      if (org) {
        results.push(organizationToPreview(org));
      }
    }

    return results;
  }

  async inviteMember(
    orgId: OrganizationId,
    invitee: DIMCredential,
    role: OrganizationRole,
    message?: string
  ): Promise<Result<string, string>> {
    const walletCheck = requireConnectedWallet('to invite members');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { credential } = walletCheck.value;

    // Verify permission to invite
    const canInvite = await this.hasPermission(orgId, credential, 'members:invite');
    if (!canInvite) {
      return err('You do not have permission to invite members to this organization.');
    }

    // Check if invitee is already a member
    const isAlreadyMember = await this.isMember(orgId, invitee);
    if (isAlreadyMember) {
      return err('This person is already a member of the organization.');
    }

    // Check for existing pending invitation
    const existingInvite = invitationsCache.find(
      (i) => i.organizationId === orgId && i.invitee === invitee && i.status === 'pending'
    );
    if (existingInvite) {
      return err('A pending invitation already exists for this person.');
    }

    const now = Date.now();
    const baseInvitation = {
      id: generateId('invite'),
      organizationId: orgId,
      invitedBy: credential,
      invitee,
      proposedRole: role,
      status: 'pending' as const,
      sentAt: now,
      expiresAt: now + DEFAULT_INVITATION_EXPIRY_MS,
    };

    // Add optional message only if provided
    const invitation: OrganizationInvitation = {
      ...baseInvitation,
      ...(message !== undefined ? { message } : {}),
    };

    // Upload to Bulletin Chain
    const uploadResult = await uploadToBulletin(invitation);
    if (!uploadResult.ok) {
      return err(uploadResult.error);
    }

    const invitationWithCid: OrganizationInvitation = {
      ...invitation,
      id: uploadResult.value.cid,
    };

    invitationsCache.unshift(invitationWithCid);

    logger.debug('Invitation sent', 'inviteMember', {
      orgId,
      invitee,
      role,
    });

    return ok(invitationWithCid.id);
  }

  async acceptInvitation(invitationId: string): Promise<Result<void, string>> {
    const walletCheck = requireConnectedWallet('to accept invitation');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { wallet, credential } = walletCheck.value;

    const inviteIndex = invitationsCache.findIndex((i) => i.id === invitationId);
    if (inviteIndex === -1) {
      return err('Invitation not found.');
    }

    const invitation = invitationsCache[inviteIndex];
    if (!invitation) {
      return err('Invitation not found.');
    }

    if (invitation.invitee !== credential) {
      return err('This invitation is not for you.');
    }

    if (invitation.status !== 'pending') {
      return err(`Invitation has already been ${invitation.status}.`);
    }

    if (invitation.expiresAt < Date.now()) {
      return err('Invitation has expired.');
    }

    // Get the organization
    const orgIndex = organizationsCache.findIndex((o) => o.id === invitation.organizationId);
    if (orgIndex === -1) {
      return err('Organization not found.');
    }

    const org = organizationsCache[orgIndex];
    if (!org) {
      return err('Organization not found.');
    }

    // Create new member
    const newMember: OrganizationMember = {
      credentialHash: credential,
      pseudonym: generatePseudonym(wallet),
      role: invitation.proposedRole,
      joinedAt: Date.now(),
      status: 'active',
    };

    // Update organization
    const updatedOrg: Organization = {
      ...org,
      members: [...org.members, newMember],
      updatedAt: Date.now(),
    };

    // Persist to Bulletin Chain
    const uploadResult = await uploadToBulletin(updatedOrg);
    if (!uploadResult.ok) {
      return err(`Failed to persist membership: ${uploadResult.error}`);
    }

    // Update caches
    organizationsCache[orgIndex] = updatedOrg;

    const updatedInvitation: OrganizationInvitation = {
      ...invitation,
      status: 'accepted',
      resolvedAt: Date.now(),
    };
    invitationsCache[inviteIndex] = updatedInvitation;

    // Update membership cache
    let memberships = membershipCache.get(credential);
    if (!memberships) {
      memberships = new Set();
      membershipCache.set(credential, memberships);
    }
    memberships.add(org.id);

    logger.debug('Invitation accepted', 'acceptInvitation', {
      orgId: org.id,
      credential,
      role: invitation.proposedRole,
    });

    return ok(undefined);
  }

  async declineInvitation(invitationId: string): Promise<Result<void, string>> {
    const walletCheck = requireConnectedWallet('to decline invitation');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { credential } = walletCheck.value;

    const inviteIndex = invitationsCache.findIndex((i) => i.id === invitationId);
    if (inviteIndex === -1) {
      return err('Invitation not found.');
    }

    const invitation = invitationsCache[inviteIndex];
    if (!invitation) {
      return err('Invitation not found.');
    }

    if (invitation.invitee !== credential) {
      return err('This invitation is not for you.');
    }

    if (invitation.status !== 'pending') {
      return err(`Invitation has already been ${invitation.status}.`);
    }

    const updatedInvitation: OrganizationInvitation = {
      ...invitation,
      status: 'declined',
      resolvedAt: Date.now(),
    };

    // Persist to Bulletin Chain
    const uploadResult = await uploadToBulletin(updatedInvitation);
    if (!uploadResult.ok) {
      return err(`Failed to persist decline: ${uploadResult.error}`);
    }

    invitationsCache[inviteIndex] = updatedInvitation;

    logger.debug('Invitation declined', 'declineInvitation', { invitationId });

    return ok(undefined);
  }

  getPendingInvitations(credential: DIMCredential): Promise<readonly OrganizationInvitation[]> {
    const now = Date.now();
    return Promise.resolve(
      invitationsCache.filter(
        (i) => i.invitee === credential && i.status === 'pending' && i.expiresAt > now
      )
    );
  }

  async removeMember(
    orgId: OrganizationId,
    credential: DIMCredential
  ): Promise<Result<void, string>> {
    const walletCheck = requireConnectedWallet('to remove members');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { credential: callerCredential } = walletCheck.value;

    // Verify permission to remove
    const canRemove = await this.hasPermission(orgId, callerCredential, 'members:remove');
    if (!canRemove) {
      return err('You do not have permission to remove members from this organization.');
    }

    // Get the organization
    const orgIndex = organizationsCache.findIndex((o) => o.id === orgId);
    if (orgIndex === -1) {
      return err('Organization not found.');
    }

    const org = organizationsCache[orgIndex];
    if (!org) {
      return err('Organization not found.');
    }

    // Find the member
    const memberIndex = org.members.findIndex((m) => m.credentialHash === credential);
    if (memberIndex === -1) {
      return err('Member not found in this organization.');
    }

    const member = org.members[memberIndex];
    if (!member) {
      return err('Member not found in this organization.');
    }

    // Cannot remove the owner unless you are the owner
    if (member.role === 'owner' && callerCredential !== credential) {
      return err('Only the owner can remove themselves from the organization.');
    }

    // Remove member
    const updatedMembers = org.members.filter((m) => m.credentialHash !== credential);

    const updatedOrg: Organization = {
      ...org,
      members: updatedMembers,
      updatedAt: Date.now(),
    };

    // Persist to Bulletin Chain
    const uploadResult = await uploadToBulletin(updatedOrg);
    if (!uploadResult.ok) {
      return err(`Failed to persist removal: ${uploadResult.error}`);
    }

    organizationsCache[orgIndex] = updatedOrg;

    // Update membership cache
    const memberships = membershipCache.get(credential);
    if (memberships) {
      memberships.delete(orgId);
    }

    logger.debug('Member removed', 'removeMember', { orgId, credential });

    return ok(undefined);
  }

  async updateMemberRole(
    orgId: OrganizationId,
    credential: DIMCredential,
    newRole: OrganizationRole
  ): Promise<Result<void, string>> {
    const walletCheck = requireConnectedWallet('to update member roles');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { credential: callerCredential } = walletCheck.value;

    // Verify permission to change roles
    const canChangeRole = await this.hasPermission(orgId, callerCredential, 'members:role-change');
    if (!canChangeRole) {
      return err('You do not have permission to change member roles.');
    }

    // Get the organization
    const orgIndex = organizationsCache.findIndex((o) => o.id === orgId);
    if (orgIndex === -1) {
      return err('Organization not found.');
    }

    const org = organizationsCache[orgIndex];
    if (!org) {
      return err('Organization not found.');
    }

    // Find the member
    const memberIndex = org.members.findIndex((m) => m.credentialHash === credential);
    if (memberIndex === -1) {
      return err('Member not found in this organization.');
    }

    const member = org.members[memberIndex];
    if (!member) {
      return err('Member not found in this organization.');
    }

    // Cannot demote owner unless you are the owner
    if (member.role === 'owner' && callerCredential !== credential) {
      return err('Only the owner can change their own role.');
    }

    // Update member role
    const updatedMember: OrganizationMember = {
      ...member,
      role: newRole,
    };

    const updatedMembers = [...org.members];
    updatedMembers[memberIndex] = updatedMember;

    const updatedOrg: Organization = {
      ...org,
      members: updatedMembers,
      updatedAt: Date.now(),
    };

    // Persist to Bulletin Chain
    const uploadResult = await uploadToBulletin(updatedOrg);
    if (!uploadResult.ok) {
      return err(`Failed to persist role change: ${uploadResult.error}`);
    }

    organizationsCache[orgIndex] = updatedOrg;

    logger.debug('Member role updated', 'updateMemberRole', {
      orgId,
      credential,
      oldRole: member.role,
      newRole,
    });

    return ok(undefined);
  }

  async submitJoinRequest(
    orgId: OrganizationId,
    message: string,
    requestedRole?: OrganizationRole
  ): Promise<Result<string, string>> {
    const walletCheck = requireConnectedWallet('to request membership');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { wallet, credential } = walletCheck.value;

    // Get the organization
    const org = await this.getOrganization(orgId);
    if (!org) {
      return err('Organization not found.');
    }

    // Check if already a member
    const isAlreadyMember = await this.isMember(orgId, credential);
    if (isAlreadyMember) {
      return err('You are already a member of this organization.');
    }

    // Check membership approval type
    if (org.governance.membershipApproval === 'invite-only') {
      return err('This organization is invite-only. You cannot submit a join request.');
    }

    // Check for existing pending request
    const existingRequest = joinRequestsCache.find(
      (r) =>
        r.organizationId === orgId &&
        r.applicant.credentialHash === credential &&
        r.status === 'pending'
    );
    if (existingRequest) {
      return err('You already have a pending join request for this organization.');
    }

    const now = Date.now();
    const joinRequest: OrganizationJoinRequest = {
      id: generateId('join'),
      organizationId: orgId,
      applicant: {
        credentialHash: credential,
        pseudonym: generatePseudonym(wallet),
      },
      message,
      requestedRole: requestedRole ?? 'contributor',
      status: 'pending',
      votes: [],
      createdAt: now,
    };

    // Upload to Bulletin Chain
    const uploadResult = await uploadToBulletin(joinRequest);
    if (!uploadResult.ok) {
      return err(uploadResult.error);
    }

    const requestWithCid: OrganizationJoinRequest = {
      ...joinRequest,
      id: uploadResult.value.cid,
    };

    joinRequestsCache.unshift(requestWithCid);

    // If membership is 'open', auto-approve
    if (org.governance.membershipApproval === 'open') {
      const approveResult = await this.autoApproveJoinRequest(requestWithCid.id);
      if (!approveResult.ok) {
        logger.warn('Auto-approve failed', 'submitJoinRequest', { error: approveResult.error });
      }
    }

    logger.debug('Join request submitted', 'submitJoinRequest', {
      orgId,
      credential,
      approvalType: org.governance.membershipApproval,
    });

    return ok(requestWithCid.id);
  }

  getPendingJoinRequests(orgId: OrganizationId): Promise<readonly OrganizationJoinRequest[]> {
    return Promise.resolve(
      joinRequestsCache.filter((r) => r.organizationId === orgId && r.status === 'pending')
    );
  }

  async voteOnJoinRequest(requestId: string, approve: boolean): Promise<Result<void, string>> {
    const walletCheck = requireConnectedWallet('to vote');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { credential } = walletCheck.value;

    const requestIndex = joinRequestsCache.findIndex((r) => r.id === requestId);
    if (requestIndex === -1) {
      return err('Join request not found.');
    }

    const joinRequest = joinRequestsCache[requestIndex];
    if (!joinRequest) {
      return err('Join request not found.');
    }

    if (joinRequest.status !== 'pending') {
      return err(`Join request has already been ${joinRequest.status}.`);
    }

    // Verify caller is a member with vote permission
    const canVote = await this.hasPermission(
      joinRequest.organizationId,
      credential,
      'governance:vote'
    );
    if (!canVote) {
      return err('You do not have permission to vote on join requests.');
    }

    // Check if already voted
    const hasVoted = joinRequest.votes.some((v) => v.voter === credential);
    if (hasVoted) {
      return err('You have already voted on this request.');
    }

    // Add vote
    const vote = {
      voter: credential,
      approve,
      votedAt: Date.now(),
    };

    const updatedRequest: OrganizationJoinRequest = {
      ...joinRequest,
      votes: [...joinRequest.votes, vote],
    };

    joinRequestsCache[requestIndex] = updatedRequest;

    // Check if threshold reached
    const org = await this.getOrganization(joinRequest.organizationId);
    if (org) {
      const approveVotes = updatedRequest.votes.filter((v) => v.approve).length;
      const totalVotes = updatedRequest.votes.length;

      if (totalVotes >= org.governance.minVotesForProposal) {
        const approvalPercentage = (approveVotes / totalVotes) * 100;

        if (approvalPercentage >= org.governance.proposalThreshold) {
          // Approved - add member
          await this.approveJoinRequest(updatedRequest);
        } else if (totalVotes >= org.members.filter((m) => m.status === 'active').length) {
          // All members voted but threshold not reached - rejected
          await this.rejectJoinRequest(updatedRequest);
        }
      }
    }

    // Persist updated request
    const uploadResult = await uploadToBulletin(updatedRequest);
    if (!uploadResult.ok) {
      logger.warn('Failed to persist vote', 'voteOnJoinRequest', {
        error: uploadResult.error,
      });
    }

    logger.debug('Vote cast on join request', 'voteOnJoinRequest', {
      requestId,
      approve,
    });

    return ok(undefined);
  }

  /**
   * Auto-approve a join request (for 'open' membership).
   */
  private async autoApproveJoinRequest(requestId: string): Promise<Result<void, string>> {
    const requestIndex = joinRequestsCache.findIndex((r) => r.id === requestId);
    if (requestIndex === -1) {
      return err('Join request not found.');
    }

    const joinRequest = joinRequestsCache[requestIndex];
    if (!joinRequest) {
      return err('Join request not found.');
    }

    return this.approveJoinRequest(joinRequest);
  }

  /**
   * Approve a join request and add the member.
   */
  private async approveJoinRequest(
    joinRequest: OrganizationJoinRequest
  ): Promise<Result<void, string>> {
    const requestIndex = joinRequestsCache.findIndex((r) => r.id === joinRequest.id);

    // Get the organization
    const orgIndex = organizationsCache.findIndex((o) => o.id === joinRequest.organizationId);
    if (orgIndex === -1) {
      return err('Organization not found.');
    }

    const org = organizationsCache[orgIndex];
    if (!org) {
      return err('Organization not found.');
    }

    // Create new member
    const newMember: OrganizationMember = {
      credentialHash: joinRequest.applicant.credentialHash,
      pseudonym: joinRequest.applicant.pseudonym,
      role: joinRequest.requestedRole,
      joinedAt: Date.now(),
      status: 'active',
    };

    // Update organization
    const updatedOrg: Organization = {
      ...org,
      members: [...org.members, newMember],
      updatedAt: Date.now(),
    };

    // Persist to Bulletin Chain
    const uploadResult = await uploadToBulletin(updatedOrg);
    if (!uploadResult.ok) {
      return err(`Failed to persist membership: ${uploadResult.error}`);
    }

    organizationsCache[orgIndex] = updatedOrg;

    // Update request status
    if (requestIndex !== -1) {
      const updatedRequest: OrganizationJoinRequest = {
        ...joinRequest,
        status: 'approved',
        resolvedAt: Date.now(),
      };
      joinRequestsCache[requestIndex] = updatedRequest;
    }

    // Update membership cache
    let memberships = membershipCache.get(joinRequest.applicant.credentialHash);
    if (!memberships) {
      memberships = new Set();
      membershipCache.set(joinRequest.applicant.credentialHash, memberships);
    }
    memberships.add(org.id);

    logger.debug('Join request approved', 'approveJoinRequest', {
      orgId: org.id,
      credential: joinRequest.applicant.credentialHash,
    });

    return ok(undefined);
  }

  /**
   * Reject a join request.
   */
  private async rejectJoinRequest(
    joinRequest: OrganizationJoinRequest
  ): Promise<Result<void, string>> {
    const requestIndex = joinRequestsCache.findIndex((r) => r.id === joinRequest.id);
    if (requestIndex === -1) {
      return err('Join request not found.');
    }

    const updatedRequest: OrganizationJoinRequest = {
      ...joinRequest,
      status: 'rejected',
      resolvedAt: Date.now(),
    };

    joinRequestsCache[requestIndex] = updatedRequest;

    // Persist to Bulletin Chain
    const uploadResult = await uploadToBulletin(updatedRequest);
    if (!uploadResult.ok) {
      logger.warn('Failed to persist rejection', 'rejectJoinRequest', {
        error: uploadResult.error,
      });
    }

    logger.debug('Join request rejected', 'rejectJoinRequest', {
      requestId: joinRequest.id,
    });

    return ok(undefined);
  }

  /**
   * Add a member to an organization directly (internal use).
   * Used during testing and special flows.
   */
  addMember(orgId: OrganizationId, member: OrganizationMember): void {
    const org = organizationsCache.find((o) => o.id === orgId);
    if (!org) return;

    // Add to organization members
    const mutableMembers = org.members as OrganizationMember[];
    if (!mutableMembers.some((m) => m.credentialHash === member.credentialHash)) {
      mutableMembers.push(member);
    }

    // Update membership cache
    let memberships = membershipCache.get(member.credentialHash);
    if (!memberships) {
      memberships = new Set();
      membershipCache.set(member.credentialHash, memberships);
    }
    memberships.add(orgId);
  }
}

// Export singleton instance
export const organizationService = new OrganizationServiceImpl();

// ============================================================
// Test Helpers
// ============================================================

/**
 * Clear all organization caches.
 * Used in tests to reset state between test cases.
 */
export function clearOrganizationCache(): void {
  organizationsCache.length = 0;
  invitationsCache.length = 0;
  joinRequestsCache.length = 0;
  membershipCache.clear();
}

/**
 * Add an organization to the cache directly.
 * Used in tests to set up test fixtures.
 */
export function addOrganizationToCache(org: Organization): void {
  organizationsCache.unshift(org);
  enforceCacheLimit(organizationsCache, CACHE_MAX_SIZE);
}

/**
 * Add an invitation to the cache directly.
 * Used in tests to set up test fixtures.
 */
export function addInvitationToCache(invitation: OrganizationInvitation): void {
  invitationsCache.unshift(invitation);
  enforceCacheLimit(invitationsCache, CACHE_MAX_SIZE);
}

/**
 * Get current cache sizes for monitoring.
 */
export function getOrganizationCacheStats(): {
  organizations: number;
  invitations: number;
  joinRequests: number;
  memberships: number;
} {
  return {
    organizations: organizationsCache.length,
    invitations: invitationsCache.length,
    joinRequests: joinRequestsCache.length,
    memberships: membershipCache.size,
  };
}
