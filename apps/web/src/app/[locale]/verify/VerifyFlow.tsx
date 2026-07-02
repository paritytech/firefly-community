'use client';

/**
 * VerifyFlow — Client-side multi-step verification flow.
 *
 * Guides users through the DIM verification process:
 * 1. Check eligibility
 * 2. Sign attestation message
 * 3. Wait for attestation
 * 4. Success
 *
 * The wallet is provided by the host (see SignerContext) — there is no wallet-connection step.
 */

import { useState, useCallback, useEffect } from 'react';
import { usePersonhoodService, useAttestationStatus } from '@/lib/services/hooks';
import { VerificationStepper } from './components/VerificationStepper';
import { EligibilityStep } from './components/EligibilityStep';
import { SignStep } from './components/SignStep';
import { PendingStep } from './components/PendingStep';
import { SuccessStep } from './components/SuccessStep';
import { WhatIsVerification } from './components/WhatIsVerification';

interface VerifyFlowTranslations {
  // Step titles
  stepEligibility: string;
  stepSign: string;
  stepPending: string;
  stepSuccess: string;

  // Eligibility
  eligibilityTitle: string;
  eligibilityDescription: string;
  eligibilityChecking: string;
  eligibilityEligible: string;
  eligibilityNotEligible: string;
  eligibilityAlreadyVerified: string;
  eligibilityReason: string;

  // Sign
  signTitle: string;
  signDescription: string;
  signMessage: string;
  signButton: string;
  signPending: string;
  signUnavailableTitle: string;
  signUnavailableDescription: string;
  signSignatureCaptured: string;

  // Pending
  pendingTitle: string;
  pendingDescription: string;
  pendingWaiting: string;
  pendingNote: string;

  // Success
  successTitle: string;
  successDescription: string;
  successLevel: string;
  successCapabilities: string;
  successGoToDashboard: string;
  successExplore: string;

  // Capabilities
  capIlluminate: string;
  capCorroborate: string;
  capChallenge: string;
  capFundBounty: string;
  capClaimPayout: string;
  capReceiveCoinage: string;

  // Navigation
  back: string;
  next: string;
  cancel: string;

  // Errors
  errorWalletNotConnected: string;
  errorSigningFailed: string;
  errorAttestationFailed: string;
  errorUnknown: string;

  // What is verification
  whatIsTitle: string;
  whatIsDescription: string;
  whatIsBenefit1: string;
  whatIsBenefit2: string;
  whatIsBenefit3: string;
  whatIsPrivacy: string;
}

interface VerifyFlowProps {
  translations: VerifyFlowTranslations;
}

type Step = 'eligibility' | 'sign' | 'pending' | 'success';

const STEPS: Step[] = ['eligibility', 'sign', 'pending', 'success'];

export function VerifyFlow({ translations }: VerifyFlowProps): React.ReactElement {
  const { isVerified, level, refresh: refreshPersonhood } = usePersonhoodService();
  const {
    status,
    canBeAttested,
    ineligibleReason,
    loading: statusLoading,
  } = useAttestationStatus();

  const [currentStep, setCurrentStep] = useState<Step>('eligibility');
  const [error, setError] = useState<string | null>(null);

  // Auto-advance based on state. The wallet comes from the host, so there is no connect step to
  // gate on — only jump straight to success when the user is already verified.
  useEffect(() => {
    if (isVerified && currentStep !== 'success') {
      setCurrentStep('success');
    }
  }, [isVerified, currentStep]);

  // Check status when eligibility changes
  useEffect(() => {
    if (currentStep === 'eligibility' && status?.status === 'registered') {
      setCurrentStep('success');
    }
  }, [currentStep, status]);

  const handleNext = useCallback(() => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex < STEPS.length - 1) {
      const nextStep = STEPS[currentIndex + 1];
      if (nextStep !== undefined) {
        setCurrentStep(nextStep);
      }
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      const prevStep = STEPS[currentIndex - 1];
      if (prevStep !== undefined) {
        setCurrentStep(prevStep);
      }
    }
  }, [currentStep]);

  const handleSignComplete = useCallback(() => {
    // Move to pending step after signing
    setCurrentStep('pending');
  }, []);

  const handleAttestationComplete = useCallback(() => {
    // Refresh personhood state and move to success
    refreshPersonhood();
    setCurrentStep('success');
  }, [refreshPersonhood]);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const stepTitles: Record<Step, string> = {
    eligibility: translations.stepEligibility,
    sign: translations.stepSign,
    pending: translations.stepPending,
    success: translations.stepSuccess,
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Stepper */}
      <VerificationStepper steps={STEPS} currentStep={currentStep} stepTitles={stepTitles} />

      {/* Error display */}
      {error !== null && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={clearError}
            className="mt-2 text-xs text-red-400 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Step content */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-6">
        {currentStep === 'eligibility' && (
          <EligibilityStep
            translations={{
              title: translations.eligibilityTitle,
              description: translations.eligibilityDescription,
              checking: translations.eligibilityChecking,
              eligible: translations.eligibilityEligible,
              notEligible: translations.eligibilityNotEligible,
              alreadyVerified: translations.eligibilityAlreadyVerified,
              reason: translations.eligibilityReason,
              next: translations.next,
            }}
            canBeAttested={canBeAttested}
            ineligibleReason={ineligibleReason}
            isVerified={isVerified}
            loading={statusLoading}
            onNext={handleNext}
          />
        )}

        {currentStep === 'sign' && (
          <SignStep
            translations={{
              title: translations.signTitle,
              description: translations.signDescription,
              message: translations.signMessage,
              button: translations.signButton,
              pending: translations.signPending,
              unavailableTitle: translations.signUnavailableTitle,
              unavailableDescription: translations.signUnavailableDescription,
              signatureCaptured: translations.signSignatureCaptured,
              back: translations.back,
            }}
            onComplete={handleSignComplete}
            onBack={handleBack}
            onError={handleError}
          />
        )}

        {currentStep === 'pending' && (
          <PendingStep
            translations={{
              title: translations.pendingTitle,
              description: translations.pendingDescription,
              waiting: translations.pendingWaiting,
              note: translations.pendingNote,
            }}
            onComplete={handleAttestationComplete}
          />
        )}

        {currentStep === 'success' && (
          <SuccessStep
            translations={{
              title: translations.successTitle,
              description: translations.successDescription,
              level: translations.successLevel,
              capabilities: translations.successCapabilities,
              goToDashboard: translations.successGoToDashboard,
              explore: translations.successExplore,
              capIlluminate: translations.capIlluminate,
              capCorroborate: translations.capCorroborate,
              capChallenge: translations.capChallenge,
              capFundBounty: translations.capFundBounty,
              capClaimPayout: translations.capClaimPayout,
              capReceiveCoinage: translations.capReceiveCoinage,
            }}
            level={level}
          />
        )}
      </div>

      {/* What is verification info — shown on the first step */}
      {currentStep === 'eligibility' && (
        <WhatIsVerification
          translations={{
            title: translations.whatIsTitle,
            description: translations.whatIsDescription,
            benefit1: translations.whatIsBenefit1,
            benefit2: translations.whatIsBenefit2,
            benefit3: translations.whatIsBenefit3,
            privacy: translations.whatIsPrivacy,
          }}
        />
      )}
    </div>
  );
}
