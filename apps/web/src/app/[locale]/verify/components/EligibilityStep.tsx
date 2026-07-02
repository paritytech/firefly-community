'use client';

/**
 * EligibilityStep — Check if user can be attested.
 */

interface EligibilityStepTranslations {
  title: string;
  description: string;
  checking: string;
  eligible: string;
  notEligible: string;
  alreadyVerified: string;
  reason: string;
  next: string;
  back?: string;
}

interface EligibilityStepProps {
  translations: EligibilityStepTranslations;
  canBeAttested: boolean;
  ineligibleReason: string | undefined;
  isVerified: boolean;
  loading: boolean;
  onNext: () => void;
  /** Optional: when omitted (e.g. this is the first step) no Back button is rendered. */
  onBack?: () => void;
}

export function EligibilityStep({
  translations,
  canBeAttested,
  ineligibleReason,
  isVerified,
  loading,
  onNext,
  onBack,
}: EligibilityStepProps): React.ReactElement {
  return (
    <div className="text-center">
      <h2 className="mb-4 font-display text-xl font-medium text-[var(--fg-primary)]">
        {translations.title}
      </h2>
      <p className="mb-8 text-[var(--fg-secondary)]">{translations.description}</p>

      {loading ? (
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          <p className="text-sm text-[var(--fg-secondary)]">{translations.checking}</p>
        </div>
      ) : isVerified ? (
        <div className="space-y-4">
          <div className="border-[var(--accent)]/30 bg-[var(--accent)]/10 rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-center gap-2">
              <svg
                className="h-5 w-5 text-[var(--accent)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-medium text-[var(--accent)]">
                {translations.alreadyVerified}
              </span>
            </div>
          </div>
          <button
            onClick={onNext}
            className="rounded-lg bg-[var(--accent)] px-6 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
          >
            View Details
          </button>
        </div>
      ) : canBeAttested ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
            <div className="flex items-center justify-center gap-2">
              <svg
                className="h-5 w-5 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium text-green-400">{translations.eligible}</span>
            </div>
          </div>
          <div className="flex justify-center gap-4">
            {onBack !== undefined && (
              <button
                onClick={onBack}
                className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-emphasis)] hover:text-[var(--fg-primary)]"
              >
                {translations.back}
              </button>
            )}
            <button
              onClick={onNext}
              className="rounded-lg bg-[var(--accent)] px-6 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
            >
              {translations.next}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <div className="mb-2 flex items-center justify-center gap-2">
              <svg
                className="h-5 w-5 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span className="font-medium text-red-400">{translations.notEligible}</span>
            </div>
            {ineligibleReason !== undefined && (
              <p className="text-sm text-red-400/80">
                {translations.reason}: {ineligibleReason}
              </p>
            )}
          </div>
          {onBack !== undefined && (
            <button
              onClick={onBack}
              className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-emphasis)] hover:text-[var(--fg-primary)]"
            >
              {translations.back}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
