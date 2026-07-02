/**
 * Tests for CrowdstackingService.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CrowdstackingServiceImpl,
  clearCrowdstackingCache,
  seedPoolState,
  seedPosition,
} from './crowdstacking-service';
import {
  createPolkadotAddress,
  createPoolId,
  createPUSDAmount,
  createWithdrawalRequestId,
  MIN_CONTRIBUTION,
  SHARE_PRECISION,
  INITIAL_SHARE_PRICE,
} from '@cocuyo/types';
import type { PoolState, ContributorPosition } from '@cocuyo/types';
import { setConnectedWallet } from './service-utils';

// Mock the logger
vi.mock('../logging', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock the storage
vi.mock('../host/storage', () => ({
  storage: {
    read: vi.fn().mockResolvedValue(null),
    write: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock bulletin upload
vi.mock('./service-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./service-utils')>();
  return {
    ...actual,
    uploadToBulletin: vi.fn().mockResolvedValue({
      cid: 'mock-cid-123',
      hash: '0x' + '0'.repeat(64),
    }),
  };
});

describe('CrowdstackingServiceImpl', () => {
  let service: CrowdstackingServiceImpl;
  const testAddress = createPolkadotAddress('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');

  beforeEach(async () => {
    await clearCrowdstackingCache();
    service = new CrowdstackingServiceImpl();
    setConnectedWallet(null); // Clear wallet state
  });

  describe('getPoolState', () => {
    it('returns default pool state when not seeded', async () => {
      const state = await service.getPoolState();

      expect(state).not.toBeNull();
      expect(state?.name).toBe('Firefly Alliance Pool');
      expect(state?.totalShares).toBe(0n);
      expect(state?.totalAssets).toBe(0n);
      expect(state?.sharePrice).toBe(INITIAL_SHARE_PRICE);
      expect(state?.isOpen).toBe(true);
      expect(state?.isPaused).toBe(false);
    });

    it('returns seeded pool state', async () => {
      // First, initialize the service to load default state
      await service.getPoolState();

      // Now seed the pool state (overwriting default)
      const mockState: PoolState = {
        id: createPoolId('test-pool'),
        name: 'Test Pool',
        totalShares: 1000n * SHARE_PRECISION,
        totalAssets: createPUSDAmount(1000_000_000n),
        sharePrice: INITIAL_SHARE_PRICE,
        contributorCount: 10,
        isOpen: true,
        isPaused: false,
        paymentToken: testAddress,
        outletRegistry: testAddress,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      seedPoolState(mockState);
      const state = await service.getPoolState();

      expect(state?.name).toBe('Test Pool');
      expect(state?.contributorCount).toBe(10);
    });
  });

  describe('getPosition', () => {
    it('returns null for non-existent position', async () => {
      const position = await service.getPosition(testAddress);
      expect(position).toBeNull();
    });

    it('returns seeded position', async () => {
      const mockPosition: ContributorPosition = {
        poolId: createPoolId('test-pool'),
        contributor: testAddress,
        shares: 100n * SHARE_PRECISION,
        cumulativeContributed: createPUSDAmount(100_000_000n),
        tier: 'flame',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      seedPosition(mockPosition);
      const position = await service.getPosition(testAddress);

      expect(position).not.toBeNull();
      expect(position?.tier).toBe('flame');
      expect(position?.shares).toBe(100n * SHARE_PRECISION);
    });
  });

  describe('getPoolStats', () => {
    it('returns pool statistics', async () => {
      const stats = await service.getPoolStats();

      expect(stats).not.toBeNull();
      expect(stats?.tvl).toBeDefined();
      expect(stats?.activeContributors).toBeDefined();
      expect(stats?.fundedOutlets).toBeDefined();
      expect(stats?.totalDistributed).toBeDefined();
    });
  });

  describe('contribute', () => {
    it('returns error when wallet not connected', async () => {
      const amount = createPUSDAmount(MIN_CONTRIBUTION);
      const result = await service.contribute(amount);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('WALLET_NOT_CONNECTED');
      }
    });

    it('returns error when amount below minimum', async () => {
      setConnectedWallet(testAddress);
      const amount = createPUSDAmount(MIN_CONTRIBUTION - 1n);
      const result = await service.contribute(amount);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('BELOW_MINIMUM');
      }
    });

    it('creates position on first contribution', async () => {
      setConnectedWallet(testAddress);
      const amount = createPUSDAmount(MIN_CONTRIBUTION);
      const result = await service.contribute(amount);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.txHash).toBeDefined();
        expect(result.value.shares).toBeGreaterThan(0n);
      }

      // Verify position was created
      const position = await service.getPosition(testAddress);
      expect(position).not.toBeNull();
      expect(position?.tier).toBe('spark');
    });

    it('calculates correct tier based on amount', async () => {
      setConnectedWallet(testAddress);
      // Contribute $500 (beacon tier)
      const amount = createPUSDAmount(500_000_000n);
      await service.contribute(amount);

      const position = await service.getPosition(testAddress);
      expect(position?.tier).toBe('beacon');
    });
  });

  describe('requestWithdrawal', () => {
    it('returns error when wallet not connected', async () => {
      const result = await service.requestWithdrawal(100n);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('WALLET_NOT_CONNECTED');
      }
    });

    it('returns error when insufficient shares', async () => {
      setConnectedWallet(testAddress);

      // Seed a position with 50 shares
      seedPosition({
        poolId: createPoolId('test'),
        contributor: testAddress,
        shares: 50n * SHARE_PRECISION,
        cumulativeContributed: createPUSDAmount(50_000_000n),
        tier: 'spark',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Try to withdraw 100 shares
      const result = await service.requestWithdrawal(100n * SHARE_PRECISION);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('INSUFFICIENT_SHARES');
      }
    });

    it('creates withdrawal request with cooldown', async () => {
      setConnectedWallet(testAddress);

      // Seed a position
      seedPosition({
        poolId: createPoolId('test'),
        contributor: testAddress,
        shares: 100n * SHARE_PRECISION,
        cumulativeContributed: createPUSDAmount(100_000_000n),
        tier: 'flame',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const result = await service.requestWithdrawal(50n * SHARE_PRECISION);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.requestId).toBeDefined();
      }

      // Verify withdrawal request was created
      const requests = await service.getWithdrawalRequests(testAddress);
      expect(requests.length).toBe(1);
      expect(requests[0]?.status).toBe('pending');
      expect(requests[0]?.shares).toBe(50n * SHARE_PRECISION);
    });
  });

  describe('completeWithdrawal', () => {
    it('returns error for non-existent request', async () => {
      setConnectedWallet(testAddress);
      const result = await service.completeWithdrawal(createWithdrawalRequestId('non-existent'));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('REQUEST_NOT_FOUND');
      }
    });
  });

  describe('cancelWithdrawal', () => {
    it('returns error for non-existent request', async () => {
      setConnectedWallet(testAddress);
      const result = await service.cancelWithdrawal(createWithdrawalRequestId('non-existent'));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('REQUEST_NOT_FOUND');
      }
    });
  });

  describe('getWithdrawalRequests', () => {
    it('returns empty array when no requests', async () => {
      const requests = await service.getWithdrawalRequests(testAddress);
      expect(requests).toEqual([]);
    });
  });

  describe('getWithdrawalRequest', () => {
    it('returns null for non-existent request', async () => {
      const request = await service.getWithdrawalRequest(createWithdrawalRequestId('non-existent'));
      expect(request).toBeNull();
    });
  });
});
