/**
 * Withdrawals page — View and manage withdrawal requests.
 *
 * Shows all withdrawal requests (pending, completed, cancelled)
 * with actions to complete or cancel pending ones.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { WithdrawalsView } from './WithdrawalsView';

interface WithdrawalsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function WithdrawalsPage({
  params,
}: WithdrawalsPageProps): Promise<ReactElement> {
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
            <li className="text-[var(--fg-primary)]">{t('withdrawalsPage.title')}</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-medium text-[var(--fg-primary)]">
            {t('withdrawalsPage.title')}
          </h1>
          <p className="mt-2 text-lg text-[var(--fg-secondary)]">
            {t('withdrawalsPage.description')}
          </p>
        </div>

        {/* Withdrawals list */}
        <WithdrawalsView
          translations={{
            allWithdrawals: t('withdrawalsPage.allWithdrawals'),
            pending: t('withdrawalsPage.pending'),
            completed: t('withdrawalsPage.completed'),
            cancelled: t('withdrawalsPage.cancelled'),
            noWithdrawals: t('withdrawalsPage.noWithdrawals'),
            signInRequired: t('signInRequired'),
            signInDescription: t('signInDescription'),
            // Withdrawal card translations
            status: t('withdrawals.status'),
            shares: t('withdrawals.shares'),
            requestedAt: t('withdrawals.requestedAt'),
            availableAt: t('withdrawals.availableAt'),
            complete: t('withdrawals.complete'),
            cancel: t('withdrawals.cancel'),
            ready: t('withdrawals.ready'),
          }}
        />
      </div>
    </main>
  );
}
