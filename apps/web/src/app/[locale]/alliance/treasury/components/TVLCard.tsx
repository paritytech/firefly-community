'use client';

/**
 * TVLCard — Displays Total Value Locked in the treasury.
 */

import type { ReactElement } from 'react';
import type { PUSDAmount } from '@cocuyo/types';

export interface TVLCardProps {
  value: PUSDAmount;
  label: string;
}

export function TVLCard({ value, label }: TVLCardProps): ReactElement {
  // Format value (pUSD has 6 decimals)
  const formattedValue = (Number(value) / 1e6).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="border-[var(--color-firefly-gold)]/30 bg-[var(--color-firefly-gold)]/5 rounded-container border p-6 text-center">
      <p className="mb-2 text-sm text-[var(--fg-secondary)]">{label}</p>
      <p className="font-display text-4xl font-bold text-[var(--color-firefly-gold)]">
        ${formattedValue}
      </p>
    </div>
  );
}
