'use client';

/**
 * WhatIsVerification — Informational section about verification.
 */

interface WhatIsVerificationTranslations {
  title: string;
  description: string;
  benefit1: string;
  benefit2: string;
  benefit3: string;
  privacy: string;
}

interface WhatIsVerificationProps {
  translations: WhatIsVerificationTranslations;
}

export function WhatIsVerification({ translations }: WhatIsVerificationProps): React.ReactElement {
  return (
    <div className="mt-12 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6">
      <h3 className="mb-4 font-display text-lg font-medium text-[var(--fg-primary)]">
        {translations.title}
      </h3>
      <p className="mb-6 text-sm text-[var(--fg-secondary)]">{translations.description}</p>

      {/* Benefits */}
      <ul className="mb-6 space-y-3">
        {[translations.benefit1, translations.benefit2, translations.benefit3].map(
          (benefit, index) => (
            <li key={index} className="flex items-start gap-3">
              <div className="bg-[var(--accent)]/20 mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full">
                <svg
                  className="h-3 w-3 text-[var(--accent)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm text-[var(--fg-secondary)]">{benefit}</span>
            </li>
          )
        )}
      </ul>

      {/* Privacy note */}
      <div className="flex items-start gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-4">
        <svg
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--accent)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <p className="text-sm text-[var(--fg-secondary)]">{translations.privacy}</p>
      </div>
    </div>
  );
}
