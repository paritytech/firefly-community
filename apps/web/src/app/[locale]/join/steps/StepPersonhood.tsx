'use client';

/**
 * StepPersonhood — Personhood verification step in the join flow.
 *
 * Checks if user has completed personhood verification via DIM.
 * If not verified, provides option to verify or skip.
 */

import type { ReactElement } from 'react';

interface StepPersonhoodTranslations {
  title: string;
  description: string;
  verified: string;
  verify: string;
  skip: string;
  skipNote: string;
}

export interface StepPersonhoodProps {
  translations: StepPersonhoodTranslations;
  isVerified: boolean;
  onVerified: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export function StepPersonhood({
  translations: t,
  isVerified,
  onVerified,
  onSkip,
  onBack,
}: StepPersonhoodProps): ReactElement {
  // In the real implementation, this would open the DIM verification flow
  const handleVerify = (): void => {
    // TODO: Integrate with DIM SDK for actual verification
    // For now, mock as verified
    onVerified();
  };

  return (
    <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-8">
      <h2 className="mb-2 font-display text-xl font-medium text-[var(--fg-primary)]">{t.title}</h2>
      <p className="mb-8 text-[var(--fg-secondary)]">{t.description}</p>

      {isVerified ? (
        <div className="space-y-6">
          {/* Verified state */}
          <div className="border-[var(--fg-success)]/30 bg-[var(--fg-success)]/10 flex items-center gap-4 rounded-nested border p-4">
            <div className="bg-[var(--fg-success)]/20 flex h-10 w-10 items-center justify-center rounded-full">
              <svg
                className="h-5 w-5 text-[var(--fg-success)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium text-[var(--fg-primary)]">{t.verified}</p>
              <p className="text-sm text-[var(--fg-secondary)]">
                Your identity has been verified via DIM
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={onBack}
              className="rounded-nested border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-emphasis)] hover:text-[var(--fg-primary)]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={onVerified}
              className="rounded-nested bg-[var(--color-firefly-gold)] px-6 py-2 font-medium text-black transition-opacity hover:opacity-90"
            >
              Continue
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Not verified state */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <button
              type="button"
              onClick={handleVerify}
              className="flex-1 rounded-nested bg-[var(--color-firefly-gold)] px-6 py-3 font-medium text-black transition-opacity hover:opacity-90"
            >
              {t.verify}
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="flex-1 rounded-nested border border-[var(--border-default)] px-6 py-3 text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-emphasis)] hover:text-[var(--fg-primary)]"
            >
              {t.skip}
            </button>
          </div>

          <p className="text-center text-xs text-[var(--fg-tertiary)]">{t.skipNote}</p>

          {/* Actions */}
          <div className="flex justify-start">
            <button
              type="button"
              onClick={onBack}
              className="rounded-nested border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-emphasis)] hover:text-[var(--fg-primary)]"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
