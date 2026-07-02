/**
 * Posts page — Browse community posts.
 *
 * Clean layout with filter bar above post card grid.
 */

import type { ReactElement } from 'react';
import { postService } from '@/lib/services/service-instances';
import { PostsView } from './PostsView';
import { PostsHeader } from './PostsHeader';
import { getTranslations, setRequestLocale } from 'next-intl/server';

interface PostsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function PostsPage({ params }: PostsPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const tPosts = await getTranslations('posts');

  // Get all posts
  const postsResult = await postService.getAllPosts({
    pagination: { limit: 50, offset: 0 },
    locale: locale as 'en' | 'es',
  });

  // Extract unique topics from posts
  const allTopics = Array.from(new Set(postsResult.items.flatMap((p) => [...p.topics]))).sort();

  // Build topic translation map
  const topicTranslations: Record<string, string> = {};
  for (const topic of allTopics) {
    try {
      topicTranslations[topic] = tPosts(`topics.${topic}`);
    } catch {
      // Fallback to formatted slug if translation missing
      topicTranslations[topic] = topic.replace(/-/g, ' ');
    }
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <PostsHeader title={tPosts('title')} description={tPosts('description')} />

      {/* Main content */}
      <section className="py-6">
        <div className="container-wide">
          <PostsView
            posts={[...postsResult.items]}
            topics={allTopics}
            topicTranslations={topicTranslations}
            hasMore={postsResult.hasMore}
            translations={{
              all: tPosts('allPosts'),
              filterByTopic: tPosts('filterByTopic'),
              searchPlaceholder: tPosts('searchPlaceholder'),
              topicSelected: tPosts('topicSelected'),
              topicsSelected: tPosts('topicsSelected'),
              postWord: tPosts('postWord'),
              postsWord: tPosts('postsWord'),
              ofWord: tPosts('ofWord'),
              clearFilters: tPosts('clearFilters'),
              corroborationWord: tPosts('corroborationWord'),
              corroborationsWord: tPosts('corroborationsWord'),
              challengeWord: tPosts('challengeWord'),
              challengesWord: tPosts('challengesWord'),
              readMore: tPosts('readMore'),
            }}
          />
        </div>
      </section>
    </main>
  );
}
