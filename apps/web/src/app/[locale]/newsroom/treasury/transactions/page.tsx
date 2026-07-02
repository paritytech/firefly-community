/**
 * Transaction History page — View and manage treasury transactions.
 *
 * Shows full transaction history with filters for status and type.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TransactionListView } from './TransactionListView';

interface TransactionsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function TransactionsPage({
  params,
}: TransactionsPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('newsroom');

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="container-wide py-8">
          <h1 className="mb-2 font-display text-2xl font-medium text-[var(--fg-primary)]">
            {t('transactions.title')}
          </h1>
          <p className="max-w-2xl text-sm text-[var(--fg-secondary)]">
            View and manage your organization&apos;s treasury transactions.
          </p>
        </div>
      </header>

      {/* Main content */}
      <section className="py-8">
        <div className="container-wide">
          <TransactionListView
            translations={{
              signInRequired: t('signInRequired'),
              noAccess: t('noAccess'),
              // Filters
              filterByStatus: t('transactions.filterByStatus'),
              filterByType: t('transactions.filterByType'),
              // Status
              pending: t('transactions.pending'),
              approved: t('transactions.approved'),
              executed: t('transactions.executed'),
              rejected: t('transactions.rejected'),
              cancelled: t('transactions.cancelled'),
              // Type
              withdrawal: t('transactions.withdrawal'),
              deposit: t('transactions.deposit'),
              transfer: t('transactions.transfer'),
              allocation: t('transactions.allocation'),
              // Actions
              approve: t('transactions.approve'),
              execute: t('transactions.execute'),
              cancel: t('transactions.cancel'),
              approvals: t('transactions.approvals'),
              // Empty
              noTransactions: t('transactions.noTransactions'),
              // Permissions
              insufficientPermission: t('permissions.insufficientPermission'),
            }}
          />
        </div>
      </section>
    </main>
  );
}
