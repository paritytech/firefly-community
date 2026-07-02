'use client';

/**
 * PositionCard — Displays the contributor's current position details.
 */

import type { ReactElement } from 'react';
import type { ContributorPosition } from '@cocuyo/types';
import { TierBadge } from '../../join/components/TierBadge';

interface PositionCardTranslations {
  title: string;
  shares: string;
  value: string;
  contributed: string;
  tier: string;
}

export interface PositionCardProps {
  position: ContributorPosition;
  currentValue: bigint;
  translations: PositionCardTranslations;
  tierName: string;
}

export function PositionCard({
  position,
  currentValue,
  translations: t,
  tierName,
}: PositionCardProps): ReactElement {
  // Format share count (shares use 18 decimals)
  const formattedShares = (Number(position.shares) / 1e18).toFixed(4);

  // Format value (pUSD has 6 decimals)
  const formattedValue = (Number(currentValue) / 1e6).toFixed(2);

  // Format cumulative contributed (pUSD has 6 decimals)
  const formattedContributed = (Number(position.cumulativeContributed) / 1e6).toFixed(2);

  return (
    <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
      <h2 className="mb-6 text-lg font-medium text-[var(--fg-primary)]">{t.title}</h2>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Shares */}
        <div>
          <p className="mb-1 text-sm text-[var(--fg-tertiary)]">{t.shares}</p>
          <p className="font-mono text-2xl font-medium text-[var(--fg-primary)]">
            {formattedShares}
          </p>
        </div>

        {/* Current Value */}
        <div>
          <p className="mb-1 text-sm text-[var(--fg-tertiary)]">{t.value}</p>
          <p className="text-2xl font-medium text-[var(--color-firefly-gold)]">${formattedValue}</p>
        </div>

        {/* Total Contributed */}
        <div>
          <p className="mb-1 text-sm text-[var(--fg-tertiary)]">{t.contributed}</p>
          <p className="text-lg text-[var(--fg-secondary)]">${formattedContributed}</p>
        </div>

        {/* Tier */}
        <div>
          <p className="mb-1 text-sm text-[var(--fg-tertiary)]">{t.tier}</p>
          <TierBadge tier={position.tier} name={tierName} size="md" />
        </div>
      </div>
    </div>
  );
}
