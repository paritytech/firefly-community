'use client';

/**
 * OutletAllocationCard — Displays a funded outlet's allocation details.
 */

import type { ReactElement } from 'react';
import type { OutletAllocation } from '@cocuyo/types';

interface OutletAllocationCardTranslations {
  weight: string;
  distributed: string;
}

export interface OutletAllocationCardProps {
  outlet: OutletAllocation;
  translations: OutletAllocationCardTranslations;
}

export function OutletAllocationCard({
  outlet,
  translations: t,
}: OutletAllocationCardProps): ReactElement {
  // Weight is in basis points (10000 = 100%)
  const weightPercent = (outlet.weight / 100).toFixed(1);

  // Format distributed amount (pUSD has 6 decimals)
  const formattedDistributed = (Number(outlet.totalDistributed) / 1e6).toFixed(2);

  return (
    <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4">
      <div className="mb-3 flex items-start justify-between">
        <h3 className="font-medium text-[var(--fg-primary)]">{outlet.name}</h3>
        {outlet.isActive && (
          <span className="inline-flex h-2 w-2 rounded-full bg-[var(--fg-success)]" />
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-[var(--fg-tertiary)]">{t.weight}</span>
          <span className="font-medium text-[var(--fg-primary)]">{weightPercent}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--fg-tertiary)]">{t.distributed}</span>
          <span className="text-[var(--fg-success)]">${formattedDistributed}</span>
        </div>
      </div>

      {/* Weight bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface-container)]">
        <div
          className="h-full rounded-full bg-[var(--color-firefly-gold)]"
          style={{ width: `${weightPercent}%` }}
        />
      </div>
    </div>
  );
}
