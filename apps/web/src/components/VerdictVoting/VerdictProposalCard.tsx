'use client';

/**
 * VerdictProposalCard — Compact card for displaying a verdict proposal.
 *
 * Shows proposal status, vote progress, and time remaining.
 */

import type { ReactElement } from 'react';
import type { VerdictProposal } from '@cocuyo/types';
import { calculateVotingProgress } from '@cocuyo/types';

export interface VerdictProposalCardProps {
  /** The proposal to display */
  proposal: VerdictProposal;
  /** Called when the card is clicked */
  onClick?: () => void;
  /** Translations */
  translations?: {
    proposed?: string;
    votes?: string;
    expiresIn?: string;
    expired?: string;
    approved?: string;
    rejected?: string;
  };
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  voting: { label: 'Voting', className: 'bg-blue-500/15 text-blue-400' },
  approved: {
    label: 'Approved',
    className: 'bg-[var(--color-firefly-gold)]/15 text-[var(--color-firefly-gold)]',
  },
  rejected: { label: 'Rejected', className: 'bg-[var(--fg-error)]/15 text-[var(--fg-error)]' },
  expired: { label: 'Expired', className: 'bg-[var(--fg-tertiary)]/15 text-[var(--fg-tertiary)]' },
};

function formatTimeRemaining(expiresAt: number): string {
  const now = Date.now();
  const remaining = expiresAt - now;

  if (remaining <= 0) return 'Expired';

  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;

  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  return `${minutes}m`;
}

export function VerdictProposalCard({
  proposal,
  onClick,
  translations = {},
}: VerdictProposalCardProps): ReactElement {
  const progress = calculateVotingProgress(proposal);
  const statusBadge = STATUS_BADGES[proposal.status] ?? STATUS_BADGES.voting;
  const timeRemaining = formatTimeRemaining(proposal.expiresAt);
  const isExpired = proposal.expiresAt < Date.now();
  const badgeLabel = statusBadge?.label ?? 'Unknown';
  const badgeClassName = statusBadge?.className ?? '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4 text-left transition-colors hover:border-[var(--border-emphasis)] ${onClick ? 'cursor-pointer' : 'cursor-default'} `}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-xs ${badgeClassName}`}>
          {translations[proposal.status as keyof typeof translations] ?? badgeLabel}
        </span>
        <span
          className={`text-xs ${isExpired ? 'text-[var(--fg-error)]' : 'text-[var(--fg-tertiary)]'}`}
        >
          {isExpired
            ? (translations.expired ?? 'Expired')
            : `${translations.expiresIn ?? 'Expires in'} ${timeRemaining}`}
        </span>
      </div>

      {/* Proposed verdict */}
      <div className="mb-3">
        <span className="text-xs text-[var(--fg-tertiary)]">
          {translations.proposed ?? 'Proposed'}:
        </span>
        <span className="ml-2 text-sm font-medium capitalize text-[var(--fg-primary)]">
          {proposal.proposedStatus}
        </span>
      </div>

      {/* Rationale (truncated) */}
      <p className="mb-3 line-clamp-2 text-sm text-[var(--fg-secondary)]">{proposal.rationale}</p>

      {/* Vote progress bar */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-default)]">
          <div
            className="h-full bg-[var(--fg-secondary)] transition-all duration-300"
            style={{
              width: `${Math.min((progress.totalVotes / proposal.requiredVotes) * 100, 100)}%`,
            }}
          />
        </div>
        <span className="text-xs text-[var(--fg-tertiary)]">
          {translations.votes ?? 'Votes'}: {progress.totalVotes}/{proposal.requiredVotes}
        </span>
      </div>
    </button>
  );
}
