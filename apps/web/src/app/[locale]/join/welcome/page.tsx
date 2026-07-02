/**
 * Welcome page — Success page after joining the Firefly Alliance.
 *
 * Shows contribution confirmation and next steps.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';

interface WelcomePageProps {
  params: Promise<{ locale: string }>;
}

export default async function WelcomePage({ params }: WelcomePageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('join.welcome');

  return (
    <main className="min-h-screen">
      <div className="container-wide flex min-h-[80vh] items-center justify-center py-16">
        <div className="mx-auto max-w-xl text-center">
          {/* Success icon */}
          <div className="mb-8 flex justify-center">
            <div className="bg-[var(--color-firefly-gold)]/20 flex h-24 w-24 items-center justify-center rounded-full">
              <svg
                className="h-12 w-12 text-[var(--color-firefly-gold)]"
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
          </div>

          {/* Welcome message */}
          <h1 className="mb-4 font-display text-3xl font-medium text-[var(--fg-primary)]">
            {t('title')}
          </h1>
          <p className="mb-8 text-lg text-[var(--fg-secondary)]">{t('subtitle')}</p>

          {/* What's next section */}
          <div className="mb-8 rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6 text-left">
            <h2 className="mb-4 font-medium text-[var(--fg-primary)]">{t('whatsNext')}</h2>
            <ul className="space-y-3 text-sm text-[var(--fg-secondary)]">
              <li className="flex items-start gap-3">
                <span className="bg-[var(--color-firefly-gold)]/20 mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium text-[var(--color-firefly-gold)]">
                  1
                </span>
                {t('step1')}
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-[var(--color-firefly-gold)]/20 mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium text-[var(--color-firefly-gold)]">
                  2
                </span>
                {t('step2')}
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-[var(--color-firefly-gold)]/20 mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium text-[var(--color-firefly-gold)]">
                  3
                </span>
                {t('step3')}
              </li>
            </ul>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-nested bg-[var(--color-firefly-gold)] px-6 py-3 font-medium text-black transition-opacity hover:opacity-90"
            >
              {t('goToDashboard')}
            </Link>
            <Link
              href="/alliance/treasury"
              className="inline-flex items-center justify-center rounded-nested border border-[var(--border-default)] px-6 py-3 text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-emphasis)] hover:text-[var(--fg-primary)]"
            >
              {t('viewTreasury')}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
