/**
 * Flows page — Distribution history view.
 *
 * Shows the complete history of yield distributions to funded outlets.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { FlowsView } from './FlowsView';

interface FlowsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function FlowsPage({ params }: FlowsPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('alliance.treasury');

  return (
    <main>
      <div className="container-wide py-12">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm">
          <ol className="flex items-center gap-2 text-[var(--fg-tertiary)]">
            <li>
              <Link
                href="/alliance/treasury"
                className="transition-colors hover:text-[var(--fg-primary)]"
              >
                {t('title')}
              </Link>
            </li>
            <li>/</li>
            <li className="text-[var(--fg-primary)]">{t('distributions.title')}</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-medium text-[var(--fg-primary)]">
            {t('distributions.title')}
          </h1>
          <p className="mt-2 text-lg text-[var(--fg-secondary)]">
            {t('distributions.description')}
          </p>
        </div>

        {/* Distribution history */}
        <FlowsView
          translations={{
            amount: t('distributions.amount'),
            date: t('distributions.date'),
            noDistributions: t('distributions.noDistributions'),
          }}
        />
      </div>
    </main>
  );
}
