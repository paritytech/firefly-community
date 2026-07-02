'use client';

/**
 * JoinFlow — Multi-step flow for joining the Firefly Alliance.
 *
 * Handles the onboarding flow:
 * 1. Verify personhood (optional but recommended)
 * 2. Choose contribution amount with tier preview
 * 3. Review and confirm transaction
 *
 * The wallet is provided by the host (see SignerContext) — there is no wallet-connection step.
 */

import type { ReactElement } from 'react';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ContributorTier } from '@cocuyo/types';
import { getTierForAmount, createPUSDAmount, MIN_CONTRIBUTION } from '@cocuyo/types';
import { useSigner } from '@/hooks';
import { crowdstackingService } from '@/lib/services/crowdstacking-service';
import { personhoodService } from '@/lib/services/service-instances';
import { createCredentialForAccount } from '@/lib/services/chain-personhood-service';
import { StepPersonhood } from './steps/StepPersonhood';
import { StepAmount } from './steps/StepAmount';
import { StepConfirm } from './steps/StepConfirm';
import { TierPreview } from './components/TierPreview';

interface JoinFlowTranslations {
  // Step titles
  stepPersonhood: string;
  stepAmount: string;
  stepConfirm: string;

  // Personhood
  personhoodTitle: string;
  personhoodDescription: string;
  personhoodVerified: string;
  personhoodVerify: string;
  personhoodSkip: string;
  personhoodSkipNote: string;

  // Amount
  amountTitle: string;
  amountDescription: string;
  amountLabel: string;
  amountMinimum: string;
  amountCustom: string;
  amountPlaceholder: string;

  // Confirm
  confirmTitle: string;
  confirmDescription: string;
  confirmAmount: string;
  confirmTier: string;
  confirmShares: string;
  confirmNote: string;
  confirmCooldownWarning: string;
  confirmButton: string;
  confirming: string;

  // Tier names
  tierNone: string;
  tierSpark: string;
  tierFlame: string;
  tierBeacon: string;
  tierLighthouse: string;

  // Tier descriptions
  tierSparkDesc: string;
  tierFlameDesc: string;
  tierBeaconDesc: string;
  tierLighthouseDesc: string;

  // Navigation
  back: string;
  next: string;
  cancel: string;

  // Errors
  errorBelowMinimum: string;
  errorInvalidAmount: string;
  errorWalletNotConnected: string;
  errorTransactionFailed: string;

  // Benefits
  benefitsTitle: string;
  benefitGovernance: string;
  benefitRewards: string;
  benefitRecognition: string;
  benefitImpact: string;
}

export interface JoinFlowProps {
  translations: JoinFlowTranslations;
}

type JoinStep = 'personhood' | 'amount' | 'confirm';

const STEP_ORDER: JoinStep[] = ['personhood', 'amount', 'confirm'];

// Preset contribution amounts in cents (pUSD has 6 decimals but we work in cents for display)
const PRESET_AMOUNTS = [
  { label: '$5', cents: 500 },
  { label: '$25', cents: 2500 },
  { label: '$100', cents: 10000 },
  { label: '$500', cents: 50000 },
];

