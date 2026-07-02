'use client';

/**
 * StepConfirm — Final confirmation step in the join flow.
 *
 * Shows summary of contribution details and allows final confirmation.
 * Displays cooldown warning about withdrawal period.
 */

import type { ReactElement } from 'react';
import type { ContributorTier } from '@cocuyo/types';
import { TierBadge } from '../components/TierBadge';

interface StepConfirmTranslations {
  title: string;
  description: string;
  amount: string;
  tier: string;
  shares: string;
  note: string;
  cooldownWarning: string;
  confirm: string;
  confirming: string;
  back: string;
}

export interface StepConfirmProps {
  translations: StepConfirmTranslations;
  amountCents: number;
  tier: ContributorTier;
  tierName: string;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
  onBack: () => void;
}

export function StepConfirm({
  translations: t,
  amountCents,
  tier,
  tierName,
  isSubmitting,
  onConfirm,
  onBack,
}: StepConfirmProps): ReactElement {
  const handleConfirm = async (): Promise<void> => {
    await onConfirm();
  };

  // Estimate shares (1:1 at initial price)
  const estimatedShares = amountCents / 100;

  return (
    <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-8">
      <h2 className="mb-2 font-display text-xl font-medium text-[var(--fg-primary)]">{t.title}</h2>
      <p className="mb-8 text-[var(--fg-secondary)]">{t.description}</p>

      <div className="space-y-6">
        {/* Summary card */}
        <div className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] p-6">
          <div className="space-y-4">
            {/* Amount */}
            <div className="flex items-center justify-between">
              <span className="text-[var(--fg-secondary)]">{t.amount}</span>
              <span className="font-display text-xl font-medium text-[var(--fg-primary)]">
                ${(amountCents / 100).toFixed(2)} pUSD
              </span>
            </div>

            {/* Tier */}
            <div className="flex items-center justify-between">
              <span className="text-[var(--fg-secondary)]">{t.tier}</span>
              <TierBadge tier={tier} name={tierName} size="lg" />
            </div>

            {/* Estimated shares */}
            <div className="flex items-center justify-between">
              <span className="text-[var(--fg-secondary)]">{t.shares}</span>
              <span className="font-mono text-[var(--fg-primary)]">
                ~{estimatedShares.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <p className="text-xs text-[var(--fg-tertiary)]">{t.note}</p>
          </div>
        </div>

        {/* Cooldown warning */}
        <div className="border-[var(--fg-warning)]/30 bg-[var(--fg-warning)]/5 flex items-start gap-3 rounded-nested border p-4">
          <svg
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--fg-warning)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-sm text-[var(--fg-warning)]">{t.cooldownWarning}</p>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="rounded-nested border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-emphasis)] hover:text-[var(--fg-primary)] disabled:opacity-50"
          >
            {t.back}
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-nested bg-[var(--color-firefly-gold)] px-6 py-2 font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {isSubmitting ? t.confirming : t.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
