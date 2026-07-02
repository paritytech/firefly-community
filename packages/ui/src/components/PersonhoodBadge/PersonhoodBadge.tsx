'use client';

/**
 * PersonhoodBadge — Shows the personhood verification level of a firefly.
 *
 * Visual indicator for DIM verification level. Uses the same pattern
 * as VerificationBadge: level -> {icon, label, colorClass, bgClass}
 */

import type { ReactElement } from 'react';
import type { PersonhoodLevel } from '@cocuyo/types';

/** Translation labels for personhood levels */
export interface PersonhoodBadgeLabels {
  full: string;
  lite: string;
  none: string;
}

export interface PersonhoodBadgeProps {
  /** The personhood level to display */
  level: PersonhoodLevel;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Show label text alongside icon */
  showLabel?: boolean;
  /** Optional custom labels for translation */
  labels?: PersonhoodBadgeLabels;
}

interface BadgeConfig {
  icon: string;
  label: string;
  colorClass: string;
  bgClass: string;
}

const DEFAULT_LABELS: PersonhoodBadgeLabels = {
  full: 'Verified',
  lite: 'Lite',
  none: 'Unverified',
};

function getBadgeConfig(level: PersonhoodLevel, labels: PersonhoodBadgeLabels): BadgeConfig {
  switch (level) {
    case 'full':
      return {
        icon: '◆',
        label: labels.full,
        colorClass: 'text-[var(--fg-success)]',
        bgClass: 'bg-[var(--fg-success)]/10',
      };
    case 'lite':
      return {
        icon: '◇',
        label: labels.lite,
        colorClass: 'text-[var(--fg-secondary)]',
        bgClass: 'bg-[var(--bg-surface-nested)]',
      };
    case 'none':
    default:
      return {
        icon: '○',
        label: labels.none,
        colorClass: 'text-[var(--fg-tertiary)]',
        bgClass: 'bg-transparent',
      };
  }
}

export function PersonhoodBadge({
  level,
  size = 'sm',
  showLabel = false,
  labels = DEFAULT_LABELS,
}: PersonhoodBadgeProps): ReactElement {
  const config = getBadgeConfig(level, labels);

  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';

  // Don't show badge for 'none' level unless explicitly showing label
  if (level === 'none' && !showLabel) {
    return <span className="sr-only">Unverified identity</span>;
  }

  const title = `DIM ${config.label}`;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bgClass} ${config.colorClass} ${sizeClasses}`}
      title={title}
      aria-label={title}
    >
      <span aria-hidden="true">{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
