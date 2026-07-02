'use client';

/**
 * ClaimActions — Action buttons for claim detail page.
 *
 * Provides Submit Evidence (support/contradict) and Illuminate FAB buttons.
 * Opens the Illuminate modal with claim context when submitting evidence.
 */

import { useState, type ReactElement } from 'react';
import type { ClaimId } from '@cocuyo/types';
import { useSigner } from '@/hooks';
import { useIlluminate } from '@/hooks/useIlluminate';
import { useToast } from '@cocuyo/ui';
import { IlluminateFAB } from '@/components/IlluminateFAB';

export interface ClaimActionsProps {
  claimId: ClaimId;
  claimStatement: string;
  translations: {
    submitEvidence: string;
    signInToSubmit: string;
    evidenceSubmitted: string;
    supportThisClaim: string;
    contradictThisClaim: string;
  };
}

export function ClaimActions({
  claimId,
  claimStatement: _claimStatement,
  translations: t,
}: ClaimActionsProps): ReactElement {
  const { isConnected } = useSigner();
  const { openModal } = useIlluminate();
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<'support' | 'contradict' | null>(null);

  const handleSubmitEvidence = (type: 'support' | 'contradict'): void => {
    if (!isConnected) {
      addToast(t.signInToSubmit, 'warning');
      return;
    }

    setSelectedType(type);
    setIsSubmitting(true);

    // Open the illuminate modal with claim context
    // The modal will create a signal and link it as evidence to this claim
    openModal({
      claimId,
      evidenceType: type,
    });

    // Reset button state - success will be shown by the modal when signal is created
    setIsSubmitting(false);
    setSelectedType(null);
  };

  return (
    <>
      {/* Submit Evidence buttons */}
      <div className="mb-8 flex flex-col justify-center gap-3 sm:flex-row">
        {/* Support button */}
        <button
          type="button"
          onClick={() => handleSubmitEvidence('support')}
          disabled={isSubmitting}
          className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 ${
            isConnected
              ? 'bg-[var(--fg-success)]/15 border-[var(--fg-success)]/30 hover:bg-[var(--fg-success)]/25 hover:border-[var(--fg-success)]/50 border text-[var(--fg-success)]'
              : 'border border-[var(--border-default)] bg-[var(--bg-surface-nested)] text-[var(--fg-secondary)]'
          } ${isSubmitting && selectedType === 'support' ? 'cursor-wait opacity-70' : ''} `}
        >
          {isSubmitting && selectedType === 'support' ? (
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
          ) : (
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          <span>{t.supportThisClaim}</span>
        </button>

        {/* Contradict button */}
        <button
          type="button"
          onClick={() => handleSubmitEvidence('contradict')}
          disabled={isSubmitting}
          className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 ${
            isConnected
              ? 'bg-[var(--fg-error)]/15 border-[var(--fg-error)]/30 hover:bg-[var(--fg-error)]/25 hover:border-[var(--fg-error)]/50 border text-[var(--fg-error)]'
              : 'border border-[var(--border-default)] bg-[var(--bg-surface-nested)] text-[var(--fg-secondary)]'
          } ${isSubmitting && selectedType === 'contradict' ? 'cursor-wait opacity-70' : ''} `}
        >
          {isSubmitting && selectedType === 'contradict' ? (
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
          ) : (
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span>{t.contradictThisClaim}</span>
        </button>
      </div>

      {/* Floating action button */}
      <IlluminateFAB />
    </>
  );
}
