'use client';

/**
 * Signal service hook.
 *
 * Note: Named "Signal" for backwards compatibility.
 * In the new UX model, "Signal" is now "Post" in user-facing contexts.
 *
 * This hook wraps the singleton signalService to provide wallet state integration.
 * All data is stored in the singleton's cache to avoid cache divergence.
 */

import { useCallback } from 'react';
import type {
  PostService,
  Post,
  PostId,
  PostPreview,
  PostStatus,
  ChainId,
  PaginationParams,
  PaginatedResult,
  Result,
  NewPost,
} from '@cocuyo/types';
import { err } from '@cocuyo/types';
import { signalService } from '../service-instances';
import { type SignalServiceImpl } from '../signal-service';
import { setConnectedWallet } from '../service-utils';
import { useServiceWithWallet } from './useServiceWithWallet';

export type Locale = 'en' | 'es';

/**
 * Hook providing post service operations.
 *
 * All operations delegate to the singleton signalService to ensure
 * consistent caching. Write operations use wallet state from useSigner().
 */
export function useSignalService(): PostService {
  const { accountRef, connectedRef } = useServiceWithWallet();

  // Delegate read operations directly to singleton
  const getPost = useCallback(async (id: PostId, locale = 'en'): Promise<Post | null> => {
    return signalService.getPost(id, locale as 'en' | 'es');
  }, []);

  const getChainPosts = useCallback(
    async (chainId: ChainId, locale = 'en'): Promise<readonly Post[]> => {
      return signalService.getChainPosts(chainId, locale as 'en' | 'es');
    },
    []
  );

  const getRecentPosts = useCallback(
    async (params: {
      topic?: string;
      location?: string;
      status?: PostStatus;
      pagination: PaginationParams;
      locale?: string;
    }): Promise<PaginatedResult<PostPreview>> => {
      return signalService.getRecentPosts({
        ...params,
        locale: (params.locale ?? 'en') as 'en' | 'es',
      });
    },
    []
  );

  const getRecentPostsForDisplay = useCallback(
    async (params: {
      topic?: string;
      location?: string;
      status?: PostStatus;
      pagination: PaginationParams;
      locale?: string;
    }): Promise<PaginatedResult<Post>> => {
      // Use extended method if available
      const service = signalService as SignalServiceImpl;
      if ('getRecentPostsForDisplay' in service) {
        return service.getRecentPostsForDisplay({
          ...params,
          locale: (params.locale ?? 'en') as 'en' | 'es',
        });
      }
      // Fallback: getRecentPosts doesn't return full posts, so return empty
      return { items: [], total: 0, hasMore: false };
    },
    []
  );

  const getAllPosts = useCallback(
    async (params: {
      pagination: PaginationParams;
      locale?: string;
    }): Promise<PaginatedResult<PostPreview>> => {
      return signalService.getAllPosts({
        pagination: params.pagination,
        locale: (params.locale ?? 'en') as 'en' | 'es',
      });
    },
    []
  );

  const illuminate = useCallback(async (post: NewPost): Promise<Result<PostId, string>> => {
    const account = accountRef.current;
    const connected = connectedRef.current;

    if (!connected || !account) {
      return err('Wallet not connected. Please connect your wallet to illuminate.');
    }

    // Sync wallet state to singleton
    setConnectedWallet(account.address);

    // Delegate to singleton service which maintains the unified cache
    return signalService.illuminate(post);
  }, []);

  return {
    getPost,
    getChainPosts,
    getRecentPosts,
    getRecentPostsForDisplay,
    getAllPosts,
    illuminate,
  };
}
