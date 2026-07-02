/**
 * Withdrawal Request page — Form to request treasury withdrawal.
 *
 * Allows authorized members to propose withdrawal transactions.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { WithdrawFormView } from './WithdrawFormView';

interface WithdrawPageProps {
  params: Promise<{ locale: string }>;
}

export default async function WithdrawPage({ params }: WithdrawPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('newsroom');

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="container-wide py-8">
          <h1 className="mb-2 font-display text-2xl font-medium text-[var(--fg-primary)]">
            {t('withdraw.title')}
          </h1>
          <p className="max-w-2xl text-sm text-[var(--fg-secondary)]">
            Submit a withdrawal request for treasury approval.
          </p>
        </div>
      </header>

      {/* Main content */}
      <section className="py-8">
        <div className="container-wide max-w-2xl">
          <WithdrawFormView
            translations={{
              signInRequired: t('signInRequired'),
              noAccess: t('noAccess'),
              // Form fields
              amount: t('withdraw.amount'),
              recipient: t('withdraw.recipient'),
              category: t('withdraw.category'),
              purpose: t('withdraw.purpose'),
              // Actions
              submit: t('withdraw.submit'),
              submitting: t('withdraw.submitting'),
              // Validation
              insufficientBalance: t('withdraw.insufficientBalance'),
              exceedsLimit: t('withdraw.exceedsLimit'),
              // Success
              success: t('withdraw.success'),
              // Balance
              available: t('treasury.available'),
              // Permissions
              insufficientPermission: t('permissions.insufficientPermission'),
              // Categories
              categoryEditorial: t('categories.editorial'),
              categoryTechnology: t('categories.technology'),
              categoryAdministration: t('categories.administration'),
              categoryFieldOperations: t('categories.field-operations'),
              categoryLegal: t('categories.legal'),
              categoryGrantsOut: t('categories.grants-out'),
            }}
          />
        </div>
      </section>
    </main>
  );
}
