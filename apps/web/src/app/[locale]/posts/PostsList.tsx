'use client';

/**
 * PostsList — Grid of post cards with loading state.
 */

import type { ReactElement } from 'react';
import type { PostPreview, PostId } from '@cocuyo/types';
import { PostCard, EmptyState, SkeletonPostCard } from '@cocuyo/ui';

interface PostsListTranslations {
  corroborationWord: string;
  corroborationsWord: string;
  challengeWord: string;
  challengesWord: string;
  readMore: string;
}

export interface PostsListProps {
  /** Posts to display */
  posts: readonly PostPreview[];
  /** Topic slug to translated name map */
  topicTranslations: Record<string, string>;
  /** Whether there are more posts to load */
  hasMore: boolean;
  /** Whether filters are active */
  isFiltered: boolean;
  /** Whether loading */
  isLoading?: boolean;
  /** Callback when a post card is clicked */
  onPostClick: (postId: PostId) => void;
  /** Translation strings */
  translations: PostsListTranslations;
}

export function PostsList({
  posts,
  topicTranslations,
  hasMore: _hasMore,
  isFiltered,
  isLoading = false,
  onPostClick,
  translations: t,
}: PostsListProps): ReactElement {
  // Show loading skeletons
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonPostCard key={i} />
        ))}
      </div>
    );
  }

  const isEmpty = posts.length === 0;

  if (isEmpty) {
    return (
      <div className="py-12">
        <EmptyState
          title={isFiltered ? 'No matching posts' : 'No posts yet'}
          description={
            isFiltered
              ? 'Try adjusting your filters or search query.'
              : 'Be the first to share your insights with the network.'
          }
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onClick={onPostClick}
          topicTranslations={topicTranslations}
          translations={{
            corroborationWord: t.corroborationWord,
            corroborationsWord: t.corroborationsWord,
            challengeWord: t.challengeWord,
            challengesWord: t.challengesWord,
            readMore: t.readMore,
          }}
        />
      ))}
    </div>
  );
}
