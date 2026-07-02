/**
 * History page — View contribution and withdrawal history.
 *
 * Shows a chronological list of all transactions for the contributor.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { HistoryView } from './HistoryView';

interface HistoryPageProps {
  params: Promise<{ locale: string }>;
}

export default async function HistoryPage({ params }: HistoryPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');

  return (
    <main className="min-h-screen">
      <div className="container-wide py-12">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm">
          <ol className="flex items-center gap-2 text-[var(--fg-tertiary)]">
            <li>
              <Link href="/dashboard" className="transition-colors hover:text-[var(--fg-primary)]">
                {t('title')}
              </Link>
            </li>
            <li>/</li>
            <li className="text-[var(--fg-primary)]">{t('history.title')}</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-medium text-[var(--fg-primary)]">
            {t('history.title')}
          </h1>
          <p className="mt-2 text-lg text-[var(--fg-secondary)]">{t('history.description')}</p>
        </div>

        {/* History table */}
        <HistoryView
          translations={{
            type: t('history.type'),
            amount: t('history.amount'),
            shares: t('history.shares'),
            date: t('history.date'),
            txHash: t('history.txHash'),
            contribution: t('history.contribution'),
            withdrawal: t('history.withdrawal'),
            noHistory: t('history.noHistory'),
            signInRequired: t('signInRequired'),
            signInDescription: t('signInDescription'),
          }}
        />
      </div>
    </main>
  );
}
