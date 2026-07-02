'use client';

/**
 * ClaimCard — Display component for a claim preview.
 *
 * The claim card shows key information at a glance:
 * - Status badge
 * - Claim statement (2-line truncate)
 * - Topics tags
 * - Evidence count (supporting/contradicting)
 */

import type { ReactElement } from 'react';
import type { ClaimPreview, ClaimId } from '@cocuyo/types';
import { ClaimStatusBadge } from '../ClaimStatusBadge';
import type { ClaimStatusTranslations } from '../ClaimStatusBadge';

export interface ClaimCardTranslations {
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

export interface ClaimCardProps {
  /** The claim preview to display */
  claim: ClaimPreview;
  /** Callback when the card is clicked */
  onClick?: (claimId: ClaimId) => void;
  /** Translation strings */
  translations?: ClaimCardTranslations;
  /** Topic slug to translated name map */
  topicTranslations?: Record<string, string>;
}

/**
 * Format relative time.
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) {
    return minutes <= 1 ? 'just now' : `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(timestamp).toLocaleDateString();
}

export function ClaimCard({
  claim,
  onClick,
  translations: t,
  topicTranslations,
}: ClaimCardProps): ReactElement {
  const { id, statement, status, topics, supportingCount, contradictingCount, createdAt } = claim;

  const handleClick = (): void => {
    onClick?.(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(id);
    }
  };

  const statusTranslations: ClaimStatusTranslations | undefined =
    t !== undefined
      ? {
          pending: t.statusPending,
          under_review: t.statusUnderReview,
          verified: t.statusVerified,
          disputed: t.statusDisputed,
          false: t.statusFalse,
          unverifiable: t.statusUnverifiable,
        }
      : undefined;

  return (
    <article
      className={`rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4 transition-all duration-200 ease-out ${onClick !== undefined ? 'cursor-pointer hover:-translate-y-0.5 hover:border-[var(--color-firefly-gold)]/40 hover:shadow-[0_4px_20px_rgba(232,185,49,0.08)] active:translate-y-0 active:shadow-none' : ''} `}
      onClick={onClick !== undefined ? handleClick : undefined}
      onKeyDown={onClick !== undefined ? handleKeyDown : undefined}
      tabIndex={onClick !== undefined ? 0 : undefined}
      role={onClick !== undefined ? 'button' : undefined}
      aria-label={`Claim: ${statement}`}
    >
      {/* Status badge row */}
      <div className="mb-3 flex items-center justify-between">
        <ClaimStatusBadge status={status} translations={statusTranslations} />
        <span className="text-xs text-[var(--fg-tertiary)]">{formatRelativeTime(createdAt)}</span>
      </div>

      {/* Statement - 2 line truncate */}
      <p className="mb-3 line-clamp-2 text-sm leading-snug font-medium text-[var(--fg-primary)]">
        &ldquo;{statement}&rdquo;
      </p>

      {/* Topics tags */}
      {topics.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {topics.slice(0, 3).map((topic) => (
            <span
              key={topic}
              className="rounded-full bg-[var(--bg-surface-container)] px-1.5 py-0.5 text-xs text-[var(--fg-tertiary)]"
            >
              {topicTranslations?.[topic] ?? topic.replace(/-/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {/* Evidence count */}
      <div className="flex items-center gap-3 border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--fg-secondary)]">
        {supportingCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="text-[var(--fg-success)]">+{supportingCount}</span>
            <span>{t?.supporting ?? 'supporting'}</span>
          </span>
        )}
        {contradictingCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="text-[var(--fg-error)]">-{contradictingCount}</span>
            <span>{t?.contradicting ?? 'contradicting'}</span>
          </span>
        )}
        {supportingCount === 0 && contradictingCount === 0 && (
          <span className="text-[var(--fg-tertiary)]">No {t?.evidence ?? 'evidence'} yet</span>
        )}
      </div>
    </article>
  );
}
