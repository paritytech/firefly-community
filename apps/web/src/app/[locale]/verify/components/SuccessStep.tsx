'use client';

/**
 * SuccessStep — Verification complete!
 */

import Link from 'next/link';
import type { PersonhoodLevel } from '@cocuyo/types';

interface SuccessStepTranslations {
  title: string;
  description: string;
  level: string;
  capabilities: string;
  goToDashboard: string;
  explore: string;
  capIlluminate: string;
  capCorroborate: string;
  capChallenge: string;
  capFundBounty: string;
  capClaimPayout: string;
  capReceiveCoinage: string;
}

interface SuccessStepProps {
  translations: SuccessStepTranslations;
  level: PersonhoodLevel;
}

const LEVEL_LABELS: Record<PersonhoodLevel, string> = {
  none: 'None',
  lite: 'Lite',
  full: 'Full',
};

export function SuccessStep({ translations, level }: SuccessStepProps): React.ReactElement {
  const capabilities = [
    { key: 'illuminate', label: translations.capIlluminate, enabled: level !== 'none' },
    { key: 'corroborate', label: translations.capCorroborate, enabled: level !== 'none' },
    { key: 'challenge', label: translations.capChallenge, enabled: level !== 'none' },
    { key: 'fundBounty', label: translations.capFundBounty, enabled: level !== 'none' },
    { key: 'claimPayout', label: translations.capClaimPayout, enabled: level !== 'none' },
    { key: 'receiveCoinage', label: translations.capReceiveCoinage, enabled: level !== 'none' },
  ];

  return (
    <div className="text-center">
      {/* Success icon */}
      <div className="mb-6 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)]">
          <svg
            className="h-8 w-8 text-black"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      <h2 className="mb-4 font-display text-xl font-medium text-[var(--fg-primary)]">
        {translations.title}
      </h2>
      <p className="mb-6 text-[var(--fg-secondary)]">{translations.description}</p>

      {/* Level badge */}
      <div className="bg-[var(--accent)]/10 mb-8 inline-flex items-center gap-2 rounded-full px-4 py-2">
        <span className="text-sm text-[var(--fg-secondary)]">{translations.level}:</span>
        <span className="font-medium text-[var(--accent)]">{LEVEL_LABELS[level]}</span>
      </div>

      {/* Capabilities */}
      <div className="mb-8 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-4">
        <h3 className="mb-4 text-sm font-medium text-[var(--fg-primary)]">
          {translations.capabilities}
        </h3>
        <ul className="grid grid-cols-2 gap-2 text-left">
          {capabilities.map((cap) => (
            <li key={cap.key} className="flex items-center gap-2 text-sm">
              {cap.enabled ? (
                <svg
                  className="h-4 w-4 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4 text-[var(--fg-tertiary)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span
                className={cap.enabled ? 'text-[var(--fg-primary)]' : 'text-[var(--fg-tertiary)]'}
              >
                {cap.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4">
        <Link
          href="/posts"
          className="rounded-lg border border-[var(--border-default)] px-6 py-2 text-sm text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-emphasis)] hover:text-[var(--fg-primary)]"
        >
          {translations.explore}
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg bg-[var(--accent)] px-6 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
        >
          {translations.goToDashboard}
        </Link>
      </div>
    </div>
  );
}
