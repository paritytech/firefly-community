/**
 * Chain Service implementation.
 *
 * This service provides story chain data access.
 * Returns empty results until indexing is implemented.
 */

import type {
  ChainService,
  StoryChain,
  ChainId,
  ChainPreview,
  PaginationParams,
  PaginatedResult,
} from '@cocuyo/types';
import { fetchFromBulletin } from './service-utils';
import { getSeedStoryChainsForLocale } from '@/lib/seed-data';

export type Locale = 'en' | 'es';

// Session cache for user-created chains (non-seed data only)
const userCreatedChains: StoryChain[] = [];

export class ChainServiceImpl implements ChainService {
  async getChain(id: ChainId, locale?: string): Promise<StoryChain | null> {
    const loc = (locale === 'es' ? 'es' : 'en') as Locale;

    // Check user-created chains first
    const userChain = userCreatedChains.find((c) => c.id === id);
    if (userChain) return userChain;

    // Check localized seed data
    const seedChain = getSeedStoryChainsForLocale(loc).get(id);
    if (seedChain) return seedChain;

    // Try fetching from Bulletin Chain
    return fetchFromBulletin<StoryChain>(id);
  }

  getChains(params: {
    topic?: string;
    location?: string;
    status?: StoryChain['status'];
    pagination: PaginationParams;
    locale?: Locale;
  }): Promise<PaginatedResult<ChainPreview>> {
    const locale = params.locale ?? 'en';
    const allChains = [...userCreatedChains, ...getSeedStoryChainsForLocale(locale).values()];

    // Convert to previews
    const previews: ChainPreview[] = allChains.map((chain) => ({
      id: chain.id,
      title: chain.title,
      topics: [...chain.topics],
      status: chain.status,
      postCount: chain.stats.postCount,
      corroborationCount: chain.stats.corroborationCount,
      updatedAt: chain.updatedAt,
    }));

    return Promise.resolve({
      items: previews,
      total: previews.length,
      hasMore: false,
    });
  }

  getFeaturedChains(locale: Locale = 'en'): Promise<readonly ChainPreview[]> {
    const allChains = [...userCreatedChains, ...getSeedStoryChainsForLocale(locale).values()];

    // Convert to previews
    const previews: ChainPreview[] = allChains.map((chain) => ({
      id: chain.id,
      title: chain.title,
      topics: [...chain.topics],
      status: chain.status,
      postCount: chain.stats.postCount,
      corroborationCount: chain.stats.corroborationCount,
      updatedAt: chain.updatedAt,
    }));

    return Promise.resolve(previews);
  }
}

// Export a singleton instance
export const chainService = new ChainServiceImpl();

// Legacy alias for backward compatibility
export { ChainServiceImpl as MockChainService };
