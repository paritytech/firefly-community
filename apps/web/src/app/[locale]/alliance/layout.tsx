/**
 * Alliance layout — Shared layout for all Alliance pages.
 *
 * Provides consistent navigation and structure for treasury, governance,
 * and other Alliance-related pages.
 */

import type { ReactElement, ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';

interface AllianceLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AllianceLayout({
  children,
  params,
}: AllianceLayoutProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('alliance');

  return (
    <div className="min-h-screen">
      {/* Alliance header */}
      <div className="border-b border-[var(--border-default)] bg-[var(--bg-surface-nested)]">
        <div className="container-wide py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-display text-2xl font-medium text-[var(--fg-primary)]">
                {t('title')}
              </h1>
              <p className="mt-1 text-sm text-[var(--fg-tertiary)]">
                Collectively funding independent journalism
              </p>
            </div>

            {/* Navigation tabs */}
            <nav className="flex gap-2">
              <Link
                href="/alliance/treasury"
                className="rounded-nested px-4 py-2 text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-surface-container)] hover:text-[var(--fg-primary)]"
              >
                {t('treasury.title')}
              </Link>
              <Link
                href="/alliance/governance"
                className="rounded-nested px-4 py-2 text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-surface-container)] hover:text-[var(--fg-primary)]"
              >
                {t('governance.title')}
              </Link>
            </nav>
          </div>
        </div>
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
