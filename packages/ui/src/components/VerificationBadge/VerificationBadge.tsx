'use client';

/**
 * VerificationBadge — Shows the verification status of a signal.
 *
 * Visual indicator showing whether content has been verified by
 * a collective, is disputed, or unverified. Color-coded for
 * quick scanning.
 */

import type { ReactElement } from 'react';
import type { VerificationStatus } from '@cocuyo/types';

export interface VerificationBadgeProps {
  /** The verification status to display */
  status: VerificationStatus;
  /** Optional collective name that verified */
  collectiveName?: string;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Show label text alongside icon */
  showLabel?: boolean;
}

interface BadgeConfig {
  icon: string;
  label: string;
  colorClass: string;
  bgClass: string;
}

function getBadgeConfig(status: VerificationStatus): BadgeConfig {
  switch (status) {
    case 'verified':
      return {
        icon: '✓',
        label: 'Verified',
        colorClass: 'text-[var(--fg-success)]',
        bgClass: 'bg-[var(--fg-success)]/10',
      };
    case 'disputed':
      return {
        icon: '!',
        label: 'Disputed',
        colorClass: 'text-[var(--fg-warning)]',
        bgClass: 'bg-[var(--fg-warning)]/10',
      };
    case 'false':
      return {
        icon: '✕',
        label: 'False',
        colorClass: 'text-[var(--fg-error)]',
        bgClass: 'bg-[var(--fg-error)]/10',
      };
    case 'synthetic':
      return {
        icon: '⚡',
        label: 'AI Generated',
        colorClass: 'text-[var(--fg-info)]',
        bgClass: 'bg-[var(--fg-info)]/10',
      };
    case 'pending':
      return {
        icon: '○',
        label: 'Pending',
        colorClass: 'text-[var(--fg-tertiary)]',
        bgClass: 'bg-[var(--bg-surface-nested)]',
      };
    case 'in_review':
      return {
        icon: '◐',
        label: 'In Review',
        colorClass: 'text-[var(--fg-secondary)]',
        bgClass: 'bg-[var(--bg-surface-nested)]',
      };
    case 'unverified':
    default:
      return {
        icon: '○',
        label: 'Unverified',
        colorClass: 'text-[var(--fg-tertiary)]',
        bgClass: 'bg-transparent',
      };
  }
}

export function VerificationBadge({
  status,
  collectiveName,
  size = 'sm',
  showLabel = false,
}: VerificationBadgeProps): ReactElement {
  const config = getBadgeConfig(status);

  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';

  // Don't show badge for unverified content unless explicitly showing label
  if (status === 'unverified' && !showLabel) {
    return <span className="sr-only">Unverified content</span>;
  }

  const title =
    collectiveName !== undefined ? `${config.label} by ${collectiveName}` : config.label;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bgClass} ${config.colorClass} ${sizeClasses} `}
      title={title}
      aria-label={title}
    >
      <span aria-hidden="true">{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
