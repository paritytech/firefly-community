'use client';

/**
 * WorkbenchView — Main client component for the verification workbench.
 *
 * Displays pending claims for connected users to review.
 * Access gating: requires wallet connection (collective membership check removed).
 */

import { useState, useMemo, useCallback, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import type { ClaimPreview, ClaimId, ClaimStatus } from '@cocuyo/types';
import { useSigner } from '@/hooks';
import { WorkbenchFilters } from './WorkbenchFilters';
import { WorkbenchList } from './WorkbenchList';
import { WorkbenchAccessGate } from './WorkbenchAccessGate';

export interface WorkbenchViewProps {
  /** Pending claims */
  claims: ClaimPreview[];
  /** Available topics for filtering */
  topics: readonly string[];
  /** Topic slug to translated name map */
  topicTranslations: Record<string, string>;
  /** Whether there are more claims to load */
  hasMore: boolean;
  /** Translation strings */
  translations: {
    all: string;
    filterByTopic: string;
    filterByStatus: string;
    searchPlaceholder: string;
    topicSelected: string;
    topicsSelected: string;
    claimWord: string;
    claimsWord: string;
    ofWord: string;
    clearFilters: string;
    pending: string;
    underReview: string;
    noClaims: string;
    noClaimsDescription: string;
    // ClaimCard translations
    supporting: string;
    contradicting: string;
    evidence: string;
    viewClaim: string;
    statusPending: string;
    statusUnderReview: string;
    statusVerified: string;
    statusDisputed: string;
    statusFalse: string;
    statusUnverifiable: string;
  };
}

export function WorkbenchView({
  claims,
  topics,
  topicTranslations,
  hasMore,
  translations: t,
}: WorkbenchViewProps): ReactElement {
  const router = useRouter();
  const locale = useLocale();
  const { isConnected } = useSigner();

  // Filter state
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | null>(null);
  const [topicFilters, setTopicFilters] = useState<readonly string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Handle claim card click - navigate to detail page
  const handleClaimClick = useCallback(
    (claimId: ClaimId) => {
      router.push(`/${locale}/claim/${claimId}`);
    },
    [router, locale]
  );

  // Filter claims based on active filters
  const filteredClaims = useMemo(() => {
    let result = claims;

    // Status filter
    if (statusFilter !== null) {
      result = result.filter((c) => c.status === statusFilter);
    }

    // Topic filters (OR logic - matches any selected topic)
    if (topicFilters.length > 0) {
      result = result.filter((c) =>
        c.topics.some((topic) =>
          topicFilters.some((filter) => topic.toLowerCase() === filter.toLowerCase())
        )
      );
    }

    // Search filter
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.statement.toLowerCase().includes(query) ||
          c.topics.some((topic) => topic.toLowerCase().includes(query))
      );
    }

    return result;
  }, [claims, statusFilter, topicFilters, searchQuery]);

  const isFiltered = statusFilter !== null || topicFilters.length > 0 || searchQuery.length > 0;

  // Access gate: require wallet connection only (collective membership check removed)
  if (!isConnected) {
    return <WorkbenchAccessGate />;
  }

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <WorkbenchFilters
        topics={topics}
        topicTranslations={topicTranslations}
        activeStatus={statusFilter}
        activeTopics={topicFilters}
        searchQuery={searchQuery}
        onStatusChange={setStatusFilter}
        onTopicsChange={setTopicFilters}
        onSearchChange={setSearchQuery}
        totalCount={claims.length}
        filteredCount={filteredClaims.length}
        translations={{
          all: t.all,
          filterByTopic: t.filterByTopic,
          filterByStatus: t.filterByStatus,
          searchPlaceholder: t.searchPlaceholder,
          topicSelected: t.topicSelected,
          topicsSelected: t.topicsSelected,
          claimWord: t.claimWord,
          claimsWord: t.claimsWord,
          ofWord: t.ofWord,
          clearFilters: t.clearFilters,
          pending: t.pending,
          underReview: t.underReview,
        }}
      />

      {/* Claim cards */}
      <WorkbenchList
        claims={filteredClaims}
        topicTranslations={topicTranslations}
        hasMore={hasMore && !isFiltered}
        isFiltered={isFiltered}
        onClaimClick={handleClaimClick}
        translations={{
          noClaims: t.noClaims,
          noClaimsDescription: t.noClaimsDescription,
          supporting: t.supporting,
          contradicting: t.contradicting,
          evidence: t.evidence,
          viewClaim: t.viewClaim,
          statusPending: t.statusPending,
          statusUnderReview: t.statusUnderReview,
          statusVerified: t.statusVerified,
          statusDisputed: t.statusDisputed,
          statusFalse: t.statusFalse,
          statusUnverifiable: t.statusUnverifiable,
        }}
      />
    </div>
  );
}
