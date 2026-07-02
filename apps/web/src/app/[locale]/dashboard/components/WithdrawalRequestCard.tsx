'use client';

/**
 * WithdrawalRequestCard — Displays a pending withdrawal request.
 */

import type { ReactElement } from 'react';
import type { WithdrawalRequest } from '@cocuyo/types';

interface WithdrawalRequestCardTranslations {
  status: string;
  shares: string;
  requestedAt: string;
  availableAt: string;
  complete: string;
  cancel: string;
  ready: string;
}

export interface WithdrawalRequestCardProps {
  withdrawal: WithdrawalRequest;
  translations: WithdrawalRequestCardTranslations;
  onComplete: (requestId: string) => Promise<void>;
  onCancel: (requestId: string) => Promise<void>;
}

export function WithdrawalRequestCard({
  withdrawal,
  translations: t,
  onComplete,
  onCancel,
}: WithdrawalRequestCardProps): ReactElement {
  const now = Math.floor(Date.now() / 1000);
  const isReady = now >= withdrawal.availableAt;
  const secondsRemaining = withdrawal.availableAt - now;
  const daysRemaining = Math.ceil(secondsRemaining / (24 * 60 * 60));

  // Format dates
  const requestedDate = new Date(withdrawal.requestedAt * 1000).toLocaleDateString();
  const availableDate = new Date(withdrawal.availableAt * 1000).toLocaleDateString();

  // Format shares (18 decimals)
  const formattedShares = (Number(withdrawal.shares) / 1e18).toFixed(4);

  const handleComplete = async (): Promise<void> => {
    await onComplete(withdrawal.id);
  };

  const handleCancel = async (): Promise<void> => {
    await onCancel(withdrawal.id);
  };

  return (
    <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Details */}
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span>
              <span className="text-[var(--fg-tertiary)]">{t.shares}: </span>
              <span className="font-mono text-[var(--fg-primary)]">{formattedShares}</span>
            </span>
            <span>
              <span className="text-[var(--fg-tertiary)]">{t.requestedAt}: </span>
              <span className="text-[var(--fg-secondary)]">{requestedDate}</span>
            </span>
          </div>

          {/* Status */}
          {isReady ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-[var(--fg-success)]" />
              <span className="text-sm font-medium text-[var(--fg-success)]">{t.ready}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[var(--fg-tertiary)]">{t.availableAt}: </span>
              <span className="text-[var(--fg-secondary)]">{availableDate}</span>
              <span className="text-[var(--fg-tertiary)]">({daysRemaining} days)</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {isReady ? (
            <button
              onClick={() => void handleComplete()}
              className="rounded-nested bg-[var(--fg-success)] px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
            >
              {t.complete}
            </button>
          ) : (
            <button
              onClick={() => void handleCancel()}
              className="rounded-nested border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--fg-secondary)] transition-colors hover:border-[var(--fg-error)] hover:text-[var(--fg-error)]"
            >
              {t.cancel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
