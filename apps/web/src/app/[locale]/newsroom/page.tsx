/**
 * Newsroom Dashboard page — Overview of organization operations.
 *
 * Shows treasury balance, team members count, pending approvals, and recent activity.
 * Requires organization membership to access.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NewsroomDashboardView } from './NewsroomDashboardView';

interface NewsroomPageProps {
  params: Promise<{ locale: string }>;
}

export default async function NewsroomPage({ params }: NewsroomPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('newsroom');

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="container-wide py-8">
          <h1 className="mb-2 font-display text-2xl font-medium text-[var(--fg-primary)]">
            {t('overview.title')}
          </h1>
          <p className="max-w-2xl text-sm text-[var(--fg-secondary)]">{t('description')}</p>
        </div>
      </header>

      {/* Main content */}
      <section className="py-8">
        <div className="container-wide">
          <NewsroomDashboardView
            translations={{
              signInRequired: t('signInRequired'),
              noAccess: t('noAccess'),
              selectOrg: t('selectOrg'),
              noOrgs: t('noOrgs'),
              // Overview
              treasuryBalance: t('overview.treasuryBalance'),
              teamMembers: t('overview.teamMembers'),
              pendingApprovals: t('overview.pendingApprovals'),
              recentActivity: t('overview.recentActivity'),
              noActivity: t('overview.noActivity'),
              // Treasury
              treasuryTitle: t('treasury.title'),
              available: t('treasury.available'),
              escrowed: t('treasury.escrowed'),
              withdraw: t('treasury.withdraw'),
              viewAll: t('treasury.viewAll'),
              // Team
              teamTitle: t('team.title'),
              invite: t('team.invite'),
              // Navigation
              navTreasury: t('nav.treasury'),
              navTeam: t('nav.team'),
              navBudget: t('nav.budget'),
              navSettings: t('nav.settings'),
            }}
          />
        </div>
      </section>
    </main>
  );
}
