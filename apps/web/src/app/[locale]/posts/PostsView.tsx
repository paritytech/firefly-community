'use client';

/**
 * PostsView — Main client component for the posts page.
 *
 * Clean layout with filter bar above post cards.
 */

import { useState, useMemo, useCallback, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import type { PostPreview, PostId } from '@cocuyo/types';
import { PostFilters } from './PostFilters';
import { PostsList } from './PostsList';
import { IlluminateFAB } from '@/components/IlluminateFAB';

export interface PostsViewProps {
  /** Available posts */
  posts: PostPreview[];
  /** Available topics for filtering */
  topics: readonly string[];
  /** Topic slug to translated name map */
  topicTranslations: Record<string, string>;
  /** Whether there are more posts to load */
  hasMore: boolean;
  /** Translation strings */
  translations: {
    all: string;
    filterByTopic: string;
    searchPlaceholder: string;
    topicSelected: string;
    topicsSelected: string;
    postWord: string;
    postsWord: string;
    ofWord: string;
    clearFilters: string;
    corroborationWord: string;
    corroborationsWord: string;
    challengeWord: string;
    challengesWord: string;
    readMore: string;
  };
}

export function PostsView({
  posts,
  topics,
  topicTranslations,
  hasMore,
  translations: t,
}: PostsViewProps): ReactElement {
  const router = useRouter();
  const locale = useLocale();

  // Filter state
  const [topicFilters, setTopicFilters] = useState<readonly string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Handle post card click - navigate to detail page
  const handlePostClick = useCallback(
    (postId: PostId) => {
      router.push(`/${locale}/post/${postId}`);
    },
    [router, locale]
  );

  // Filter posts based on active filters
  const filteredPosts = useMemo(() => {
    let result = posts;

    // Topic filters (OR logic - matches any selected topic)
    if (topicFilters.length > 0) {
      result = result.filter((p) =>
        p.topics.some((topic) =>
          topicFilters.some((filter) => topic.toLowerCase() === filter.toLowerCase())
        )
      );
    }

    // Search filter
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (p) =>
          (p.title?.toLowerCase().includes(query) ?? false) ||
          p.excerpt.toLowerCase().includes(query) ||
          p.topics.some((topic) => topic.toLowerCase().includes(query)) ||
          (p.locationName?.toLowerCase().includes(query) ?? false)
      );
    }

    return result;
  }, [posts, topicFilters, searchQuery]);

  const isFiltered = topicFilters.length > 0 || searchQuery.length > 0;

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <PostFilters
        topics={topics}
        topicTranslations={topicTranslations}
        activeTopics={topicFilters}
        searchQuery={searchQuery}
        onTopicsChange={setTopicFilters}
        onSearchChange={setSearchQuery}
        totalCount={posts.length}
        filteredCount={filteredPosts.length}
        translations={{
          all: t.all,
          filterByTopic: t.filterByTopic,
          searchPlaceholder: t.searchPlaceholder,
          topicSelected: t.topicSelected,
          topicsSelected: t.topicsSelected,
          postWord: t.postWord,
          postsWord: t.postsWord,
          ofWord: t.ofWord,
          clearFilters: t.clearFilters,
        }}
      />

      {/* Post cards */}
      <PostsList
        posts={filteredPosts}
        topicTranslations={topicTranslations}
        hasMore={hasMore && !isFiltered}
        isFiltered={isFiltered}
        onPostClick={handlePostClick}
        translations={{
          corroborationWord: t.corroborationWord,
          corroborationsWord: t.corroborationsWord,
          challengeWord: t.challengeWord,
          challengesWord: t.challengesWord,
          readMore: t.readMore,
        }}
      />

      {/* Floating action button */}
      <IlluminateFAB />
    </div>
  );
}
