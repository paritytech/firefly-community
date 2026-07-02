/**
 * Verify page — Entry point for identity verification.
 *
 * Multi-step flow that guides users through DIM verification:
 * 1. Check eligibility
 * 2. Sign attestation message
 * 3. Wait for on-chain attestation
 * 4. Success confirmation
 *
 * The wallet is provided by the host (see SignerContext) — there is no wallet-connection step.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { VerifyFlow } from './VerifyFlow';

interface VerifyPageProps {
  params: Promise<{ locale: string }>;
}

export default async function VerifyPage({ params }: VerifyPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('verify');

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
          <VerifyFlow
            translations={{
              // Step titles
              stepEligibility: t('steps.eligibility'),
              stepSign: t('steps.sign'),
              stepPending: t('steps.pending'),
              stepSuccess: t('steps.success'),

              // Eligibility
              eligibilityTitle: t('eligibility.title'),
              eligibilityDescription: t('eligibility.description'),
              eligibilityChecking: t('eligibility.checking'),
              eligibilityEligible: t('eligibility.eligible'),
              eligibilityNotEligible: t('eligibility.notEligible'),
              eligibilityAlreadyVerified: t('eligibility.alreadyVerified'),
              eligibilityReason: t('eligibility.reason'),

              // Step 3: Sign
              signTitle: t('sign.title'),
              signDescription: t('sign.description'),
              signMessage: t('sign.message'),
              signButton: t('sign.button'),
              signPending: t('sign.pending'),
              signUnavailableTitle: t('sign.unavailableTitle'),
              signUnavailableDescription: t('sign.unavailableDescription'),
              signSignatureCaptured: t('sign.signatureCaptured'),

              // Step 4: Pending
              pendingTitle: t('pending.title'),
              pendingDescription: t('pending.description'),
              pendingWaiting: t('pending.waiting'),
              pendingNote: t('pending.note'),

              // Step 5: Success
              successTitle: t('success.title'),
              successDescription: t('success.description'),
              successLevel: t('success.level'),
              successCapabilities: t('success.capabilities'),
              successGoToDashboard: t('success.goToDashboard'),
              successExplore: t('success.explore'),

              // Capabilities
              capIlluminate: t('capabilities.illuminate'),
              capCorroborate: t('capabilities.corroborate'),
              capChallenge: t('capabilities.challenge'),
              capFundBounty: t('capabilities.fundBounty'),
              capClaimPayout: t('capabilities.claimPayout'),
              capReceiveCoinage: t('capabilities.receiveCoinage'),

              // Navigation
              back: t('nav.back'),
              next: t('nav.next'),
              cancel: t('nav.cancel'),

              // Errors
              errorWalletNotConnected: t('errors.walletNotConnected'),
              errorSigningFailed: t('errors.signingFailed'),
              errorAttestationFailed: t('errors.attestationFailed'),
              errorUnknown: t('errors.unknown'),

              // What is verification
              whatIsTitle: t('whatIs.title'),
              whatIsDescription: t('whatIs.description'),
              whatIsBenefit1: t('whatIs.benefit1'),
              whatIsBenefit2: t('whatIs.benefit2'),
              whatIsBenefit3: t('whatIs.benefit3'),
              whatIsPrivacy: t('whatIs.privacy'),
            }}
          />
        </div>
      </section>
    </main>
  );
}
