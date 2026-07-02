/**
 * Budget Summary page — Financial overview of the organization.
 *
 * Shows income, expenses, burn rate, and runway by period.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BudgetSummaryView } from './BudgetSummaryView';

interface BudgetPageProps {
  params: Promise<{ locale: string }>;
}

export default async function BudgetPage({ params }: BudgetPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('newsroom');

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="container-wide py-8">
          <h1 className="mb-2 font-display text-2xl font-medium text-[var(--fg-primary)]">
            {t('budget.title')}
          </h1>
          <p className="max-w-2xl text-sm text-[var(--fg-secondary)]">
            Track your organization&apos;s financial health and spending patterns.
          </p>
        </div>
      </header>

      {/* Main content */}
      <section className="py-8">
        <div className="container-wide">
          <BudgetSummaryView
            translations={{
              signInRequired: t('signInRequired'),
              noAccess: t('noAccess'),
              // Period
              period: t('budget.period'),
              thisMonth: t('budget.thisMonth'),
              thisQuarter: t('budget.thisQuarter'),
              thisYear: t('budget.thisYear'),
              // Summary
              startingBalance: t('budget.startingBalance'),
              endingBalance: t('budget.endingBalance'),
              income: t('budget.income'),
              expenses: t('budget.expenses'),
              burnRate: t('budget.burnRate'),
              runway: t('budget.runway'),
              months: t('budget.months'),
              // Breakdown
              byCategory: t('budget.byCategory'),
              bySource: t('budget.bySource'),
              noData: t('budget.noData'),
              // Categories
              categoryEditorial: t('categories.editorial'),
              categoryTechnology: t('categories.technology'),
              categoryAdministration: t('categories.administration'),
              categoryFieldOperations: t('categories.field-operations'),
              categoryLegal: t('categories.legal'),
              categoryGrantsOut: t('categories.grants-out'),
              // Sources
              sourceCampaigns: t('sources.campaigns'),
              sourceGrants: t('sources.grants'),
              sourceDonations: t('sources.donations'),
              sourceOther: t('sources.other'),
            }}
          />
        </div>
      </section>
    </main>
  );
}
