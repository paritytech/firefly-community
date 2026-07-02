/**
 * Tests for chain service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChainServiceImpl, chainService } from './chain-service';
import type { StoryChain, ChainId } from '@cocuyo/types';
import { createChainId } from '@cocuyo/types';

// Mock dependencies
vi.mock('./service-utils', () => ({
  fetchFromBulletin: vi.fn(),
}));

vi.mock('@/lib/seed-data', () => ({
  getSeedStoryChainsForLocale: vi.fn(),
}));

import { fetchFromBulletin } from './service-utils';
import { getSeedStoryChainsForLocale } from '@/lib/seed-data';

const mockedFetchFromBulletin = vi.mocked(fetchFromBulletin);
const mockedGetSeedStoryChainsForLocale = vi.mocked(getSeedStoryChainsForLocale);

const createMockChain = (id: string): StoryChain => ({
  id: createChainId(id),
  title: `Chain ${id}`,
  description: 'A test chain',
  topics: ['politics'],
  postIds: [],
  status: 'active',
  stats: {
    postCount: 5,
    corroborationCount: 10,
    challengeCount: 1,
    contributorCount: 3,
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

describe('ChainServiceImpl', () => {
  let service: ChainServiceImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChainServiceImpl();

    // Default mock setup: empty seed data
    mockedGetSeedStoryChainsForLocale.mockReturnValue(new Map());
    mockedFetchFromBulletin.mockResolvedValue(null);
  });

  describe('getChain', () => {
    it('returns chain from seed data', async () => {
      const mockChain = createMockChain('seed-chain-1');
      const seedMap = new Map<ChainId, StoryChain>([[mockChain.id, mockChain]]);
      mockedGetSeedStoryChainsForLocale.mockReturnValue(seedMap);

      const result = await service.getChain(mockChain.id);

      expect(result).toBe(mockChain);
      expect(mockedGetSeedStoryChainsForLocale).toHaveBeenCalledWith('en');
    });

    it('returns chain from seed data with locale', async () => {
      const mockChain = createMockChain('seed-chain-es');
      const seedMap = new Map<ChainId, StoryChain>([[mockChain.id, mockChain]]);
      mockedGetSeedStoryChainsForLocale.mockReturnValue(seedMap);

      const result = await service.getChain(mockChain.id, 'es');

      expect(result).toBe(mockChain);
      expect(mockedGetSeedStoryChainsForLocale).toHaveBeenCalledWith('es');
    });

    it('falls back to bulletin fetch when not in seed data', async () => {
      const bulletinChain = createMockChain('bulletin-chain');
      mockedGetSeedStoryChainsForLocale.mockReturnValue(new Map());
      mockedFetchFromBulletin.mockResolvedValue(bulletinChain);

      const result = await service.getChain(createChainId('unknown-id'));

      expect(mockedFetchFromBulletin).toHaveBeenCalledWith(createChainId('unknown-id'));
      expect(result).toBe(bulletinChain);
    });

    it('returns null when chain not found anywhere', async () => {
      mockedGetSeedStoryChainsForLocale.mockReturnValue(new Map());
      mockedFetchFromBulletin.mockResolvedValue(null);

      const result = await service.getChain(createChainId('nonexistent'));

      expect(result).toBeNull();
    });
  });

  describe('getChains', () => {
    it('returns paginated chain previews', async () => {
      const chain1 = createMockChain('chain-1');
      const chain2 = createMockChain('chain-2');
      const seedMap = new Map<ChainId, StoryChain>([
        [chain1.id, chain1],
        [chain2.id, chain2],
      ]);
      mockedGetSeedStoryChainsForLocale.mockReturnValue(seedMap);

      const result = await service.getChains({
        pagination: { limit: 10, offset: 0 },
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('converts chains to previews with correct fields', async () => {
      const chain = createMockChain('chain-preview');
      const seedMap = new Map<ChainId, StoryChain>([[chain.id, chain]]);
      mockedGetSeedStoryChainsForLocale.mockReturnValue(seedMap);

      const result = await service.getChains({
        pagination: { limit: 10, offset: 0 },
      });

      expect(result.items[0]).toMatchObject({
        id: chain.id,
        title: chain.title,
        topics: chain.topics,
        status: chain.status,
        postCount: chain.stats.postCount,
        corroborationCount: chain.stats.corroborationCount,
      });
    });

    it('uses specified locale', async () => {
      mockedGetSeedStoryChainsForLocale.mockReturnValue(new Map());

      await service.getChains({
        pagination: { limit: 10, offset: 0 },
        locale: 'es',
      });

      expect(mockedGetSeedStoryChainsForLocale).toHaveBeenCalledWith('es');
    });
  });

  describe('getFeaturedChains', () => {
    it('returns all chains as featured', async () => {
      const chain1 = createMockChain('featured-1');
      const chain2 = createMockChain('featured-2');
      const seedMap = new Map<ChainId, StoryChain>([
        [chain1.id, chain1],
        [chain2.id, chain2],
      ]);
      mockedGetSeedStoryChainsForLocale.mockReturnValue(seedMap);

      const result = await service.getFeaturedChains();

      expect(result).toHaveLength(2);
    });

    it('uses specified locale', async () => {
      mockedGetSeedStoryChainsForLocale.mockReturnValue(new Map());

      await service.getFeaturedChains('es');

      expect(mockedGetSeedStoryChainsForLocale).toHaveBeenCalledWith('es');
    });

    it('defaults to en locale', async () => {
      mockedGetSeedStoryChainsForLocale.mockReturnValue(new Map());

      await service.getFeaturedChains();

      expect(mockedGetSeedStoryChainsForLocale).toHaveBeenCalledWith('en');
    });
  });
});

describe('chainService singleton', () => {
  it('is an instance of ChainServiceImpl', () => {
    expect(chainService).toBeInstanceOf(ChainServiceImpl);
  });
});
