/**
 * Alliance Governance Service tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  AllianceProposal,
  NewAllianceProposal,
  NewAllianceVote,
  ContributorPosition,
  PoolId,
  DIMCredential,
  PolkadotAddress,
} from '@cocuyo/types';
import {
  createPoolId,
  createPolkadotAddress,
  createDIMCredential,
  createPUSDAmount,
} from '@cocuyo/types';
import {
  AllianceGovernanceServiceImpl,
  clearAllianceGovernanceCache,
  addAllianceProposalToCache,
} from './alliance-governance-service';
import { seedPosition, clearCrowdstackingCache } from './crowdstacking-service';

// Mock service-utils with test-specific functions
let mockWallet: string | null = null;
let mockCredential: DIMCredential | null = null;

vi.mock('./service-utils', async () => {
  const actual = await vi.importActual('./service-utils');

  return {
    ...actual,
    getConnectedWallet: () => mockWallet,
    setConnectedWallet: (w: string | null) => {
      mockWallet = w;
    },
    getConnectedCredential: () => mockCredential,
    uploadToBulletin: vi.fn().mockResolvedValue({
      ok: true,
      value: { cid: `cid-${Date.now()}` },
    }),
    fetchFromBulletin: vi.fn().mockResolvedValue(null),
  };
});

// Test helper to set wallet state
function setTestWallet(address: PolkadotAddress | null, credential: DIMCredential | null): void {
  mockWallet = address;
  mockCredential = credential;
}

describe('AllianceGovernanceService', () => {
  let service: AllianceGovernanceServiceImpl;
  let poolId: PoolId;
  let beaconAddress: PolkadotAddress;
  let beaconCredential: DIMCredential;
  let sparkAddress: PolkadotAddress;
  let sparkCredential: DIMCredential;

  beforeEach(async () => {
    // Clear all caches
    clearAllianceGovernanceCache();
    await clearCrowdstackingCache();

    // Create fresh service
    service = new AllianceGovernanceServiceImpl();

    // Set up test data
    poolId = createPoolId('pool-main');
    beaconAddress = createPolkadotAddress('0xbeaconcontributor123456789012345678901234');
    beaconCredential = createDIMCredential('dim:beacon:test');
    sparkAddress = createPolkadotAddress('0xsparkcontributor1234567890123456789012345');
    sparkCredential = createDIMCredential('dim:spark:test');

    // Seed contributor positions
    const beaconPosition: ContributorPosition = {
      poolId,
      contributor: beaconAddress,
      shares: 1000n,
      cumulativeContributed: createPUSDAmount(500_000000n),
      tier: 'beacon',
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now(),
    };

    const sparkPosition: ContributorPosition = {
      poolId,
      contributor: sparkAddress,
      shares: 100n,
      cumulativeContributed: createPUSDAmount(10_000000n),
      tier: 'spark',
      createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now(),
    };

    seedPosition(beaconPosition);
    seedPosition(sparkPosition);
  });

  describe('createProposal', () => {
    it('should create proposal for BEACON tier contributor', async () => {
      setTestWallet(beaconAddress, beaconCredential);

      const newProposal: NewAllianceProposal = {
        poolId,
        title: 'Add New Outlet',
        description: 'Proposal to add a new news outlet to the registry',
        payload: {
          type: 'outlet-add',
          outletId: 'outlet-1' as unknown as import('@cocuyo/types').OutletId,
          outletName: 'Test Outlet',
          treasury: 'treasury-1' as unknown as import('@cocuyo/types').TreasuryId,
          initialWeight: 5000,
          rationale: 'High quality journalism',
        },
      };

      const result = await service.createProposal(newProposal);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toContain('cid-');
      }
    });

    it('should reject proposal from SPARK tier contributor', async () => {
      setTestWallet(sparkAddress, sparkCredential);

      const newProposal: NewAllianceProposal = {
        poolId,
        title: 'Add New Outlet',
        description: 'Proposal to add a new news outlet',
        payload: {
          type: 'outlet-add',
          outletId: 'outlet-1' as unknown as import('@cocuyo/types').OutletId,
          outletName: 'Test Outlet',
          treasury: 'treasury-1' as unknown as import('@cocuyo/types').TreasuryId,
          initialWeight: 5000,
          rationale: 'Testing',
        },
      };

      const result = await service.createProposal(newProposal);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('BELOW_MIN_TIER');
      }
    });

    it('should reject proposal when wallet not connected', async () => {
      setTestWallet(null, null);

      const newProposal: NewAllianceProposal = {
        poolId,
        title: 'Add New Outlet',
        description: 'Proposal to add a new news outlet',
        payload: {
          type: 'outlet-add',
          outletId: 'outlet-1' as unknown as import('@cocuyo/types').OutletId,
          outletName: 'Test Outlet',
          treasury: 'treasury-1' as unknown as import('@cocuyo/types').TreasuryId,
          initialWeight: 5000,
          rationale: 'Testing',
        },
      };

      const result = await service.createProposal(newProposal);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('WALLET_NOT_CONNECTED');
      }
    });

    it('should include proposer vote automatically', async () => {
      setTestWallet(beaconAddress, beaconCredential);

      const newProposal: NewAllianceProposal = {
        poolId,
        title: 'Add New Outlet',
        description: 'Proposal to add a new news outlet',
        payload: {
          type: 'outlet-add',
          outletId: 'outlet-1' as unknown as import('@cocuyo/types').OutletId,
          outletName: 'Test Outlet',
          treasury: 'treasury-1' as unknown as import('@cocuyo/types').TreasuryId,
          initialWeight: 5000,
          rationale: 'Testing',
        },
      };

      const result = await service.createProposal(newProposal);
      expect(result.ok).toBe(true);

      if (result.ok) {
        const proposal = await service.getProposal(result.value);
        expect(proposal).not.toBeNull();
        expect(proposal?.votes.length).toBe(1);
        expect(proposal?.votes[0]?.voter).toBe(beaconCredential);
        expect(proposal?.votes[0]?.decision).toBe('approve');
        expect(proposal?.votes[0]?.weight).toBe(10); // BEACON weight
      }
    });
  });

  describe('vote', () => {
    let proposalId: string;

    beforeEach(async () => {
      // Create a proposal first
      setTestWallet(beaconAddress, beaconCredential);

      const newProposal: NewAllianceProposal = {
        poolId,
        title: 'Test Proposal',
        description: 'Testing voting',
        payload: {
          type: 'outlet-add',
          outletId: 'outlet-1' as unknown as import('@cocuyo/types').OutletId,
          outletName: 'Test Outlet',
          treasury: 'treasury-1' as unknown as import('@cocuyo/types').TreasuryId,
          initialWeight: 5000,
          rationale: 'Testing',
        },
      };

      const result = await service.createProposal(newProposal);
      if (result.ok) {
        proposalId = result.value;
      }
    });

    it('should allow SPARK tier to vote', async () => {
      setTestWallet(sparkAddress, sparkCredential);

      const vote: NewAllianceVote = {
        decision: 'approve',
        rationale: 'I support this proposal',
      };

      const result = await service.vote(proposalId, vote);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.decision).toBe('approve');
        expect(result.value.weight).toBe(1); // SPARK weight
        expect(result.value.voter).toBe(sparkCredential);
      }
    });

    it('should reject double voting', async () => {
      setTestWallet(sparkAddress, sparkCredential);

      const vote: NewAllianceVote = { decision: 'approve' };

      // First vote should succeed
      const result1 = await service.vote(proposalId, vote);
      expect(result1.ok).toBe(true);

      // Second vote should fail
      const result2 = await service.vote(proposalId, vote);
      expect(result2.ok).toBe(false);
      if (!result2.ok) {
        expect(result2.error.type).toBe('ALREADY_VOTED');
      }
    });

    it('should track all vote types correctly', async () => {
      // Set up additional voters
      const flameAddress = createPolkadotAddress('0xflamecontributor1234567890123456789012345');
      const flameCredential = createDIMCredential('dim:flame:test');

      const flamePosition: ContributorPosition = {
        poolId,
        contributor: flameAddress,
        shares: 500n,
        cumulativeContributed: createPUSDAmount(100_000000n),
        tier: 'flame',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      seedPosition(flamePosition);

      // Spark votes approve
      setTestWallet(sparkAddress, sparkCredential);
      await service.vote(proposalId, { decision: 'approve' });

      // Flame votes reject
      setTestWallet(flameAddress, flameCredential);
      await service.vote(proposalId, { decision: 'reject' });

      // Check progress
      const progress = await service.getVotingProgress(proposalId);
      expect(progress).not.toBeNull();

      if (progress) {
        // BEACON (10) approve (proposer) + SPARK (1) approve = 11 approve
        // FLAME (3) reject
        expect(progress.weightByDecision.approve).toBe(11);
        expect(progress.weightByDecision.reject).toBe(3);
        expect(progress.totalWeight).toBe(14);
      }
    });
  });

  describe('getVotingProgress', () => {
    it('should calculate quorum and threshold correctly', async () => {
      // Create proposal with beacon contributor
      setTestWallet(beaconAddress, beaconCredential);

      const newProposal: NewAllianceProposal = {
        poolId,
        title: 'Test Proposal',
        description: 'Testing progress calculation',
        payload: {
          type: 'outlet-add',
          outletId: 'outlet-1' as unknown as import('@cocuyo/types').OutletId,
          outletName: 'Test Outlet',
          treasury: 'treasury-1' as unknown as import('@cocuyo/types').TreasuryId,
          initialWeight: 5000,
          rationale: 'Testing',
        },
      };

      const createResult = await service.createProposal(newProposal);
      expect(createResult.ok).toBe(true);

      if (createResult.ok) {
        const progress = await service.getVotingProgress(createResult.value);
        expect(progress).not.toBeNull();

        if (progress) {
          expect(progress.totalWeight).toBe(10); // Just proposer's BEACON vote
          expect(progress.quorumRequired).toBe(100); // Default quorum
          expect(progress.approvalThreshold).toBe(60); // Default threshold
        }
      }
    });
  });

  describe('hasVoted', () => {
    it('should return true for addresses that have voted', async () => {
      setTestWallet(beaconAddress, beaconCredential);

      const newProposal: NewAllianceProposal = {
        poolId,
        title: 'Test',
        description: 'Test',
        payload: {
          type: 'outlet-add',
          outletId: 'outlet-1' as unknown as import('@cocuyo/types').OutletId,
          outletName: 'Test',
          treasury: 'treasury-1' as unknown as import('@cocuyo/types').TreasuryId,
          initialWeight: 5000,
          rationale: 'Test',
        },
      };

      const result = await service.createProposal(newProposal);
      expect(result.ok).toBe(true);

      if (result.ok) {
        // Proposer has automatically voted
        const hasVoted = await service.hasVoted(result.value, beaconAddress);
        expect(hasVoted).toBe(true);

        // Spark hasn't voted yet
        const sparkHasVoted = await service.hasVoted(result.value, sparkAddress);
        expect(sparkHasVoted).toBe(false);
      }
    });
  });

  describe('canCreateProposal', () => {
    it('should return true for BEACON tier', async () => {
      const can = await service.canCreateProposal(beaconAddress, poolId);
      expect(can).toBe(true);
    });

    it('should return false for SPARK tier', async () => {
      const can = await service.canCreateProposal(sparkAddress, poolId);
      expect(can).toBe(false);
    });
  });

  describe('canVote', () => {
    it('should return true for SPARK tier', async () => {
      const can = await service.canVote(sparkAddress, poolId);
      expect(can).toBe(true);
    });

    it('should return true for BEACON tier', async () => {
      const can = await service.canVote(beaconAddress, poolId);
      expect(can).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('should return default config for pool', async () => {
      const config = await service.getConfig(poolId);

      expect(config).not.toBeNull();
      if (config) {
        expect(config.poolId).toBe(poolId);
        expect(config.minProposalTier).toBe('beacon');
        expect(config.minVotingTier).toBe('spark');
        expect(config.approvalThreshold).toBe(60);
        expect(config.emergencyApprovalThreshold).toBe(80);
      }
    });
  });

  describe('getProposal', () => {
    it('should return proposal from cache', async () => {
      const proposal: AllianceProposal = {
        id: 'test-proposal-1',
        poolId,
        proposalType: 'outlet-add',
        proposedBy: beaconCredential,
        proposerTier: 'beacon',
        title: 'Test',
        description: 'Test proposal',
        payload: {
          type: 'outlet-add',
          outletId: 'outlet-1' as unknown as import('@cocuyo/types').OutletId,
          outletName: 'Test',
          treasury: 'treasury-1' as unknown as import('@cocuyo/types').TreasuryId,
          initialWeight: 5000,
          rationale: 'Test',
        },
        votes: [],
        minVotingTier: 'spark',
        quorumRequired: 100,
        approvalThreshold: 60,
        status: 'voting',
        createdAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };

      addAllianceProposalToCache(proposal);

      const fetched = await service.getProposal('test-proposal-1');
      expect(fetched).not.toBeNull();
      expect(fetched?.title).toBe('Test');
    });

    it('should return null for non-existent proposal', async () => {
      const fetched = await service.getProposal('non-existent');
      expect(fetched).toBeNull();
    });
  });

  describe('getActiveProposals', () => {
    it('should return only active proposals', async () => {
      const activeProposal: AllianceProposal = {
        id: 'active-1',
        poolId,
        proposalType: 'outlet-add',
        proposedBy: beaconCredential,
        proposerTier: 'beacon',
        title: 'Active',
        description: 'Active proposal',
        payload: {
          type: 'outlet-add',
          outletId: 'outlet-1' as unknown as import('@cocuyo/types').OutletId,
          outletName: 'Test',
          treasury: 'treasury-1' as unknown as import('@cocuyo/types').TreasuryId,
          initialWeight: 5000,
          rationale: 'Test',
        },
        votes: [],
        minVotingTier: 'spark',
        quorumRequired: 100,
        approvalThreshold: 60,
        status: 'voting',
        createdAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };

      const expiredProposal: AllianceProposal = {
        ...activeProposal,
        id: 'expired-1',
        title: 'Expired',
        expiresAt: Date.now() - 1000, // Already expired
      };

      addAllianceProposalToCache(activeProposal);
      addAllianceProposalToCache(expiredProposal);

      const active = await service.getActiveProposals(poolId);
      expect(active.length).toBe(1);
      expect(active[0]?.title).toBe('Active');
    });
  });
});
