/**
 * Tests for GovernanceService.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GovernanceServiceImpl,
  clearGovernanceCache,
  addProposalToCache,
  getGovernanceCacheStats,
} from './governance-service';
import { clearOrganizationCache, addOrganizationToCache } from './organization-service';
import { setConnectedWallet } from './service-utils';
import * as serviceUtils from './service-utils';
import {
  createDIMCredential,
  deriveCredentialFromString,
  createOrganizationId,
  DEFAULT_GOVERNANCE,
} from '@cocuyo/types';
import type {
  DIMCredential,
  OrganizationId,
  Organization,
  GovernanceProposal,
  ProposalPayload,
} from '@cocuyo/types';

// Spy on Bulletin chain functions instead of full mock
vi.spyOn(serviceUtils, 'uploadToBulletin').mockResolvedValue({
  ok: true,
  value: { cid: 'mock-cid-123' },
});
vi.spyOn(serviceUtils, 'fetchFromBulletin').mockResolvedValue(null);

describe('GovernanceServiceImpl', () => {
  let service: GovernanceServiceImpl;
  let testCredential: DIMCredential;
  let testWalletAddress: string;
  let testOrgId: OrganizationId;
  let testOrg: Organization;

  beforeEach(() => {
    clearGovernanceCache();
    clearOrganizationCache();
    service = new GovernanceServiceImpl();
    testWalletAddress = '0x' + '1'.repeat(40);
    testCredential = deriveCredentialFromString(testWalletAddress);
    testOrgId = createOrganizationId('test-org-governance');

    // Create a test organization with the test credential as owner
    testOrg = {
      id: testOrgId,
      type: 'outlet',
      name: 'Test Governance Org',
      description: 'A test organization for governance testing',
      mission: 'Testing governance',
      topics: ['governance', 'testing'],
      members: [
        {
          credentialHash: testCredential,
          pseudonym: 'Test Owner',
          role: 'owner',
          status: 'active',
          joinedAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        },
      ],
      governance: DEFAULT_GOVERNANCE,
      reputation: {
        score: 50,
        contentPublished: 0,
        engagementScore: 50,
      },
      createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now(),
    };
    addOrganizationToCache(testOrg);

    // Connect the test wallet
    setConnectedWallet(testWalletAddress);
  });

  describe('createProposal', () => {
    it('creates a proposal successfully', async () => {
      const payload: ProposalPayload = {
        type: 'policy',
        changes: [
          {
            field: 'proposalThreshold',
            oldValue: 51,
            newValue: 60,
            description: 'Increase threshold',
          },
        ],
      };

      const result = await service.createProposal({
        organizationId: testOrgId,
        title: 'Increase Proposal Threshold',
        description: 'Increase the threshold from 51% to 60%',
        payload,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeDefined();
        expect(typeof result.value).toBe('string');
      }
    });

    it('fails without wallet connection', async () => {
      setConnectedWallet(null);

      const payload: ProposalPayload = {
        type: 'policy',
        changes: [
          {
            field: 'proposalThreshold',
            oldValue: 51,
            newValue: 60,
            description: 'Increase threshold',
          },
        ],
      };

      const result = await service.createProposal({
        organizationId: testOrgId,
        title: 'Test Proposal',
        description: 'Test description',
        payload,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Wallet not connected');
      }
    });

    it('fails for non-members', async () => {
      // Connect a different wallet (non-member)
      setConnectedWallet('0x' + '2'.repeat(40));

      const payload: ProposalPayload = {
        type: 'policy',
        changes: [],
      };

      const result = await service.createProposal({
        organizationId: testOrgId,
        title: 'Test Proposal',
        description: 'Test description',
        payload,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('must be a member');
      }
    });

    it('auto-finalizes proposals in single-member organizations', async () => {
      const payload: ProposalPayload = {
        type: 'policy',
        changes: [{ field: 'test', oldValue: 'a', newValue: 'b', description: 'Test change' }],
      };

      const result = await service.createProposal({
        organizationId: testOrgId,
        title: 'Auto-approve Test',
        description: 'Should auto-approve with single member',
        payload,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Get the proposal and check status
        const proposal = await service.getProposal(result.value);
        // Single member org with minVotesForProposal=3 in DEFAULT_GOVERNANCE
        // but clamped to totalPossibleWeight=1, so should auto-approve
        expect(proposal?.status).toBe('approved');
      }
    });
  });

  describe('getProposal', () => {
    it('returns null for non-existent proposal', async () => {
      const result = await service.getProposal('non-existent-proposal');
      expect(result).toBeNull();
    });

    it('returns proposal from cache', async () => {
      const payload: ProposalPayload = {
        type: 'policy',
        changes: [],
      };

      const createResult = await service.createProposal({
        organizationId: testOrgId,
        title: 'Test Proposal',
        description: 'Test description',
        payload,
      });

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        const proposal = await service.getProposal(createResult.value);
        expect(proposal).not.toBeNull();
        expect(proposal?.title).toBe('Test Proposal');
      }
    });
  });

  describe('vote', () => {
    it('allows members to vote on proposals', async () => {
      // Add a second member to prevent auto-approval
      const secondCredential = createDIMCredential('second-member');
      // Third credential must match what deriveCredentialFromString produces for the wallet
      const thirdWalletAddress = '0x' + '3'.repeat(40);
      const thirdCredential = deriveCredentialFromString(thirdWalletAddress);
      const orgWithMembers: Organization = {
        ...testOrg,
        members: [
          ...testOrg.members,
          {
            credentialHash: secondCredential,
            pseudonym: 'Second Member',
            role: 'contributor',
            status: 'active',
            joinedAt: Date.now(),
          },
          {
            credentialHash: thirdCredential,
            pseudonym: 'Third Member',
            role: 'contributor',
            status: 'active',
            joinedAt: Date.now(),
          },
        ],
        governance: {
          ...DEFAULT_GOVERNANCE,
          minVotesForProposal: 3,
        },
      };
      addOrganizationToCache(orgWithMembers);

      const payload: ProposalPayload = {
        type: 'policy',
        changes: [],
      };

      const createResult = await service.createProposal({
        organizationId: testOrgId,
        title: 'Vote Test',
        description: 'Test voting',
        payload,
      });

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        // Switch to third member to vote
        setConnectedWallet(thirdWalletAddress);

        const voteResult = await service.vote(createResult.value, {
          decision: 'approve',
          rationale: 'I approve this proposal',
        });

        expect(voteResult.ok).toBe(true);
        if (voteResult.ok) {
          expect(voteResult.value.decision).toBe('approve');
        }
      }
    });

    it('prevents double voting', async () => {
      // Add members
      const secondCredential = createDIMCredential('second-member');
      const orgWithMembers: Organization = {
        ...testOrg,
        members: [
          ...testOrg.members,
          {
            credentialHash: secondCredential,
            pseudonym: 'Second Member',
            role: 'contributor',
            status: 'active',
            joinedAt: Date.now(),
          },
        ],
        governance: {
          ...DEFAULT_GOVERNANCE,
          minVotesForProposal: 10, // High threshold to keep proposal open
        },
      };
      addOrganizationToCache(orgWithMembers);

      const payload: ProposalPayload = {
        type: 'policy',
        changes: [],
      };

      const createResult = await service.createProposal({
        organizationId: testOrgId,
        title: 'Double Vote Test',
        description: 'Test double voting prevention',
        payload,
      });

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        // Try to vote again with same user (proposer auto-votes)
        const voteResult = await service.vote(createResult.value, {
          decision: 'approve',
        });

        expect(voteResult.ok).toBe(false);
        if (!voteResult.ok) {
          expect(voteResult.error).toContain('already voted');
        }
      }
    });
  });

  describe('calculateVotingPower', () => {
    it('returns zero for non-members', async () => {
      const randomCredential = createDIMCredential('random-credential');
      const power = await service.calculateVotingPower(randomCredential, testOrgId);

      expect(power.base).toBe(0);
      expect(power.total).toBe(0);
    });

    it('returns higher multiplier for owners', async () => {
      const power = await service.calculateVotingPower(testCredential, testOrgId);

      expect(power.base).toBe(1);
      expect(power.roleMultiplier).toBe(1.5); // Owner multiplier
      expect(power.total).toBeGreaterThan(1);
    });
  });

  describe('cancelProposal', () => {
    it('allows proposer to cancel their proposal', async () => {
      // Add second member to prevent auto-approval
      const secondCredential = createDIMCredential('second-member');
      const orgWithMembers: Organization = {
        ...testOrg,
        members: [
          ...testOrg.members,
          {
            credentialHash: secondCredential,
            pseudonym: 'Second Member',
            role: 'contributor',
            status: 'active',
            joinedAt: Date.now(),
          },
        ],
        governance: {
          ...DEFAULT_GOVERNANCE,
          minVotesForProposal: 10, // High threshold
        },
      };
      addOrganizationToCache(orgWithMembers);

      const payload: ProposalPayload = {
        type: 'policy',
        changes: [],
      };

      const createResult = await service.createProposal({
        organizationId: testOrgId,
        title: 'Cancel Test',
        description: 'Test cancellation',
        payload,
      });

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        const cancelResult = await service.cancelProposal(createResult.value);
        expect(cancelResult.ok).toBe(true);

        const proposal = await service.getProposal(createResult.value);
        expect(proposal?.status).toBe('rejected');
      }
    });

    it('prevents non-proposer from cancelling', async () => {
      // Add second member - credential must match wallet address for proper member lookup
      const secondWalletAddress = '0x' + '3'.repeat(40);
      const secondCredential = deriveCredentialFromString(secondWalletAddress);
      const orgWithMembers: Organization = {
        ...testOrg,
        members: [
          ...testOrg.members,
          {
            credentialHash: secondCredential,
            pseudonym: 'Second Member',
            role: 'contributor',
            status: 'active',
            joinedAt: Date.now(),
          },
        ],
        governance: {
          ...DEFAULT_GOVERNANCE,
          minVotesForProposal: 10,
        },
      };
      addOrganizationToCache(orgWithMembers);

      const payload: ProposalPayload = {
        type: 'policy',
        changes: [],
      };

      const createResult = await service.createProposal({
        organizationId: testOrgId,
        title: 'Cancel Test',
        description: 'Test cancellation prevention',
        payload,
      });

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        // Switch to different user (second member, not the proposer)
        setConnectedWallet(secondWalletAddress);

        const cancelResult = await service.cancelProposal(createResult.value);
        expect(cancelResult.ok).toBe(false);
        if (!cancelResult.ok) {
          expect(cancelResult.error).toContain('Only the proposer');
        }
      }
    });
  });

  describe('getProposalsForOrganization', () => {
    it('returns paginated proposals', async () => {
      const payload: ProposalPayload = {
        type: 'policy',
        changes: [],
      };

      // Create multiple proposals with high threshold to prevent auto-approval
      const orgWithHighThreshold: Organization = {
        ...testOrg,
        governance: {
          ...DEFAULT_GOVERNANCE,
          minVotesForProposal: 100,
        },
      };
      addOrganizationToCache(orgWithHighThreshold);

      await service.createProposal({
        organizationId: testOrgId,
        title: 'Proposal 1',
        description: 'First proposal',
        payload,
      });

      await service.createProposal({
        organizationId: testOrgId,
        title: 'Proposal 2',
        description: 'Second proposal',
        payload,
      });

      const result = await service.getProposalsForOrganization({
        organizationId: testOrgId,
        pagination: { offset: 0, limit: 10 },
      });

      expect(result.items.length).toBeGreaterThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(2);
    });

    it('filters by status', async () => {
      const result = await service.getProposalsForOrganization({
        organizationId: testOrgId,
        status: 'approved',
        pagination: { offset: 0, limit: 10 },
      });

      expect(result.items.every((p) => p.status === 'approved')).toBe(true);
    });
  });

  describe('cache helpers', () => {
    it('clearGovernanceCache clears all proposals', async () => {
      const payload: ProposalPayload = {
        type: 'policy',
        changes: [],
      };

      await service.createProposal({
        organizationId: testOrgId,
        title: 'To Be Cleared',
        description: 'Will be cleared',
        payload,
      });

      const beforeStats = getGovernanceCacheStats();
      expect(beforeStats.proposalsCount).toBeGreaterThan(0);

      clearGovernanceCache();

      const afterStats = getGovernanceCacheStats();
      expect(afterStats.proposalsCount).toBe(0);
    });

    it('addProposalToCache adds proposal to cache', async () => {
      const mockProposal: GovernanceProposal = {
        id: 'mock-proposal-id',
        organizationId: testOrgId,
        proposalType: 'policy',
        proposedBy: testCredential,
        title: 'Mock Proposal',
        description: 'A mock proposal',
        payload: { type: 'policy', changes: [] },
        votes: [],
        requiredWeight: 1,
        threshold: 51,
        status: 'voting',
        createdAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };

      addProposalToCache(mockProposal);
      const retrieved = await service.getProposal(mockProposal.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.title).toBe('Mock Proposal');
    });

    it('getGovernanceCacheStats returns correct counts', () => {
      const stats = getGovernanceCacheStats();

      expect(stats).toHaveProperty('proposalsCount');
      expect(stats).toHaveProperty('maxSize');
      expect(typeof stats.proposalsCount).toBe('number');
      expect(typeof stats.maxSize).toBe('number');
    });
  });
});
