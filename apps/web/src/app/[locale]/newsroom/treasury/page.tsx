/**
 * Newsroom Treasury page — Organization treasury overview.
 *
 * Shows balance breakdown, recent transactions, and quick actions.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TreasuryOverviewView } from './TreasuryOverviewView';

interface TreasuryPageProps {
  params: Promise<{ locale: string }>;
}

export default async function TreasuryPage({ params }: TreasuryPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('newsroom');

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="container-wide py-8">
          <h1 className="mb-2 font-display text-2xl font-medium text-[var(--fg-primary)]">
            {t('treasury.title')}
          </h1>
          <p className="max-w-2xl text-sm text-[var(--fg-secondary)]">
            Manage your organization&apos;s treasury and track transactions.
          </p>
        </div>
      </header>

      {/* Main content */}
      <section className="py-8">
        <div className="container-wide">
          <TreasuryOverviewView
            translations={{
              signInRequired: t('signInRequired'),
              noAccess: t('noAccess'),
              // Balance
              balance: t('treasury.balance'),
              available: t('treasury.available'),
              escrowed: t('treasury.escrowed'),
              // Actions
              withdraw: t('treasury.withdraw'),
              deposit: t('treasury.deposit'),
              // Transactions
              transactions: t('treasury.transactions'),
              noTransactions: t('treasury.noTransactions'),
              viewAll: t('treasury.viewAll'),
              // Status
              pending: t('transactions.pending'),
              approved: t('transactions.approved'),
              executed: t('transactions.executed'),
              rejected: t('transactions.rejected'),
              cancelled: t('transactions.cancelled'),
              // Permissions
              insufficientPermission: t('permissions.insufficientPermission'),
            }}
          />
        </div>
      </section>
    </main>
  );
}
