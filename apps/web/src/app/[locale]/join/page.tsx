/**
 * Join page — Entry point for contributing to the Firefly Alliance.
 *
 * Multi-step flow that guides users through:
 * 1. Verify personhood (if needed)
 * 2. Choose contribution amount
 * 3. Review and confirm
 *
 * The wallet is provided by the host (see SignerContext) — there is no wallet-connection step.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JoinFlow } from './JoinFlow';

interface JoinPageProps {
  params: Promise<{ locale: string }>;
}

export default async function JoinPage({ params }: JoinPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('join');

  return (
    <main className="min-h-screen">
      {/* Hero header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="container-wide py-12 text-center">
          <h1 className="mb-4 font-display text-3xl font-medium text-[var(--fg-primary)] md:text-4xl">
            {t('title')}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-[var(--fg-secondary)]">{t('subtitle')}</p>
        </div>
      </header>

      {/* Main content */}
      <section className="py-12">
        <div className="container-wide">
          <JoinFlow
            translations={{
              // Step titles
              stepPersonhood: t('steps.personhood'),
              stepAmount: t('steps.amount'),
              stepConfirm: t('steps.confirm'),

              // Personhood
              personhoodTitle: t('personhood.title'),
              personhoodDescription: t('personhood.description'),
              personhoodVerified: t('personhood.verified'),
              personhoodVerify: t('personhood.verify'),
              personhoodSkip: t('personhood.skip'),
              personhoodSkipNote: t('personhood.skipNote'),

              // Step 3: Amount
              amountTitle: t('amount.title'),
              amountDescription: t('amount.description'),
              amountLabel: t('amount.label'),
              amountMinimum: t('amount.minimum'),
              amountCustom: t('amount.custom'),
              amountPlaceholder: t('amount.placeholder'),

              // Step 4: Confirm
              confirmTitle: t('confirm.title'),
              confirmDescription: t('confirm.description'),
              confirmAmount: t('confirm.amount'),
              confirmTier: t('confirm.tier'),
              confirmShares: t('confirm.shares'),
              confirmNote: t('confirm.note'),
              confirmCooldownWarning: t('confirm.cooldownWarning'),
              confirmButton: t('confirm.button'),
              confirming: t('confirm.confirming'),

              // Tier names
              tierNone: t('tiers.none'),
              tierSpark: t('tiers.spark'),
              tierFlame: t('tiers.flame'),
              tierBeacon: t('tiers.beacon'),
              tierLighthouse: t('tiers.lighthouse'),

              // Tier descriptions
              tierSparkDesc: t('tiers.sparkDesc'),
              tierFlameDesc: t('tiers.flameDesc'),
              tierBeaconDesc: t('tiers.beaconDesc'),
              tierLighthouseDesc: t('tiers.lighthouseDesc'),

              // Navigation
              back: t('nav.back'),
              next: t('nav.next'),
              cancel: t('nav.cancel'),

              // Errors
              errorBelowMinimum: t('errors.belowMinimum'),
              errorInvalidAmount: t('errors.invalidAmount'),
              errorWalletNotConnected: t('errors.walletNotConnected'),
              errorTransactionFailed: t('errors.transactionFailed'),

              // Benefits
              benefitsTitle: t('benefits.title'),
              benefitGovernance: t('benefits.governance'),
              benefitRewards: t('benefits.rewards'),
              benefitRecognition: t('benefits.recognition'),
              benefitImpact: t('benefits.impact'),
            }}
          />
        </div>
      </section>
    </main>
  );
}
