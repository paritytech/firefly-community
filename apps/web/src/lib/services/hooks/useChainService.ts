'use client';

/**
 * Chain service hook.
 *
 * Provides story chain operations.
 * All operations are read-only (no wallet required).
 */

import { useCallback } from 'react';
import type {
  ChainService,
  StoryChain,
  ChainId,
  ChainPreview,
  PaginationParams,
  PaginatedResult,
} from '@cocuyo/types';
import { safeParseStoryChain } from '@cocuyo/types';
import { fetchFromBulletin } from '../service-utils';

export type Locale = 'en' | 'es';

/**
 * Hook providing story chain service operations.
 *
 * All operations are read-only and work without wallet connection.
 */
export function useChainService(): ChainService {
  const getChain = useCallback(async (id: ChainId, _locale = 'en'): Promise<StoryChain | null> => {
    return fetchFromBulletin<StoryChain>(id, safeParseStoryChain);
  }, []);

  const getChains = useCallback(
    async (_params: {
      topic?: string;
      location?: string;
      status?: StoryChain['status'];
      pagination: PaginationParams;
      locale?: string;
    }): Promise<PaginatedResult<ChainPreview>> => {
      // Returns empty until indexing is implemented
      return Promise.resolve({ items: [], total: 0, hasMore: false });
    },
    []
  );

  const getFeaturedChains = useCallback((_locale = 'en'): Promise<readonly ChainPreview[]> => {
    // Returns empty until indexing is implemented
    return Promise.resolve([]);
  }, []);

  return {
    getChain,
    getChains,
    getFeaturedChains,
  };
}
