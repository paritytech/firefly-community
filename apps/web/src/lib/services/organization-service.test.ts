/**
 * Tests for OrganizationService.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OrganizationServiceImpl,
  clearOrganizationCache,
  addOrganizationToCache,
  getOrganizationCacheStats,
} from './organization-service';
import { setConnectedWallet } from './service-utils';
import * as serviceUtils from './service-utils';
import {
  createDIMCredential,
  deriveCredentialFromString,
  createOrganizationId,
  DEFAULT_GOVERNANCE,
} from '@cocuyo/types';
import type { Organization, OrganizationGovernance, NewOrganization } from '@cocuyo/types';

// Spy on Bulletin chain functions instead of full mock
vi.spyOn(serviceUtils, 'uploadToBulletin').mockResolvedValue({
  ok: true,
  value: { cid: 'mock-cid-123' },
});
vi.spyOn(serviceUtils, 'fetchFromBulletin').mockResolvedValue(null);

describe('OrganizationServiceImpl', () => {
  let service: OrganizationServiceImpl;
  let testWalletAddress: string;

  // Use partial governance for test overrides
  const testGovernance: Partial<OrganizationGovernance> = {
    minVotesForProposal: 1,
    proposalThreshold: 51,
    proposalDurationMs: 7 * 24 * 60 * 60 * 1000,
  };

  function createTestOrg(overrides: Partial<NewOrganization> = {}): NewOrganization {
    return {
      name: 'Test Outlet',
      type: 'outlet',
      description: 'A test news outlet',
      mission: 'To test organization creation',
      topics: ['news', 'testing'],
      governance: testGovernance,
      ...overrides,
    };
  }

  beforeEach(() => {
    clearOrganizationCache();
    service = new OrganizationServiceImpl();
    testWalletAddress = '0x' + '1'.repeat(40);

    // Connect a test wallet
    setConnectedWallet(testWalletAddress);
  });

  describe('createOrganization', () => {
    it('creates an organization successfully', async () => {
      const result = await service.createOrganization(createTestOrg());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeDefined();
        expect(typeof result.value).toBe('string');
      }
    });

    it('fails without wallet connection', async () => {
      setConnectedWallet(null);

      const result = await service.createOrganization(createTestOrg());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Wallet not connected');
      }
    });

    it('fails with invalid governance config (minVotesForProposal < 1)', async () => {
      const result = await service.createOrganization(
        createTestOrg({
          governance: { ...testGovernance, minVotesForProposal: 0 },
        })
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('minVotesForProposal must be at least 1');
      }
    });

    it('fails with invalid governance config (proposalThreshold out of range)', async () => {
      const result = await service.createOrganization(
        createTestOrg({
          governance: { ...testGovernance, proposalThreshold: 101 },
        })
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('proposalThreshold must be between 0 and 100');
      }
    });

    it('fails with invalid governance config (proposalDurationMs too short)', async () => {
      const result = await service.createOrganization(
        createTestOrg({
          governance: { ...testGovernance, proposalDurationMs: 1000 }, // Less than 1 hour
        })
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('proposalDurationMs must be at least 1 hour');
      }
    });
  });

  describe('getOrganization', () => {
    it('returns null for non-existent organization', async () => {
      const result = await service.getOrganization(createOrganizationId('non-existent-org'));
      expect(result).toBeNull();
    });

    it('returns organization from cache', async () => {
      const createResult = await service.createOrganization(createTestOrg());

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        const org = await service.getOrganization(createResult.value);
        expect(org).not.toBeNull();
        expect(org?.name).toBe('Test Outlet');
        expect(org?.type).toBe('outlet');
      }
    });
  });

  describe('isMember', () => {
    it('returns true for creator of organization', async () => {
      const createResult = await service.createOrganization(createTestOrg());

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        // The connected credential should be the owner
        const credential = deriveCredentialFromString(testWalletAddress);
        const isMember = await service.isMember(createResult.value, credential);
        expect(isMember).toBe(true);
      }
    });

    it('returns false for non-member', async () => {
      const createResult = await service.createOrganization(createTestOrg());

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        const randomCredential = createDIMCredential('random-credential');
        const isMember = await service.isMember(createResult.value, randomCredential);
        expect(isMember).toBe(false);
      }
    });
  });

  describe('getMemberRole', () => {
    it('returns owner role for organization creator', async () => {
      const createResult = await service.createOrganization(createTestOrg());

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        const credential = deriveCredentialFromString(testWalletAddress);
        const role = await service.getMemberRole(createResult.value, credential);
        expect(role).toBe('owner');
      }
    });

    it('returns null for non-member', async () => {
      const createResult = await service.createOrganization(createTestOrg());

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        const randomCredential = createDIMCredential('random-credential');
        const role = await service.getMemberRole(createResult.value, randomCredential);
        expect(role).toBeNull();
      }
    });
  });

  describe('hasPermission', () => {
    it('owner has governance:propose permission', async () => {
      const createResult = await service.createOrganization(createTestOrg());

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        const credential = deriveCredentialFromString(testWalletAddress);
        const hasPermission = await service.hasPermission(
          createResult.value,
          credential,
          'governance:propose'
        );
        expect(hasPermission).toBe(true);
      }
    });

    it('non-member does not have permissions', async () => {
      const createResult = await service.createOrganization(createTestOrg());

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        const randomCredential = createDIMCredential('random-credential');
        const hasPermission = await service.hasPermission(
          createResult.value,
          randomCredential,
          'governance:propose'
        );
        expect(hasPermission).toBe(false);
      }
    });
  });

  describe('inviteMember', () => {
    it('owner can invite members', async () => {
      const createResult = await service.createOrganization(createTestOrg());

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        const newMemberCredential = createDIMCredential('new-member-credential');
        const inviteResult = await service.inviteMember(
          createResult.value,
          newMemberCredential,
          'contributor',
          'Welcome to the team!'
        );

        expect(inviteResult.ok).toBe(true);
      }
    });

    it('fails without wallet connection', async () => {
      const createResult = await service.createOrganization(createTestOrg());

      expect(createResult.ok).toBe(true);
      if (createResult.ok) {
        setConnectedWallet(null);
        const newMemberCredential = createDIMCredential('new-member-credential');
        const inviteResult = await service.inviteMember(
          createResult.value,
          newMemberCredential,
          'contributor',
          'Welcome to the team!'
        );

        expect(inviteResult.ok).toBe(false);
      }
    });
  });

  describe('getOrganizations', () => {
    it('returns paginated results', async () => {
      // Create a few organizations
      await service.createOrganization(createTestOrg({ name: 'Org 1' }));
      await service.createOrganization(createTestOrg({ name: 'Org 2', type: 'collective' }));

      const result = await service.getOrganizations({
        pagination: { offset: 0, limit: 10 },
      });

      // Only the organizations created in this test exist (no seed data).
      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('filters by type', async () => {
      // Create one of each type so the filter has something to discriminate.
      await service.createOrganization(createTestOrg({ name: 'An Outlet', type: 'outlet' }));
      await service.createOrganization(createTestOrg({ name: 'A Collective', type: 'collective' }));

      const result = await service.getOrganizations({
        type: 'outlet',
        pagination: { offset: 0, limit: 10 },
      });

      expect(result.items.length).toBe(1);
      expect(result.items.every((org) => org.type === 'outlet')).toBe(true);
    });
  });

  describe('cache helpers', () => {
    it('addOrganizationToCache adds organization to cache', async () => {
      const mockOrg: Organization = {
        id: createOrganizationId('mock-org-id'),
        type: 'outlet',
        name: 'Mock Org',
        description: 'A mock organization',
        mission: 'Testing',
        topics: ['test'],
        members: [],
        governance: DEFAULT_GOVERNANCE,
        reputation: {
          score: 50,
          contentPublished: 0,
          engagementScore: 50,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      addOrganizationToCache(mockOrg);
      const retrieved = await service.getOrganization(mockOrg.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Mock Org');
    });

    it('clearOrganizationCache empties all caches', async () => {
      const createResult = await service.createOrganization(
        createTestOrg({ name: 'To Be Cleared' })
      );

      expect(createResult.ok).toBe(true);
      expect(getOrganizationCacheStats().organizations).toBe(1);

      clearOrganizationCache();

      // No seed data — the cache is empty after clearing.
      const stats = getOrganizationCacheStats();
      expect(stats.organizations).toBe(0);
    });

    it('getOrganizationCacheStats returns correct counts', () => {
      const stats = getOrganizationCacheStats();

      expect(stats).toHaveProperty('organizations');
      expect(stats).toHaveProperty('invitations');
      expect(stats).toHaveProperty('joinRequests');
      expect(stats).toHaveProperty('memberships');
      expect(typeof stats.organizations).toBe('number');
    });
  });
});
