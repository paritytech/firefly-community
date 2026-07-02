/**
 * Outlet Registry Service implementation.
 *
 * Provides access to the OutletRegistry contract for viewing
 * funded outlets and distribution history.
 *
 * This is a session-cached implementation that will integrate with
 * the on-chain contracts when available.
 */

import type {
  OutletId,
  OutletAllocation,
  DistributionEvent,
  PUSDAmount,
  PaginationParams,
  PaginatedResult,
} from '@cocuyo/types';
import { createOutletId, createTreasuryId, ZERO_PUSD, addPUSD, BASIS_POINTS } from '@cocuyo/types';
import { paginate } from './service-utils';
import { storage } from '../host/storage';
import { createLogger } from '../logging';

const logger = createLogger('OutletRegistryService');

// ============================================================
// Service Interface
// ============================================================

export interface IOutletRegistryService {
  /** Get all outlets in the registry */
  getOutlets(): Promise<readonly OutletAllocation[]>;

  /** Get active outlets only */
  getActiveOutlets(): Promise<readonly OutletAllocation[]>;

  /** Get a specific outlet by ID */
  getOutlet(outletId: OutletId): Promise<OutletAllocation | null>;

  /** Get distribution history */
  getDistributionHistory(params: PaginationParams): Promise<PaginatedResult<DistributionEvent>>;

  /** Get total distributed amount */
  getTotalDistributed(): Promise<PUSDAmount>;

  /** Validate that outlet weights sum to 100% */
  validateWeights(): Promise<boolean>;
}

// ============================================================
// Storage Keys
// ============================================================

const OUTLETS_KEY = 'outlet-registry-outlets';
const DISTRIBUTIONS_KEY = 'outlet-registry-distributions';

// ============================================================
// Session Caches
// ============================================================

const outletsCache = new Map<string, OutletAllocation>();
const distributionsCache: DistributionEvent[] = [];

// ============================================================
// Implementation
// ============================================================

export class OutletRegistryServiceImpl implements IOutletRegistryService {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    // Load from persistent storage
    const [storedOutlets, storedDistributions] = await Promise.all([
      storage.read<Record<string, OutletAllocation>>(OUTLETS_KEY),
      storage.read<DistributionEvent[]>(DISTRIBUTIONS_KEY),
    ]);

    if (storedOutlets) {
      for (const [id, outlet] of Object.entries(storedOutlets)) {
        outletsCache.set(id, outlet);
      }
    }

    if (storedDistributions) {
      distributionsCache.push(...storedDistributions);
    }

    // If no outlets, seed with demo data
    if (outletsCache.size === 0) {
      await this.seedDemoOutlets();
    }

    this.initialized = true;
    logger.debug('OutletRegistry service initialized', 'ensureInitialized', {
      outlets: outletsCache.size,
      distributions: distributionsCache.length,
    });
  }

  private async seedDemoOutlets(): Promise<void> {
    const now = Date.now();

    const demoOutlets: OutletAllocation[] = [
      {
        outletId: createOutletId('outlet-la-voz'),
        treasury: createTreasuryId('treasury-la-voz'),
        name: 'La Voz del Pueblo',
        weight: 3000, // 30%
        isActive: true,
        addedAt: now - 90 * 24 * 60 * 60 * 1000, // 90 days ago
        totalDistributed: ZERO_PUSD,
      },
      {
        outletId: createOutletId('outlet-verdad'),
        treasury: createTreasuryId('treasury-verdad'),
        name: 'Verdad Abierta',
        weight: 2500, // 25%
        isActive: true,
        addedAt: now - 60 * 24 * 60 * 60 * 1000, // 60 days ago
        totalDistributed: ZERO_PUSD,
      },
      {
        outletId: createOutletId('outlet-luz'),
        treasury: createTreasuryId('treasury-luz'),
        name: 'Luz Informativa',
        weight: 2500, // 25%
        isActive: true,
        addedAt: now - 45 * 24 * 60 * 60 * 1000, // 45 days ago
        totalDistributed: ZERO_PUSD,
      },
      {
        outletId: createOutletId('outlet-digital'),
        treasury: createTreasuryId('treasury-digital'),
        name: 'El Digital Independiente',
        weight: 2000, // 20%
        isActive: true,
        addedAt: now - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        totalDistributed: ZERO_PUSD,
      },
    ];

    for (const outlet of demoOutlets) {
      outletsCache.set(outlet.outletId, outlet);
    }

    await storage.write(OUTLETS_KEY, Object.fromEntries(outletsCache));
    logger.info('Seeded demo outlets', 'seedDemoOutlets', { count: demoOutlets.length });
  }

  async getOutlets(): Promise<readonly OutletAllocation[]> {
    await this.ensureInitialized();
    return Array.from(outletsCache.values());
  }

  async getActiveOutlets(): Promise<readonly OutletAllocation[]> {
    await this.ensureInitialized();
    return Array.from(outletsCache.values()).filter((o) => o.isActive);
  }

  async getOutlet(outletId: OutletId): Promise<OutletAllocation | null> {
    await this.ensureInitialized();
    return outletsCache.get(outletId) ?? null;
  }

  async getDistributionHistory(
    params: PaginationParams
  ): Promise<PaginatedResult<DistributionEvent>> {
    await this.ensureInitialized();

    // Sort by most recent first
    const sorted = [...distributionsCache].sort((a, b) => b.distributedAt - a.distributedAt);

    return paginate(sorted, params);
  }

  async getTotalDistributed(): Promise<PUSDAmount> {
    await this.ensureInitialized();

    let total = ZERO_PUSD;
    for (const outlet of outletsCache.values()) {
      total = addPUSD(total, outlet.totalDistributed);
    }
    return total;
  }

  async validateWeights(): Promise<boolean> {
    await this.ensureInitialized();

    const activeOutlets = Array.from(outletsCache.values()).filter((o) => o.isActive);

    if (activeOutlets.length === 0) return true;

    const totalWeight = activeOutlets.reduce((sum, o) => sum + o.weight, 0);
    return totalWeight === BASIS_POINTS;
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const outletRegistryService = new OutletRegistryServiceImpl();

// ============================================================
// Test Helpers
// ============================================================

/**
 * Clear all outlet registry caches. Use in tests for isolation.
 */
export async function clearOutletRegistryCache(): Promise<void> {
  outletsCache.clear();
  distributionsCache.length = 0;

  await Promise.all([storage.clear(OUTLETS_KEY), storage.clear(DISTRIBUTIONS_KEY)]);
}

/**
 * Seed an outlet for testing.
 */
export function seedOutlet(outlet: OutletAllocation): void {
  outletsCache.set(outlet.outletId, outlet);
}

/**
 * Seed a distribution event for testing.
 */
export function seedDistribution(event: DistributionEvent): void {
  distributionsCache.push(event);
}
