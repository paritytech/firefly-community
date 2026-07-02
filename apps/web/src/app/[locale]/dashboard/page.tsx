/**
 * Dashboard page — Contributor dashboard for managing Alliance position.
 *
 * Shows position details, tier, pending withdrawals, and pool statistics.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DashboardView } from './DashboardView';

interface DashboardPageProps {
  params: Promise<{ locale: string }>;
}

export default async function DashboardPage({ params }: DashboardPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');
  const tFeatures = await getTranslations('featureCards');

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
          <DashboardView
            translations={{
              signInRequired: t('signInRequired'),
              signInDescription: t('signInDescription'),
              // Feature cards
              featureCards: {
                newsroom: {
                  title: tFeatures('newsroom.title'),
                  description: tFeatures('newsroom.description'),
                },
                alliance: {
                  title: tFeatures('alliance.title'),
                  description: tFeatures('alliance.description'),
                },
                join: {
                  title: tFeatures('join.title'),
                  description: tFeatures('join.description'),
                },
                verify: {
                  title: tFeatures('verify.title'),
                  description: tFeatures('verify.description'),
                },
              },
              // Position
              positionTitle: t('position.title'),
              positionShares: t('position.shares'),
              positionValue: t('position.value'),
              positionContributed: t('position.contributed'),
              positionTier: t('position.tier'),
              // Actions
              contributeMore: t('actions.contribute'),
              requestWithdraw: t('actions.withdraw'),
              // Withdrawals
              withdrawalsTitle: t('withdrawals.title'),
              noWithdrawals: t('withdrawals.noWithdrawals'),
              withdrawalStatus: t('withdrawals.status'),
              withdrawalShares: t('withdrawals.shares'),
              withdrawalRequestedAt: t('withdrawals.requestedAt'),
              withdrawalAvailableAt: t('withdrawals.availableAt'),
              withdrawalComplete: t('withdrawals.complete'),
              withdrawalCancel: t('withdrawals.cancel'),
              withdrawalReady: t('withdrawals.ready'),
              // Stats
              statsTitle: t('stats.title'),
              statsTvl: t('stats.tvl'),
              statsContributors: t('stats.contributors'),
              statsOutlets: t('stats.outlets'),
              statsDistributed: t('stats.distributed'),
              // Withdraw modal
              withdrawTitle: t('withdraw.title'),
              withdrawDescription: t('withdraw.description'),
              withdrawSharesLabel: t('withdraw.sharesLabel'),
              withdrawEstimatedValue: t('withdraw.estimatedValue'),
              withdrawCooldownNote: t('withdraw.cooldownNote'),
              withdrawSubmit: t('withdraw.submit'),
              withdrawSubmitting: t('withdraw.submitting'),
              withdrawCancel: t('withdraw.cancel'),
              // Tiers
              tierNone: 'No Tier',
              tierSpark: 'Spark',
              tierFlame: 'Flame',
              tierBeacon: 'Beacon',
              tierLighthouse: 'Lighthouse',
            }}
          />
        </div>
      </section>
    </main>
  );
}
