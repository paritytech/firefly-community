'use client';

/**
 * ClaimStatusBadge — Shows the verification status of a claim.
 *
 * Visual indicator showing whether a claim is pending, under review,
 * verified, disputed, false, or unverifiable. Color-coded for quick scanning.
 */

import type { ReactElement } from 'react';
import type { ClaimStatus } from '@cocuyo/types';

export interface ClaimStatusTranslations {
  pending: string;
  under_review: string;
  verified: string;
  disputed: string;
  false: string;
  unverifiable: string;
}

export interface ClaimStatusBadgeProps {
  /** The claim status to display */
  status: ClaimStatus;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Show label text alongside icon */
  showLabel?: boolean;
  /** Translation strings */
  translations?: ClaimStatusTranslations | undefined;
}

interface BadgeConfig {
  icon: string;
  label: string;
  colorClass: string;
  bgClass: string;
}

const defaultLabels: Record<ClaimStatus, string> = {
  pending: 'Pending',
  under_review: 'Under Review',
  verified: 'Verified',
  disputed: 'Disputed',
  false: 'False',
  unverifiable: 'Unverifiable',
};

function getBadgeConfig(status: ClaimStatus, translations?: ClaimStatusTranslations): BadgeConfig {
  const label = translations?.[status] ?? defaultLabels[status];

  switch (status) {
    case 'pending':
      return {
        icon: '○',
        label,
        colorClass: 'text-[var(--fg-secondary)]',
        bgClass: 'bg-[var(--bg-surface-nested)]',
      };
    case 'under_review':
      return {
        icon: '◐',
        label,
        colorClass: 'text-[var(--color-firefly-gold)]',
        bgClass: 'bg-[var(--color-firefly-gold)]/10',
      };
    case 'verified':
      return {
        icon: '✓',
        label,
        colorClass: 'text-[var(--fg-success)]',
        bgClass: 'bg-[var(--fg-success)]/10',
      };
    case 'disputed':
      return {
        icon: '⚡',
        label,
        colorClass: 'text-[var(--fg-warning)]',
        bgClass: 'bg-[var(--fg-warning)]/10',
      };
    case 'false':
      return {
        icon: '✕',
        label,
        colorClass: 'text-[var(--fg-error)]',
        bgClass: 'bg-[var(--fg-error)]/10',
      };
    case 'unverifiable':
      return {
        icon: '?',
        label,
        colorClass: 'text-[var(--fg-tertiary)]',
        bgClass: 'bg-[var(--bg-surface-nested)]',
      };
  }
}

export function ClaimStatusBadge({
  status,
  size = 'sm',
  showLabel = true,
  translations,
}: ClaimStatusBadgeProps): ReactElement {
  const config = getBadgeConfig(status, translations);

  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bgClass} ${config.colorClass} ${sizeClasses} `}
      title={config.label}
      aria-label={`Claim status: ${config.label}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
