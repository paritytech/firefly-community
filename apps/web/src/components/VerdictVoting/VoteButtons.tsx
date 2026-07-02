'use client';

/**
 * VoteButtons — Verdict voting action buttons.
 *
 * Displays vote options for collective members to vote on a verdict proposal.
 * Uses the design system colors: gold for confirmed, amber for disputed, red for false.
 */

import type { ReactElement } from 'react';
import type { VerdictStatus } from '@cocuyo/types';

export interface VoteButtonsProps {
  /** Called when a vote is cast */
  onVote: (status: VerdictStatus) => void;
  /** Current user's vote (if already voted) */
  currentVote?: VerdictStatus | undefined;
  /** Whether voting is disabled */
  disabled?: boolean;
  /** Whether voting is in progress */
  loading?: boolean;
  /** Translations */
  translations?: {
    confirmed?: string;
    disputed?: string;
    false?: string;
    synthetic?: string;
    inconclusive?: string;
  };
}

const STATUS_CONFIG: Record<VerdictStatus, { label: string; colorClass: string }> = {
  confirmed: {
    label: 'Confirmed',
    colorClass:
      'bg-[var(--color-firefly-gold)]/15 text-[var(--color-firefly-gold)] border-[var(--color-firefly-gold)]/30 hover:bg-[var(--color-firefly-gold)]/25',
  },
  disputed: {
    label: 'Disputed',
    colorClass: 'bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/25',
  },
  false: {
    label: 'False',
    colorClass:
      'bg-[var(--fg-error)]/15 text-[var(--fg-error)] border-[var(--fg-error)]/30 hover:bg-[var(--fg-error)]/25',
  },
  synthetic: {
    label: 'Synthetic',
    colorClass: 'bg-orange-500/15 text-orange-500 border-orange-500/30 hover:bg-orange-500/25',
  },
  inconclusive: {
    label: 'Inconclusive',
    colorClass:
      'bg-[var(--fg-tertiary)]/15 text-[var(--fg-tertiary)] border-[var(--fg-tertiary)]/30 hover:bg-[var(--fg-tertiary)]/25',
  },
};

export function VoteButtons({
  onVote,
  currentVote,
  disabled = false,
  loading = false,
  translations = {},
}: VoteButtonsProps): ReactElement {
  const statuses: VerdictStatus[] = ['confirmed', 'disputed', 'false', 'synthetic', 'inconclusive'];

  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((status) => {
        const config = STATUS_CONFIG[status];
        const isSelected = currentVote === status;
        const label = translations[status] ?? config.label;

        return (
          <button
            key={status}
            type="button"
            onClick={() => onVote(status)}
            disabled={disabled || loading || isSelected}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200 ${config.colorClass} ${isSelected ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-default)]' : ''} ${disabled || loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} `}
            aria-pressed={isSelected}
          >
            <span>{label}</span>
            {isSelected && <span className="ml-1 text-xs">(voted)</span>}
          </button>
        );
      })}
    </div>
  );
}
