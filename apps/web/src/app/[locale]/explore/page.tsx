/**
 * Explore page — the discovery surface for the Firefly Network.
 *
 * Browse signals, claims, and story chains with topic filters, search, and
 * sort. Server component: fetches the server-available data (signals, chains,
 * collectives) and hands it to the interactive ExploreExperience client
 * component, which additionally loads browser-stored claims client-side.
 * Navbar/Footer come from the [locale] layout.
 */

import type { ReactElement } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { chainService, signalService } from '@/lib/services/service-instances';
import { getActiveCollectives } from '@/lib/services/collective-service';
import { ExploreExperience } from './ExploreExperience';
import { IlluminateFAB } from '@/components/IlluminateFAB';

interface ExplorePageProps {
  params: Promise<{ locale: string }>;
}

export default async function ExplorePage({ params }: ExplorePageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);

  const [chains, recentPosts] = await Promise.all([
    chainService.getFeaturedChains(locale),
    signalService.getRecentPostsForDisplay({ pagination: { limit: 30, offset: 0 }, locale }),
  ]);
  const collectives = getActiveCollectives();

  return (
    <main className="min-h-screen py-6">
      <ExploreExperience signals={recentPosts.items} chains={chains} collectives={collectives} />
      <IlluminateFAB variant="mobile" requireConnected={false} />
    </main>
  );
}
