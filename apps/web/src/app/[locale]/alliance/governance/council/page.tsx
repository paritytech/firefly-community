/**
 * Alliance Council page — Council members directory.
 *
 * Shows council members and their responsibilities.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CouncilView } from './CouncilView';

interface CouncilPageProps {
  params: Promise<{ locale: string }>;
}

export default async function CouncilPage({ params }: CouncilPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('alliance.governance.council');

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="container-wide py-8">
          <h1 className="mb-2 font-display text-2xl font-medium text-[var(--fg-primary)]">
            {t('title')}
          </h1>
          <p className="max-w-2xl text-sm text-[var(--fg-secondary)]">{t('description')}</p>
        </div>
      </header>

      {/* Main content */}
      <section className="py-8">
        <div className="container-wide">
          <CouncilView
            translations={{
              members: t('members'),
              responsibilities: t('responsibilities'),
              noMembers: t('noMembers'),
              responsibilityOutlets: t('responsibilitiesList.outlets'),
              responsibilityQuality: t('responsibilitiesList.quality'),
              responsibilityEmergency: t('responsibilitiesList.emergency'),
              responsibilityDisputes: t('responsibilitiesList.disputes'),
            }}
          />
        </div>
      </section>
    </main>
  );
}
