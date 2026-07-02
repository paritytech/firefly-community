'use client';

/**
 * FactCheckerBadge — Shows fact-checker verification status.
 *
 * Displays a badge indicating whether the user is a verified fact-checker.
 * Status is derived from collective membership and verification count.
 */

import type { ReactElement } from 'react';
import type { FactCheckerStatus } from '@cocuyo/types';

/** Translation labels for fact-checker status */
export interface FactCheckerBadgeLabels {
  verified: string;
  suspended: string;
}

export interface FactCheckerBadgeProps {
  /** The fact-checker status to display */
  status: FactCheckerStatus;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Optional custom labels for translation */
  labels?: FactCheckerBadgeLabels;
}

interface BadgeConfig {
  icon: string;
  label: string;
  colorClass: string;
  bgClass: string;
}

const DEFAULT_LABELS: FactCheckerBadgeLabels = {
  verified: 'Verified Fact-Checker',
  suspended: 'Suspended',
};

function getBadgeConfig(
  status: FactCheckerStatus,
  labels: FactCheckerBadgeLabels
): BadgeConfig | null {
  switch (status) {
    case 'verified':
      return {
        icon: '✓',
        label: labels.verified,
        colorClass: 'text-[var(--color-firefly-gold)]',
        bgClass: 'bg-[var(--color-firefly-gold)]/10',
      };
    case 'suspended':
      return {
        icon: '⊘',
        label: labels.suspended,
        colorClass: 'text-[var(--fg-error)]',
        bgClass: 'bg-[var(--fg-error)]/10',
      };
    case 'none':
    default:
      return null; // Don't render anything for 'none'
  }
}

export function FactCheckerBadge({
  status,
  size = 'sm',
  labels = DEFAULT_LABELS,
}: FactCheckerBadgeProps): ReactElement | null {
  const config = getBadgeConfig(status, labels);

  // Don't render anything if status is 'none'
  if (!config) {
    return null;
  }

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.bgClass} ${config.colorClass} ${sizeClasses}`}
      title={config.label}
      aria-label={config.label}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
