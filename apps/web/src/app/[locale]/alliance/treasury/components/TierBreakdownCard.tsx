'use client';

/**
 * TierBreakdownCard — Displays contributor breakdown by tier.
 */

import type { ReactElement } from 'react';
import type { ContributorTier } from '@cocuyo/types';

interface TierBreakdownCardTranslations {
  title: string;
  spark: string;
  flame: string;
  beacon: string;
  lighthouse: string;
}

export interface TierBreakdownCardProps {
  contributorsByTier: Record<ContributorTier, number>;
  translations: TierBreakdownCardTranslations;
}

const TIER_COLORS: Record<ContributorTier, string> = {
  none: 'bg-[var(--fg-tertiary)]',
  spark: 'bg-amber-400',
  flame: 'bg-orange-400',
  beacon: 'bg-[var(--color-firefly-gold)]',
  lighthouse: 'bg-yellow-300',
};

export function TierBreakdownCard({
  contributorsByTier,
  translations: t,
}: TierBreakdownCardProps): ReactElement {
  const tiers: Array<{ key: ContributorTier; label: string }> = [
    { key: 'spark', label: t.spark },
    { key: 'flame', label: t.flame },
    { key: 'beacon', label: t.beacon },
    { key: 'lighthouse', label: t.lighthouse },
  ];

  const total = tiers.reduce((sum, tier) => sum + (contributorsByTier[tier.key] || 0), 0);

  return (
    <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
      <h3 className="mb-4 font-medium text-[var(--fg-primary)]">{t.title}</h3>

      {/* Stacked bar */}
      <div className="mb-4 flex h-4 overflow-hidden rounded-full bg-[var(--bg-surface-container)]">
        {tiers.map((tier) => {
          const count = contributorsByTier[tier.key] || 0;
          const percent = total > 0 ? (count / total) * 100 : 0;
          if (percent === 0) return null;

          return (
            <div
              key={tier.key}
              className={`${TIER_COLORS[tier.key]} transition-all`}
              style={{ width: `${percent}%` }}
              title={`${tier.label}: ${count}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {tiers.map((tier) => {
          const count = contributorsByTier[tier.key] || 0;
          return (
            <div key={tier.key} className="flex items-center gap-2 text-sm">
              <span className={`h-3 w-3 rounded-full ${TIER_COLORS[tier.key]}`} />
              <span className="text-[var(--fg-secondary)]">{tier.label}</span>
              <span className="font-medium text-[var(--fg-primary)]">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
