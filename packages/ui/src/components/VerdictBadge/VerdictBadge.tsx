'use client';

/**
 * VerdictBadge — Display component for verdict status.
 *
 * Shows the verdict status with appropriate colors:
 * - Confirmed: gold (firefly gold)
 * - Disputed: amber/warning
 * - False: red
 * - Synthetic: orange
 * - Inconclusive: gray
 */

import type { ReactElement } from 'react';
import type { VerdictStatus } from '@cocuyo/types';

export interface VerdictBadgeProps {
  /** The verdict status to display */
  status: VerdictStatus;
  /** Whether to show the label text */
  showLabel?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
}

/** Display configuration for each verdict status */
const STATUS_CONFIG: Record<
  VerdictStatus,
  { label: string; icon: string; bgColor: string; textColor: string; borderColor: string }
> = {
  confirmed: {
    label: 'Verified',
    icon: '✓',
    bgColor: 'var(--color-firefly-gold)',
    textColor: 'var(--bg-primary)',
    borderColor: 'var(--color-firefly-gold)',
  },
  disputed: {
    label: 'Disputed',
    icon: '?',
    bgColor: 'color-mix(in srgb, var(--fg-warning) 15%, transparent)',
    textColor: 'var(--fg-warning)',
    borderColor: 'color-mix(in srgb, var(--fg-warning) 30%, transparent)',
  },
  false: {
    label: 'False',
    icon: '✗',
    bgColor: 'color-mix(in srgb, var(--fg-error) 15%, transparent)',
    textColor: 'var(--fg-error)',
    borderColor: 'color-mix(in srgb, var(--fg-error) 30%, transparent)',
  },
  synthetic: {
    label: 'Synthetic',
    icon: '⚡',
    bgColor: 'color-mix(in srgb, #f97316 15%, transparent)',
    textColor: '#f97316',
    borderColor: 'color-mix(in srgb, #f97316 30%, transparent)',
  },
  inconclusive: {
    label: 'Inconclusive',
    icon: '—',
    bgColor: 'color-mix(in srgb, var(--fg-tertiary) 15%, transparent)',
    textColor: 'var(--fg-tertiary)',
    borderColor: 'color-mix(in srgb, var(--fg-tertiary) 30%, transparent)',
  },
};

export function VerdictBadge({
  status,
  showLabel = true,
  size = 'md',
}: VerdictBadgeProps): ReactElement {
  const config = STATUS_CONFIG[status];

  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5 gap-1' : 'text-sm px-2 py-1 gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${sizeClasses} `}
      style={{
        backgroundColor: config.bgColor,
        color: config.textColor,
        borderColor: config.borderColor,
      }}
    >
      <span aria-hidden="true">{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
