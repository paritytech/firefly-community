/**
 * Newsroom layout — Shared layout for all Newsroom pages.
 *
 * Provides consistent navigation and structure for organization management,
 * including treasury, team, budget, and settings pages.
 */

import type { ReactElement, ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';

interface NewsroomLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function NewsroomLayout({
  children,
  params,
}: NewsroomLayoutProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('newsroom');

  return (
    <div className="min-h-screen">
      {/* Newsroom header */}
      <div className="border-b border-[var(--border-default)] bg-[var(--bg-surface-nested)]">
        <div className="container-wide py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-display text-2xl font-medium text-[var(--fg-primary)]">
                {t('title')}
              </h1>
              <p className="mt-1 text-sm text-[var(--fg-tertiary)]">{t('description')}</p>
            </div>

            {/* Navigation tabs */}
            <nav className="flex flex-wrap gap-2">
              <Link
                href="/newsroom"
                className="rounded-nested px-4 py-2 text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-surface-container)] hover:text-[var(--fg-primary)]"
              >
                {t('nav.dashboard')}
              </Link>
              <Link
                href="/newsroom/treasury"
                className="rounded-nested px-4 py-2 text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-surface-container)] hover:text-[var(--fg-primary)]"
              >
                {t('nav.treasury')}
              </Link>
              <Link
                href="/newsroom/team"
                className="rounded-nested px-4 py-2 text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-surface-container)] hover:text-[var(--fg-primary)]"
              >
                {t('nav.team')}
              </Link>
              <Link
                href="/newsroom/budget"
                className="rounded-nested px-4 py-2 text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-surface-container)] hover:text-[var(--fg-primary)]"
              >
                {t('nav.budget')}
              </Link>
              <Link
                href="/newsroom/settings"
                className="rounded-nested px-4 py-2 text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-surface-container)] hover:text-[var(--fg-primary)]"
              >
                {t('nav.settings')}
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
