'use client';

/**
 * WorkbenchList — Grid of claim cards for review with loading state.
 */

import type { ReactElement } from 'react';
import type { ClaimPreview, ClaimId } from '@cocuyo/types';
import { ClaimCard, EmptyState, SkeletonClaimCard } from '@cocuyo/ui';

interface WorkbenchListTranslations {
  noClaims: string;
  noClaimsDescription: string;
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
}

export interface WorkbenchListProps {
  /** Claims to display */
  claims: readonly ClaimPreview[];
  /** Topic slug to translated name map */
  topicTranslations: Record<string, string>;
  /** Whether there are more claims to load */
  hasMore: boolean;
  /** Whether filters are active */
  isFiltered: boolean;
  /** Whether loading */
  isLoading?: boolean;
  /** Callback when a claim card is clicked */
  onClaimClick: (claimId: ClaimId) => void;
  /** Translation strings */
  translations: WorkbenchListTranslations;
}

export function WorkbenchList({
  claims,
  topicTranslations,
  hasMore: _hasMore,
  isFiltered,
  isLoading = false,
  onClaimClick,
  translations: t,
}: WorkbenchListProps): ReactElement {
  // Show loading skeletons
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonClaimCard key={i} />
        ))}
      </div>
    );
  }

  const isEmpty = claims.length === 0;

  if (isEmpty) {
    return (
      <div className="py-12">
        <EmptyState
          title={isFiltered ? 'No matching claims' : t.noClaims}
          description={
            isFiltered ? 'Try adjusting your filters or search query.' : t.noClaimsDescription
          }
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {claims.map((claim) => (
        <ClaimCard
          key={claim.id}
          claim={claim}
          onClick={onClaimClick}
          topicTranslations={topicTranslations}
          translations={{
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
      ))}
    </div>
  );
}
