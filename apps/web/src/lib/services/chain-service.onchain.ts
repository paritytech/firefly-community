/**
 * Chain-backed implementation of the ChainService.
 *
 * Stores and retrieves story chains from the Bulletin Chain.
 * Single-chain fetch by CID is functional.
 *
 * Query methods (getChains, getFeaturedChains) return empty results
 * because the IndexManager doesn't yet have a StoryChainIndex type.
 * To enable chain discovery, add StoryChainIndex to @cocuyo/bulletin/indexes.
 */

import type {
  ChainService,
  StoryChain,
  ChainId,
  ChainPreview,
  PaginationParams,
  PaginatedResult,
} from '@cocuyo/types';
import { safeParseStoryChain } from '@cocuyo/types';
import { fetchJsonFromHostStorage } from '../host/bulletin-storage';

/**
 * Chain-backed chain service.
 *
 * Provides real blockchain storage for story chains via Bulletin Chain.
 * Query methods return empty results until indexing is implemented.
 * Use MockChainService for development.
 */
export class OnChainChainService implements ChainService {
  /**
   * Get a chain by its CID.
   *
   * Fetches the chain data from Bulletin Chain, validates, and parses it.
   */
  async getChain(id: ChainId, _locale?: string): Promise<StoryChain | null> {
    try {
      const data = await fetchJsonFromHostStorage<unknown>(id);
      return safeParseStoryChain(data);
    } catch {
      return null;
    }
  }

  /**
   * Get chain previews.
   *
   * Returns empty results until StoryChainIndex is added to @cocuyo/bulletin.
   * For demos, use the seed data service (NEXT_PUBLIC_USE_CHAIN=false).
   */
  getChains(_params: {
    topic?: string;
    location?: string;
    status?: StoryChain['status'];
    pagination: PaginationParams;
    locale?: string;
  }): Promise<PaginatedResult<ChainPreview>> {
    return Promise.resolve({
      items: [],
      total: 0,
      hasMore: false,
    });
  }

  /**
   * Get featured chains.
   *
   * Returns empty results until StoryChainIndex is added to @cocuyo/bulletin.
   * For demos, use the seed data service (NEXT_PUBLIC_USE_CHAIN=false).
   */
  getFeaturedChains(_locale?: string): Promise<readonly ChainPreview[]> {
    return Promise.resolve([]);
  }
}
