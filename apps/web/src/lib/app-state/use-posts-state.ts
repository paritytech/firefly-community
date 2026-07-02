'use client';

/**
 * usePostsState — posts slice of the app state.
 *
 * Owns the `posts` map and the post creation/getter surface. `setPosts` is
 * exposed because corroboration and story actions also mutate posts (summary
 * counts, chain links); the provider wires those domains to the same setter so
 * there is a single source of truth for posts.
 */

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { createPostId, emptyCorroborationSummary } from '@cocuyo/types';
import type { Post, PostId, NewPost } from '@cocuyo/types';
import type { CurrentUser } from './types';
import { generateId } from './helpers';
import { seedPosts } from '@/lib/seed-data';

interface UsePostsStateArgs {
  currentUser: CurrentUser;
  selectedAccount: { address: string } | null;
  setCreatedPostIds: Dispatch<SetStateAction<PostId[]>>;
}

export interface PostsSlice {
  posts: Map<PostId, Post>;
  setPosts: Dispatch<SetStateAction<Map<PostId, Post>>>;
  createPost: (input: NewPost) => Post | null;
  getPost: (id: PostId) => Post | undefined;
  getAllPosts: () => Post[];
}

export function usePostsState({
  currentUser,
  selectedAccount,
  setCreatedPostIds,
}: UsePostsStateArgs): PostsSlice {
  const [posts, setPosts] = useState<Map<PostId, Post>>(() => new Map(seedPosts));

  const createPost = useCallback(
    (input: NewPost): Post | null => {
      if (
        !currentUser.isConnected ||
        currentUser.credentialHash === null ||
        currentUser.pseudonym === null
      ) {
        return null;
      }

      const now = Date.now();
      const id = createPostId(generateId());

      const post: Post = {
        id,
        author: {
          id: selectedAccount?.address ?? '',
          credentialHash: currentUser.credentialHash,
          pseudonym: currentUser.pseudonym,
          disclosureLevel: 'anonymous',
        },
        content: {
          ...(input.content.title !== undefined && { title: input.content.title }),
          text: input.content.text,
          ...(input.content.links !== undefined && { links: input.content.links }),
          ...(input.content.media !== undefined && { media: input.content.media }),
        },
        context: {
          topics: [...input.context.topics],
          ...(input.context.locationName !== undefined && {
            locationName: input.context.locationName,
          }),
          ...(input.context.location !== undefined && { location: input.context.location }),
          ...(input.context.timeframe !== undefined && { timeframe: input.context.timeframe }),
        },
        dimSignature: currentUser.credentialHash,
        status: 'published',
        chainLinks: input.chainLinks ?? [],
        corroborations: emptyCorroborationSummary(),
        verification: { status: 'unverified' },
        createdAt: now,
      };

      setPosts((prev) => new Map(prev).set(id, post));
      setCreatedPostIds((prev) => [...prev, id]);

      return post;
    },
    [currentUser, selectedAccount, setCreatedPostIds]
  );

  const getPost = useCallback(
    (id: PostId): Post | undefined => {
      return posts.get(id);
    },
    [posts]
  );

  const getAllPosts = useCallback((): Post[] => {
    return Array.from(posts.values()).sort((a, b) => b.createdAt - a.createdAt);
  }, [posts]);

  return { posts, setPosts, createPost, getPost, getAllPosts };
}
