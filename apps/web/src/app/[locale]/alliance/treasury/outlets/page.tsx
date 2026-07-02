/**
 * Outlets page — Detailed view of all funded outlets.
 *
 * Shows a grid of all outlets receiving funding from the Alliance treasury.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { OutletsView } from './OutletsView';

interface OutletsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function OutletsPage({ params }: OutletsPageProps): Promise<ReactElement> {
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
            <li className="text-[var(--fg-primary)]">{t('outlets.title')}</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-medium text-[var(--fg-primary)]">
            {t('outlets.title')}
          </h1>
          <p className="mt-2 text-lg text-[var(--fg-secondary)]">{t('outlets.description')}</p>
        </div>

        {/* Outlets grid */}
        <OutletsView
          translations={{
            weight: t('outlets.weight'),
            distributed: t('outlets.distributed'),
            noOutlets: t('outlets.noOutlets'),
          }}
        />
      </div>
    </main>
  );
}
