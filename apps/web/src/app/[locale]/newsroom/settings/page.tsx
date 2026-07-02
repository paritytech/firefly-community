/**
 * Settings page — Organization configuration.
 *
 * Manage organization details, governance rules, and treasury settings.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SettingsView } from './SettingsView';

interface SettingsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('newsroom');

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="container-wide py-8">
          <h1 className="mb-2 font-display text-2xl font-medium text-[var(--fg-primary)]">
            {t('settings.title')}
          </h1>
          <p className="max-w-2xl text-sm text-[var(--fg-secondary)]">
            Configure your organization&apos;s settings and governance rules.
          </p>
        </div>
      </header>

      {/* Main content */}
      <section className="py-8">
        <div className="container-wide max-w-3xl">
          <SettingsView
            translations={{
              signInRequired: t('signInRequired'),
              noAccess: t('noAccess'),
              // Sections
              general: t('settings.general'),
              generalDescription: t('settings.generalDescription'),
              treasury: t('settings.treasury'),
              treasuryDescription: t('settings.treasuryDescription'),
              governance: t('settings.governance'),
              governanceDescription: t('settings.governanceDescription'),
              // General fields
              name: t('settings.name'),
              description: t('overview.title'),
              mission: t('settings.mission'),
              // Treasury fields
              signers: t('settings.signers'),
              threshold: t('settings.threshold'),
              thresholdHelp: t('settings.thresholdHelp'),
              limits: t('settings.limits'),
              perTransaction: t('settings.perTransaction'),
              daily: t('settings.daily'),
              // Actions
              save: t('settings.save'),
              saving: t('settings.saving'),
              saved: t('settings.saved'),
              // Permissions
              insufficientPermission: t('permissions.insufficientPermission'),
            }}
          />
        </div>
      </section>
    </main>
  );
}
