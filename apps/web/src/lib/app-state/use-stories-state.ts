'use client';

/**
 * useStoriesState — story-chain slice of the app state.
 *
 * Owns the `storyChains` map. Creating a story records it, appends its id to the
 * user's created-story list, and links the first post; adding a post bumps the
 * chain's stats and wires the post's chain links. Posts and the user id list are
 * owned by other slices, so their setters are injected.
 */

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { createChainId } from '@cocuyo/types';
import type { Post, PostId, StoryChain, ChainId } from '@cocuyo/types';
import type { CurrentUser } from './types';
import { generateId } from './helpers';
import { seedStoryChains } from '@/lib/seed-data';

interface UseStoriesStateArgs {
  currentUser: CurrentUser;
  setPosts: Dispatch<SetStateAction<Map<PostId, Post>>>;
  setCreatedStoryIds: Dispatch<SetStateAction<ChainId[]>>;
}

export interface StoriesSlice {
  storyChains: Map<ChainId, StoryChain>;
  createStory: (
    title: string,
    description: string,
    firstPostId: PostId,
    topics?: string[]
  ) => StoryChain | null;
  addPostToStory: (chainId: ChainId, postId: PostId) => boolean;
  getStory: (id: ChainId) => StoryChain | undefined;
  getAllStories: () => StoryChain[];
}

export function useStoriesState({
  currentUser,
  setPosts,
  setCreatedStoryIds,
}: UseStoriesStateArgs): StoriesSlice {
  const [storyChains, setStoryChains] = useState<Map<ChainId, StoryChain>>(
    () => new Map(seedStoryChains)
  );

  const createStory = useCallback(
    (
      title: string,
      description: string,
      firstPostId: PostId,
      topics?: string[]
    ): StoryChain | null => {
      if (!currentUser.isConnected) {
        return null;
      }

      const now = Date.now();
      const id = createChainId(generateId());

      const chain: StoryChain = {
        id,
        title,
        description,
        topics: topics ?? [],
        status: 'emerging',
        postIds: [firstPostId],
        stats: {
          postCount: 1,
          corroborationCount: 0,
          challengeCount: 0,
          contributorCount: 1,
        },
        createdAt: now,
        updatedAt: now,
      };

      setStoryChains((prev) => new Map(prev).set(id, chain));
      setCreatedStoryIds((prev) => [...prev, id]);

      // Update post's chainLinks
      setPosts((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(firstPostId);
        if (existing) {
          newMap.set(firstPostId, {
            ...existing,
            chainLinks: [...existing.chainLinks, id],
          });
        }
        return newMap;
      });

      return chain;
    },
    [currentUser, setPosts, setCreatedStoryIds]
  );

  const addPostToStory = useCallback(
    (chainId: ChainId, postId: PostId): boolean => {
      if (!currentUser.isConnected) {
        return false;
      }

      const chain = storyChains.get(chainId);
      if (!chain) {
        return false;
      }

      if (chain.postIds.includes(postId)) {
        return false; // Already in chain
      }

      const now = Date.now();

      // Update chain
      setStoryChains((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(chainId);
        if (existing) {
          newMap.set(chainId, {
            ...existing,
            postIds: [...existing.postIds, postId],
            stats: {
              ...existing.stats,
              postCount: existing.stats.postCount + 1,
            },
            updatedAt: now,
          });
        }
        return newMap;
      });

      // Update post's chainLinks
      setPosts((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(postId);
        if (existing && !existing.chainLinks.includes(chainId)) {
          newMap.set(postId, {
            ...existing,
            chainLinks: [...existing.chainLinks, chainId],
          });
        }
        return newMap;
      });

      return true;
    },
    [currentUser, setPosts, storyChains]
  );

  const getStory = useCallback(
    (id: ChainId): StoryChain | undefined => {
      return storyChains.get(id);
    },
    [storyChains]
  );

  const getAllStories = useCallback((): StoryChain[] => {
    return Array.from(storyChains.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [storyChains]);

  return { storyChains, createStory, addPostToStory, getStory, getAllStories };
}
