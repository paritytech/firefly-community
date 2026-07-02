'use client';

/**
 * TierBadge — Displays a contributor tier with visual styling.
 *
 * Each tier has a distinct color scheme that reflects its level.
 */

import type { ReactElement } from 'react';
import type { ContributorTier } from '@cocuyo/types';

export interface TierBadgeProps {
  tier: ContributorTier;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const TIER_COLORS: Record<ContributorTier, { bg: string; text: string; border: string }> = {
  none: {
    bg: 'bg-[var(--bg-surface-container)]',
    text: 'text-[var(--fg-tertiary)]',
    border: 'border-[var(--border-default)]',
  },
  spark: {
    bg: 'bg-amber-900/20',
    text: 'text-amber-400',
    border: 'border-amber-400/30',
  },
  flame: {
    bg: 'bg-orange-900/20',
    text: 'text-orange-400',
    border: 'border-orange-400/30',
  },
  beacon: {
    bg: 'bg-[var(--color-firefly-gold)]/20',
    text: 'text-[var(--color-firefly-gold)]',
    border: 'border-[var(--color-firefly-gold)]/30',
  },
  lighthouse: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-300',
    border: 'border-yellow-400/30',
  },
};

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

export function TierBadge({ tier, name, size = 'md' }: TierBadgeProps): ReactElement {
  const colors = TIER_COLORS[tier];
  const sizeClass = SIZE_CLASSES[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${colors.bg} ${colors.text} ${colors.border} ${sizeClass}`}
    >
      {/* Tier icon - firefly/spark symbol */}
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="3" />
        {tier !== 'none' && (
          <>
            <circle cx="12" cy="5" r="1.5" opacity="0.6" />
            <circle cx="12" cy="19" r="1.5" opacity="0.6" />
            <circle cx="5" cy="12" r="1.5" opacity="0.6" />
            <circle cx="19" cy="12" r="1.5" opacity="0.6" />
          </>
        )}
        {(tier === 'beacon' || tier === 'lighthouse') && (
          <>
            <circle cx="7" cy="7" r="1" opacity="0.4" />
            <circle cx="17" cy="7" r="1" opacity="0.4" />
            <circle cx="7" cy="17" r="1" opacity="0.4" />
            <circle cx="17" cy="17" r="1" opacity="0.4" />
          </>
        )}
      </svg>
      {name}
    </span>
  );
}
