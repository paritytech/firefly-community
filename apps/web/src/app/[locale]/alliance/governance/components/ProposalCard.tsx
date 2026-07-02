/**
 * ProposalCard — Summary card for proposal listings.
 *
 * Shows proposal title, type, status, and voting progress.
 */

import type { ReactElement } from 'react';
import Link from 'next/link';
import type { AllianceProposalPreview, AllianceProposalStatus } from '@cocuyo/types';
import { ProposalTypeIcon } from './ProposalTypeIcon';

interface ProposalCardTranslations {
  votingEnds: string;
  quorumProgress: string;
}

export interface ProposalCardProps {
  proposal: AllianceProposalPreview;
  typeName: string;
  statusName: string;
  translations: ProposalCardTranslations;
}

function getStatusColor(status: AllianceProposalStatus): string {
  switch (status) {
    case 'voting':
      return 'bg-[var(--color-firefly-gold)]/20 text-[var(--color-firefly-gold)]';
    case 'approved':
      return 'bg-green-500/20 text-green-400';
    case 'rejected':
      return 'bg-red-500/20 text-red-400';
    case 'expired':
      return 'bg-gray-500/20 text-gray-400';
    case 'executed':
      return 'bg-blue-500/20 text-blue-400';
  }
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (diff < 0) {
    return 'Ended';
  }
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return '<1h';
}

export function ProposalCard({
  proposal,
  typeName,
  statusName,
  translations: t,
}: ProposalCardProps): ReactElement {
  // Simple quorum estimation: assume 100 weight needed, use total weight
  const quorumPercent = Math.min((proposal.totalVotingWeight / 100) * 100, 100);
  const votingEndsAt = new Date(proposal.expiresAt * 1000);

  return (
    <Link
      href={`/alliance/governance/proposal/${proposal.id}`}
      className="block rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] p-6 transition-colors hover:border-[var(--border-emphasis)]"
    >
      <div className="flex items-start gap-4">
        {/* Type Icon */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface-nested)]">
          <ProposalTypeIcon
            type={proposal.proposalType}
            className="h-5 w-5 text-[var(--fg-secondary)]"
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            {/* Type badge */}
            <span className="rounded-full bg-[var(--bg-surface-nested)] px-2 py-0.5 text-xs text-[var(--fg-tertiary)]">
              {typeName}
            </span>
            {/* Status badge */}
            <span className={`rounded-full px-2 py-0.5 text-xs ${getStatusColor(proposal.status)}`}>
              {statusName}
            </span>
          </div>

          {/* Title */}
          <h3 className="mb-2 truncate text-base font-medium text-[var(--fg-primary)]">
            {proposal.title}
          </h3>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--fg-tertiary)]">
            {/* Voting ends */}
            {proposal.status === 'voting' && (
              <div className="flex items-center gap-1">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>
                  {t.votingEnds}: {formatDate(votingEndsAt)}
                </span>
              </div>
            )}

            {/* Vote count */}
            <div className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{proposal.voteCount} votes</span>
            </div>

            {/* Quorum progress */}
            <div className="flex items-center gap-2">
              <span>{t.quorumProgress}:</span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--bg-surface-nested)]">
                <div
                  className={`h-full rounded-full transition-all ${
                    quorumPercent >= 100 ? 'bg-green-500' : 'bg-[var(--color-firefly-gold)]'
                  }`}
                  style={{ width: `${quorumPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <svg
          className="h-5 w-5 flex-shrink-0 text-[var(--fg-tertiary)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
