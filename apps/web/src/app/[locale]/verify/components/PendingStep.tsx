'use client';

/**
 * PendingStep — Waiting for attestation to complete.
 */

import { useEffect, useState } from 'react';
import { usePersonhoodService } from '@/lib/services/hooks';

interface PendingStepTranslations {
  title: string;
  description: string;
  waiting: string;
  note: string;
}

interface PendingStepProps {
  translations: PendingStepTranslations;
  onComplete: () => void;
}

export function PendingStep({ translations, onComplete }: PendingStepProps): React.ReactElement {
  const { isVerified, refresh } = usePersonhoodService();
  const [dots, setDots] = useState('');

  // Animate waiting dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Poll for verification status
  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 5000);

    return () => clearInterval(interval);
  }, [refresh]);

  // Auto-advance when verified
  useEffect(() => {
    if (isVerified) {
      onComplete();
    }
  }, [isVerified, onComplete]);

  return (
    <div className="text-center">
      <h2 className="mb-4 font-display text-xl font-medium text-[var(--fg-primary)]">
        {translations.title}
      </h2>
      <p className="mb-8 text-[var(--fg-secondary)]">{translations.description}</p>

      {/* Loading animation */}
      <div className="mb-8 flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-[var(--border-default)]" />
          <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-4 border-transparent border-t-[var(--accent)]" />
        </div>
        <p className="font-mono text-sm text-[var(--accent)]">
          {translations.waiting}
          {dots}
        </p>
      </div>

      {/* Info note */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-4">
        <div className="flex items-start gap-3 text-left">
          <svg
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--fg-tertiary)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-[var(--fg-secondary)]">{translations.note}</p>
        </div>
      </div>

      {/* Manual refresh button */}
      <button
        onClick={refresh}
        className="mt-6 text-sm text-[var(--fg-tertiary)] underline hover:text-[var(--fg-secondary)] hover:no-underline"
      >
        Check status manually
      </button>
    </div>
  );
}
