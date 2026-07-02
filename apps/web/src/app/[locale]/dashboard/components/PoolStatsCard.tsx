'use client';

/**
 * PoolStatsCard — Displays pool-wide statistics.
 */

import type { ReactElement } from 'react';
import type { PoolStats } from '@cocuyo/types';

interface PoolStatsCardTranslations {
  title: string;
  tvl: string;
  contributors: string;
  outlets: string;
  distributed: string;
}

export interface PoolStatsCardProps {
  stats: PoolStats;
  translations: PoolStatsCardTranslations;
}

export function PoolStatsCard({ stats, translations: t }: PoolStatsCardProps): ReactElement {
  // Format TVL (pUSD has 6 decimals)
  const formattedTvl = (Number(stats.tvl) / 1e6).toFixed(2);

  // Format distributed (pUSD has 6 decimals)
  const formattedDistributed = (Number(stats.totalDistributed) / 1e6).toFixed(2);

  return (
    <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
      <h2 className="mb-6 text-lg font-medium text-[var(--fg-primary)]">{t.title}</h2>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* TVL */}
        <div className="text-center">
          <p className="mb-1 text-sm text-[var(--fg-tertiary)]">{t.tvl}</p>
          <p className="font-display text-2xl font-medium text-[var(--color-firefly-gold)]">
            ${formattedTvl}
          </p>
        </div>

        {/* Contributors */}
        <div className="text-center">
          <p className="mb-1 text-sm text-[var(--fg-tertiary)]">{t.contributors}</p>
          <p className="font-display text-2xl font-medium text-[var(--fg-primary)]">
            {stats.activeContributors}
          </p>
        </div>

        {/* Funded Outlets */}
        <div className="text-center">
          <p className="mb-1 text-sm text-[var(--fg-tertiary)]">{t.outlets}</p>
          <p className="font-display text-2xl font-medium text-[var(--fg-primary)]">
            {stats.fundedOutlets}
          </p>
        </div>

        {/* Total Distributed */}
        <div className="text-center">
          <p className="mb-1 text-sm text-[var(--fg-tertiary)]">{t.distributed}</p>
          <p className="font-display text-2xl font-medium text-[var(--fg-success)]">
            ${formattedDistributed}
          </p>
        </div>
      </div>
    </div>
  );
}
