/**
 * Alliance Treasury page — Public view of the collective treasury.
 *
 * Shows TVL, contributor tiers, funded outlets, and distribution history.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TreasuryView } from './TreasuryView';

interface TreasuryPageProps {
  params: Promise<{ locale: string }>;
}

export default async function TreasuryPage({ params }: TreasuryPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('alliance.treasury');

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
          <TreasuryView
            translations={{
              tvl: t('tvl'),
              contributors: t('contributors'),
              sharePrice: t('sharePrice'),
              // Outlets
              outletsTitle: t('outlets.title'),
              outletsDescription: t('outlets.description'),
              outletWeight: t('outlets.weight'),
              outletDistributed: t('outlets.distributed'),
              noOutlets: t('outlets.noOutlets'),
              // Distributions
              distributionsTitle: t('distributions.title'),
              distributionsDescription: t('distributions.description'),
              distributionAmount: t('distributions.amount'),
              distributionDate: t('distributions.date'),
              noDistributions: t('distributions.noDistributions'),
              // Tiers
              tiersTitle: t('tiers.title'),
              tierSpark: t('tiers.spark'),
              tierFlame: t('tiers.flame'),
              tierBeacon: t('tiers.beacon'),
              tierLighthouse: t('tiers.lighthouse'),
            }}
          />
        </div>
      </section>
    </main>
  );
}
