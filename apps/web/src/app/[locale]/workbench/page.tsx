/**
 * Verification Workbench page — Collective members review pending claims.
 *
 * Access is restricted to collective members only.
 */

import type { ReactElement } from 'react';
import { claimService } from '@/lib/services/claim-service';
import { WorkbenchView } from './WorkbenchView';
import { WorkbenchHeader } from './WorkbenchHeader';
import { getTranslations, setRequestLocale } from 'next-intl/server';

interface WorkbenchPageProps {
  params: Promise<{ locale: string }>;
}

export default async function WorkbenchPage({ params }: WorkbenchPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const tWorkbench = await getTranslations('workbench');
  const tClaims = await getTranslations('claims');
  const tPosts = await getTranslations('posts');

  // Get pending claims for review
  const pendingClaimsResult = await claimService.getPendingClaims({
    pagination: { limit: 50, offset: 0 },
    locale: locale as 'en' | 'es',
  });

  // Extract unique topics from claims
  const allTopics = Array.from(
    new Set(pendingClaimsResult.items.flatMap((c) => [...c.topics]))
  ).sort();

  // Build topic translation map
  const topicTranslations: Record<string, string> = {};
  for (const topic of allTopics) {
    try {
      topicTranslations[topic] = tPosts(`topics.${topic}`);
    } catch {
      topicTranslations[topic] = topic.replace(/-/g, ' ');
    }
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <WorkbenchHeader title={tWorkbench('title')} description={tWorkbench('description')} />

      {/* Main content */}
      <section className="py-6">
        <div className="container-wide">
          <WorkbenchView
            claims={[...pendingClaimsResult.items]}
            topics={allTopics}
            topicTranslations={topicTranslations}
            hasMore={pendingClaimsResult.hasMore}
            translations={{
              all: tWorkbench('allClaims'),
              filterByTopic: tWorkbench('filterByTopic'),
              filterByStatus: tWorkbench('filterByStatus'),
              searchPlaceholder: tWorkbench('searchPlaceholder'),
              topicSelected: tWorkbench('topicSelected'),
              topicsSelected: tWorkbench('topicsSelected'),
              claimWord: tWorkbench('claimWord'),
              claimsWord: tWorkbench('claimsWord'),
              ofWord: tWorkbench('ofWord'),
              clearFilters: tWorkbench('clearFilters'),
              pending: tClaims('statusPending'),
              underReview: tClaims('statusUnderReview'),
              noClaims: tWorkbench('noClaims'),
              noClaimsDescription: tWorkbench('noClaimsDescription'),
              // ClaimCard translations
              supporting: tClaims('supporting'),
              contradicting: tClaims('contradicting'),
              evidence: tClaims('evidence'),
              viewClaim: tClaims('viewClaim'),
              statusPending: tClaims('statusPending'),
              statusUnderReview: tClaims('statusUnderReview'),
              statusVerified: tClaims('statusVerified'),
              statusDisputed: tClaims('statusDisputed'),
              statusFalse: tClaims('statusFalse'),
              statusUnverifiable: tClaims('statusUnverifiable'),
            }}
          />
        </div>
      </section>
    </main>
  );
}
