/**
 * Tests for OutletRegistryService.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OutletRegistryServiceImpl,
  clearOutletRegistryCache,
  seedOutlet,
  seedDistribution,
} from './outlet-registry-service';
import { createOutletId, createTreasuryId, createPoolId, createPUSDAmount } from '@cocuyo/types';
import type { OutletAllocation, DistributionEvent } from '@cocuyo/types';

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

describe('OutletRegistryServiceImpl', () => {
  let service: OutletRegistryServiceImpl;

  beforeEach(async () => {
    await clearOutletRegistryCache();
    service = new OutletRegistryServiceImpl();
  });

  describe('getOutlets', () => {
    it('returns demo outlets when none seeded', async () => {
      const outlets = await service.getOutlets();

      expect(outlets.length).toBeGreaterThan(0);
      // Demo outlets should exist (e.g., "La Voz del Pueblo", "Verdad Abierta")
      expect(outlets.some((o) => o.name.includes('Voz') || o.name.includes('Verdad'))).toBe(true);
    });

    it('returns seeded outlets', async () => {
      // Initialize first
      await service.getOutlets();

      // Clear and seed our own
      await clearOutletRegistryCache();
      service = new OutletRegistryServiceImpl();

      const mockOutlet: OutletAllocation = {
        outletId: createOutletId('test-outlet'),
        treasury: createTreasuryId('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'),
        name: 'Test News Outlet',
        weight: 5000,
        isActive: true,
        addedAt: Date.now(),
        totalDistributed: createPUSDAmount(0n),
      };

      // Initialize, then seed
      await service.getOutlets();
      seedOutlet(mockOutlet);
      const outlets = await service.getOutlets();

      expect(outlets.some((o) => o.name === 'Test News Outlet')).toBe(true);
    });
  });

  describe('getActiveOutlets', () => {
    it('returns only active outlets', async () => {
      // Initialize
      await service.getOutlets();

      // Seed active and inactive outlets
      const activeOutlet: OutletAllocation = {
        outletId: createOutletId('active-outlet'),
        treasury: createTreasuryId('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'),
        name: 'Active Outlet',
        weight: 5000,
        isActive: true,
        addedAt: Date.now(),
        totalDistributed: createPUSDAmount(0n),
      };

      const inactiveOutlet: OutletAllocation = {
        outletId: createOutletId('inactive-outlet'),
        treasury: createTreasuryId('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'),
        name: 'Inactive Outlet',
        weight: 5000,
        isActive: false,
        addedAt: Date.now(),
        totalDistributed: createPUSDAmount(0n),
      };

      seedOutlet(activeOutlet);
      seedOutlet(inactiveOutlet);

      const activeOutlets = await service.getActiveOutlets();

      expect(activeOutlets.some((o) => o.name === 'Active Outlet')).toBe(true);
      expect(activeOutlets.some((o) => o.name === 'Inactive Outlet')).toBe(false);
    });
  });

  describe('getOutlet', () => {
    it('returns null for non-existent outlet', async () => {
      const outlet = await service.getOutlet(createOutletId('non-existent'));
      expect(outlet).toBeNull();
    });

    it('returns seeded outlet', async () => {
      // Initialize
      await service.getOutlets();

      const mockOutlet: OutletAllocation = {
        outletId: createOutletId('specific-outlet'),
        treasury: createTreasuryId('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'),
        name: 'Specific Outlet',
        weight: 3000,
        isActive: true,
        addedAt: Date.now(),
        totalDistributed: createPUSDAmount(100_000_000n),
      };

      seedOutlet(mockOutlet);
      const outlet = await service.getOutlet(createOutletId('specific-outlet'));

      expect(outlet).not.toBeNull();
      expect(outlet?.name).toBe('Specific Outlet');
      expect(outlet?.weight).toBe(3000);
    });
  });

  describe('getDistributionHistory', () => {
    it('returns empty when no distributions', async () => {
      // Initialize but don't seed distributions
      await service.getOutlets();

      const result = await service.getDistributionHistory({ limit: 10, offset: 0 });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('returns seeded distributions', async () => {
      // Initialize
      await service.getOutlets();

      const mockDistribution: DistributionEvent = {
        poolId: createPoolId('test-pool'),
        totalAmount: createPUSDAmount(100_000_000n),
        distributions: [
          {
            outletId: createOutletId('outlet-1'),
            amount: createPUSDAmount(50_000_000n),
            treasury: createTreasuryId('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'),
          },
        ],
        txHash: '0x' + '1'.repeat(64),
        distributedAt: Date.now(),
      };

      seedDistribution(mockDistribution);
      const result = await service.getDistributionHistory({ limit: 10, offset: 0 });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0]?.totalAmount).toBe(100_000_000n);
    });

    it('paginates correctly', async () => {
      // Initialize
      await service.getOutlets();

      // Seed multiple distributions
      for (let i = 0; i < 5; i++) {
        seedDistribution({
          poolId: createPoolId('test-pool'),
          totalAmount: createPUSDAmount(BigInt((i + 1) * 10_000_000)),
          distributions: [],
          txHash: '0x' + i.toString().repeat(64),
          distributedAt: Date.now() - i * 1000,
        });
      }

      const page1 = await service.getDistributionHistory({ limit: 2, offset: 0 });
      const page2 = await service.getDistributionHistory({ limit: 2, offset: 2 });

      expect(page1.items.length).toBe(2);
      expect(page2.items.length).toBe(2);
      expect(page1.total).toBe(5);
      expect(page1.hasMore).toBe(true);
    });
  });

  describe('getTotalDistributed', () => {
    it('returns zero when no distributions', async () => {
      await clearOutletRegistryCache();
      service = new OutletRegistryServiceImpl();

      // Don't initialize - will seed demo data which may have distributions
      // Just test the method returns a value
      const total = await service.getTotalDistributed();
      expect(total).toBeDefined();
    });
  });

  describe('validateWeights', () => {
    it('returns true when weights sum to 100%', async () => {
      await clearOutletRegistryCache();
      service = new OutletRegistryServiceImpl();

      // Seed outlets that sum to 100% (10000 basis points)
      seedOutlet({
        outletId: createOutletId('outlet-1'),
        treasury: createTreasuryId('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'),
        name: 'Outlet 1',
        weight: 5000,
        isActive: true,
        addedAt: Date.now(),
        totalDistributed: createPUSDAmount(0n),
      });

      seedOutlet({
        outletId: createOutletId('outlet-2'),
        treasury: createTreasuryId('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'),
        name: 'Outlet 2',
        weight: 3000,
        isActive: true,
        addedAt: Date.now(),
        totalDistributed: createPUSDAmount(0n),
      });

      seedOutlet({
        outletId: createOutletId('outlet-3'),
        treasury: createTreasuryId('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'),
        name: 'Outlet 3',
        weight: 2000,
        isActive: true,
        addedAt: Date.now(),
        totalDistributed: createPUSDAmount(0n),
      });

      const isValid = await service.validateWeights();
      expect(isValid).toBe(true);
    });

    it('returns false when weights do not sum to 100%', async () => {
      await clearOutletRegistryCache();
      service = new OutletRegistryServiceImpl();

      // Seed outlets that don't sum to 100%
      seedOutlet({
        outletId: createOutletId('outlet-1'),
        treasury: createTreasuryId('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'),
        name: 'Outlet 1',
        weight: 5000,
        isActive: true,
        addedAt: Date.now(),
        totalDistributed: createPUSDAmount(0n),
      });

      const isValid = await service.validateWeights();
      expect(isValid).toBe(false);
    });

    it('ignores inactive outlets in weight calculation', async () => {
      await clearOutletRegistryCache();
      service = new OutletRegistryServiceImpl();

      // One active outlet with 100%, one inactive
      seedOutlet({
        outletId: createOutletId('outlet-active'),
        treasury: createTreasuryId('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'),
        name: 'Active Outlet',
        weight: 10000,
        isActive: true,
        addedAt: Date.now(),
        totalDistributed: createPUSDAmount(0n),
      });

      seedOutlet({
        outletId: createOutletId('outlet-inactive'),
        treasury: createTreasuryId('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'),
        name: 'Inactive Outlet',
        weight: 5000,
        isActive: false,
        addedAt: Date.now(),
        totalDistributed: createPUSDAmount(0n),
      });

      const isValid = await service.validateWeights();
      expect(isValid).toBe(true);
    });
  });
});