export function JoinFlow({ translations: t }: JoinFlowProps): ReactElement {
  const router = useRouter();
  const { isConnected, selectedAccount } = useSigner();

  // Flow state
  const [currentStep, setCurrentStep] = useState<JoinStep>('personhood');
  const [amountCents, setAmountCents] = useState<number>(500); // Default to $5
  const [isPersonhoodVerified, setIsPersonhoodVerified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate tier based on amount
  const selectedTier = useMemo<ContributorTier>(() => {
    return getTierForAmount(amountCents);
  }, [amountCents]);

  // Get tier display name
  const getTierName = useCallback(
    (tier: ContributorTier): string => {
      switch (tier) {
        case 'spark':
          return t.tierSpark;
        case 'flame':
          return t.tierFlame;
        case 'beacon':
          return t.tierBeacon;
        case 'lighthouse':
          return t.tierLighthouse;
        default:
          return t.tierNone;
      }
    },
    [t]
  );

  // Get tier description
  const getTierDescription = useCallback(
    (tier: ContributorTier): string => {
      switch (tier) {
        case 'spark':
          return t.tierSparkDesc;
        case 'flame':
          return t.tierFlameDesc;
        case 'beacon':
          return t.tierBeaconDesc;
        case 'lighthouse':
          return t.tierLighthouseDesc;
        default:
          return '';
      }
    },
    [t]
  );

  // Check personhood status using the host-provided account
  const checkPersonhood = useCallback(async () => {
    if (selectedAccount?.address == null || selectedAccount.address === '') return;

    try {
      const credential = createCredentialForAccount(selectedAccount.address);
      const level = await personhoodService.getLevel(credential);
      setIsPersonhoodVerified(level !== 'none');
    } catch {
      // If check fails, assume not verified
      setIsPersonhoodVerified(false);
    }
  }, [selectedAccount?.address]);

  // Navigation handlers
  const goToStep = useCallback((step: JoinStep) => {
    setError(null);
    setCurrentStep(step);
  }, []);

  const goBack = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    const previousStep = currentIndex > 0 ? STEP_ORDER[currentIndex - 1] : undefined;
    if (previousStep !== undefined) {
      goToStep(previousStep);
    }
  }, [currentStep, goToStep]);

  const goNext = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    const nextStep =
      currentIndex < STEP_ORDER.length - 1 ? STEP_ORDER[currentIndex + 1] : undefined;
    if (nextStep !== undefined) {
      goToStep(nextStep);
    }
  }, [currentStep, goToStep]);

  // The wallet is provided by the host (see SignerContext); check personhood as soon as the
  // host account is available rather than after a manual connect step.
  useEffect(() => {
    void checkPersonhood();
  }, [checkPersonhood]);

  // Handle personhood verification
  const handlePersonhoodVerified = useCallback(() => {
    setIsPersonhoodVerified(true);
    goNext();
  }, [goNext]);

  const handleSkipPersonhood = useCallback(() => {
    goNext();
  }, [goNext]);

  // Handle amount selection
  const handleAmountChange = useCallback((cents: number) => {
    setAmountCents(cents);
    setError(null);
  }, []);

  const validateAmount = useCallback((): boolean => {
    const minCents = Number(MIN_CONTRIBUTION / 10000n); // Convert from 6 decimals to cents
    if (amountCents < minCents) {
      setError(t.errorBelowMinimum);
      return false;
    }
    return true;
  }, [amountCents, t]);

  const handleAmountConfirm = useCallback(() => {
    if (validateAmount()) {
      goNext();
    }
  }, [validateAmount, goNext]);

  // Handle contribution submission
  const handleSubmit = useCallback(async () => {
    if (!isConnected) {
      setError(t.errorWalletNotConnected);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Convert cents to PUSDAmount (6 decimals)
      // cents * 10000 = 6 decimal places
      const amountBigInt = BigInt(amountCents) * 10000n;
      const amount = createPUSDAmount(amountBigInt);

      const result = await crowdstackingService.contribute(amount);

      if (result.ok) {
        // Store success data in sessionStorage for the welcome page
        sessionStorage.setItem(
          'joinSuccess',
          JSON.stringify({
            txHash: result.value.txHash,
            shares: result.value.shares.toString(),
            amountCents,
            tier: selectedTier,
          })
        );
        router.push('/join/welcome');
      } else {
        switch (result.error.type) {
          case 'WALLET_NOT_CONNECTED':
            setError(t.errorWalletNotConnected);
            break;
          case 'BELOW_MINIMUM':
            setError(t.errorBelowMinimum);
            break;
          default:
            setError(t.errorTransactionFailed);
        }
      }
    } catch {
      setError(t.errorTransactionFailed);
    } finally {
      setIsSubmitting(false);
    }
  }, [isConnected, amountCents, selectedTier, router, t]);

  // Progress indicator
  const stepIndex = STEP_ORDER.indexOf(currentStep);
  const progressPercent = ((stepIndex + 1) / STEP_ORDER.length) * 100;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="mb-2 flex justify-between text-sm text-[var(--fg-tertiary)]">
          {STEP_ORDER.map((step, index) => {
            const stepLabels: Record<JoinStep, string> = {
              personhood: t.stepPersonhood,
              amount: t.stepAmount,
              confirm: t.stepConfirm,
            };
            const isActive = index <= stepIndex;
            return (
              <span key={step} className={isActive ? 'text-[var(--color-firefly-gold)]' : ''}>
                {stepLabels[step]}
              </span>
            );
          })}
        </div>
        <div className="h-1 w-full rounded-full bg-[var(--bg-surface-container)]">
          <div
            className="h-1 rounded-full bg-[var(--color-firefly-gold)] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Error message */}
          {error != null && error !== '' && (
            <div className="border-[var(--fg-error)]/30 bg-[var(--fg-error)]/10 mb-4 rounded-nested border p-4">
              <p className="text-sm text-[var(--fg-error)]">{error}</p>
            </div>
          )}

          {/* Step content */}
          {currentStep === 'personhood' && (
            <StepPersonhood
              translations={{
                title: t.personhoodTitle,
                description: t.personhoodDescription,
                verified: t.personhoodVerified,
                verify: t.personhoodVerify,
                skip: t.personhoodSkip,
                skipNote: t.personhoodSkipNote,
              }}
              isVerified={isPersonhoodVerified}
              onVerified={handlePersonhoodVerified}
              onSkip={handleSkipPersonhood}
              onBack={goBack}
            />
          )}

          {currentStep === 'amount' && (
            <StepAmount
              translations={{
                title: t.amountTitle,
                description: t.amountDescription,
                amountLabel: t.amountLabel,
                minimum: t.amountMinimum,
                custom: t.amountCustom,
                placeholder: t.amountPlaceholder,
                back: t.back,
                next: t.next,
              }}
              amountCents={amountCents}
              presetAmounts={PRESET_AMOUNTS}
              onAmountChange={handleAmountChange}
              onNext={handleAmountConfirm}
              onBack={goBack}
            />
          )}

          {currentStep === 'confirm' && (
            <StepConfirm
              translations={{
                title: t.confirmTitle,
                description: t.confirmDescription,
                amount: t.confirmAmount,
                tier: t.confirmTier,
                shares: t.confirmShares,
                note: t.confirmNote,
                cooldownWarning: t.confirmCooldownWarning,
                confirm: t.confirmButton,
                confirming: t.confirming,
                back: t.back,
              }}
              amountCents={amountCents}
              tier={selectedTier}
              tierName={getTierName(selectedTier)}
              isSubmitting={isSubmitting}
              onConfirm={handleSubmit}
              onBack={goBack}
            />
          )}
        </div>

        {/* Sidebar - Tier Preview and Benefits */}
        <aside className="shrink-0 lg:w-80">
          <div className="space-y-6 lg:sticky lg:top-24">
            {/* Tier Preview */}
            <TierPreview
              currentTier={selectedTier}
              amountCents={amountCents}
              translations={{
                tierNone: t.tierNone,
                tierSpark: t.tierSpark,
                tierFlame: t.tierFlame,
                tierBeacon: t.tierBeacon,
                tierLighthouse: t.tierLighthouse,
              }}
              getTierDescription={getTierDescription}
            />

            {/* Benefits */}
            <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
              <h3 className="mb-4 font-medium text-[var(--fg-primary)]">{t.benefitsTitle}</h3>
              <ul className="space-y-3 text-sm text-[var(--fg-secondary)]">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-firefly-gold)]">+</span>
                  {t.benefitGovernance}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-firefly-gold)]">+</span>
                  {t.benefitRewards}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-firefly-gold)]">+</span>
                  {t.benefitRecognition}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--color-firefly-gold)]">+</span>
                  {t.benefitImpact}
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
