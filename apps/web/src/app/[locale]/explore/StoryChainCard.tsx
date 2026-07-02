'use client';

/**
 * StoryChainCard — compact card for a story chain in the Explore grid.
 *
 * No design-system component exists for chains yet, so this is custom markup
 * built on the DS tokens. Candidate for promotion into `@cocuyo/ui` as a
 * reusable `StoryChainCard` (see design handoff follow-ups).
 */

import type { ReactElement } from 'react';
import type { ChainPreview, ChainStatus, ChainId } from '@cocuyo/types';
import { VerificationBadge, type VerificationBadgeProps } from '@cocuyo/ui';

/** Map a ChainStatus onto the VerificationBadge status vocabulary. */
export function toBadgeStatus(status: ChainStatus): VerificationBadgeProps['status'] {
  switch (status) {
    case 'established':
      return 'verified';
    case 'contested':
      return 'disputed';
    case 'active':
      return 'in_review';
    case 'emerging':
    default:
      return 'pending';
  }
}

export interface StoryChainCardProps {
  chain: ChainPreview;
  /** Translated topic label for the lead topic. */
  topicLabel: string;
  /** Translated "STORY CHAIN" eyebrow + meta strings. */
  labels: {
    eyebrow: string;
    signals: string;
    corroborations: string;
    updated: string;
  };
  /** Relative-time string for `updatedAt` (already localized). */
  updatedLabel: string;
  onClick: (chainId: ChainId) => void;
}

export function StoryChainCard({
  chain,
  topicLabel,
  labels,
  updatedLabel,
  onClick,
}: StoryChainCardProps): ReactElement {
  return (
    <button
      type="button"
      onClick={() => onClick(chain.id)}
      className="group flex w-full flex-col gap-3 rounded-[var(--radius-container)] border border-[var(--border-subtle)] bg-[var(--bg-surface-container)] p-6 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--border-emphasis)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-xs uppercase tracking-wider text-[var(--fg-accent)]">
          {labels.eyebrow} · {topicLabel}
        </span>
        <VerificationBadge status={toBadgeStatus(chain.status)} size="sm" />
      </div>

      <h3 className="font-display text-xl leading-tight text-[var(--fg-primary)]">{chain.title}</h3>

      {/* Signal trail divider */}
      <div
        className="h-0.5 w-full rounded-full"
        style={{ background: 'linear-gradient(90deg, var(--border-default), var(--fg-accent))' }}
        aria-hidden="true"
      />

      <span className="font-mono text-xs text-[var(--fg-tertiary)]">
        {chain.postCount} {labels.signals} · {chain.corroborationCount} {labels.corroborations} ·{' '}
        {labels.updated} {updatedLabel}
      </span>
    </button>
  );
}
