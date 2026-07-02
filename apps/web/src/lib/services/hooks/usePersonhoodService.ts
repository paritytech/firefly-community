'use client';

/**
 * Personhood service hooks.
 *
 * Provides React hooks for personhood state, capabilities, and attestation status.
 * Integrates with wallet state from SignerContext and the chain-backed PersonhoodService.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  PersonhoodState,
  PersonhoodLevel,
  PersonhoodCapabilities,
  DIMCredential,
  PolkadotAddress,
  AttestationStatus,
  AttestationEligibility,
} from '@cocuyo/types';
import { getCapabilities, createPolkadotAddress } from '@cocuyo/types';
import { useSigner } from '@/lib/context/SignerContext';
import { chainPersonhoodService, createCredentialForAccount } from '../chain-personhood-service';

// ============================================================
// usePersonhood Hook
// ============================================================

/**
 * Return type for usePersonhood hook.
 */
export interface UsePersonhoodResult {
  /** Current personhood state (null if not loaded or no wallet) */
  state: PersonhoodState | null;
  /** Personhood level shorthand (defaults to 'none') */
  level: PersonhoodLevel;
  /** Full capabilities for current level */
  capabilities: PersonhoodCapabilities;
  /** Whether state is loading */
  loading: boolean;
  /** Error if any */
  error: Error | null;
  /** Whether user is verified (lite or full) */
  isVerified: boolean;
  /** The DIM credential (if wallet connected) */
  credential: DIMCredential | null;
  /** Refresh state manually */
  refresh: () => void;
}

/**
 * Hook for accessing personhood state and capabilities.
 *
 * Automatically creates a DIM credential from the connected wallet
 * and subscribes to personhood state changes.
 *
 * @returns Personhood state with loading and error handling
 *
 * @example
 * ```tsx
 * function PersonhoodBadge() {
 *   const { level, isVerified, loading } = usePersonhoodService();
 *
 *   if (loading) return <div>Loading...</div>;
 *
 *   return (
 *     <div className={isVerified ? 'verified' : 'unverified'}>
 *       Level: {level}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePersonhoodService(): UsePersonhoodResult {
  const { selectedAccount } = useSigner();
  const [state, setState] = useState<PersonhoodState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Track cleanup function
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Create credential from connected account
  const credential = useMemo<DIMCredential | null>(() => {
    if (!selectedAccount) {
      return null;
    }
    return createCredentialForAccount(selectedAccount.address);
  }, [selectedAccount]);

  // Subscribe to personhood changes
  useEffect(() => {
    // Clean up previous subscription
    if (unsubscribeRef.current !== null) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (credential === null) {
      setState(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Track this effect instance to prevent stale updates
    let isCurrent = true;
    const currentCredential = credential;

    setLoading(true);
    setError(null);

    // Initial fetch with stale-check
    void (async () => {
      try {
        const personhoodState = await chainPersonhoodService.getPersonhood(currentCredential);
        // Cleanup sets isCurrent=false during await - TS can't track this
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (isCurrent) {
          setState(personhoodState);
          setLoading(false);
        }
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (isCurrent) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    })();

    // Subscribe to changes with stale-check in callback
    const unsubscribe = chainPersonhoodService.subscribePersonhood(
      currentCredential,
      (newState) => {
        if (isCurrent) {
          setState(newState);
          setLoading(false);
          setError(null);
        }
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      isCurrent = false; // Mark this effect as stale
      if (unsubscribeRef.current !== null) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [credential, refreshKey]);

  // Derive level and capabilities
  const level = state?.level ?? 'none';
  const capabilities = useMemo(() => getCapabilities(level), [level]);
  const isVerified = level === 'lite' || level === 'full';

  const refresh = useCallback(() => {
    if (credential !== null) {
      chainPersonhoodService.invalidateCache(credential);
    }
    setRefreshKey((prev) => prev + 1);
  }, [credential]);

  return {
    state,
    level,
    capabilities,
    loading,
    error,
    isVerified,
    credential,
    refresh,
  };
}

// ============================================================
// useAttestationStatus Hook
// ============================================================

/**
 * Return type for useAttestationStatus hook.
 */
export interface UseAttestationStatusResult {
  /** Current attestation status */
  status: AttestationStatus | null;
  /** Whether eligible for attestation */
  canBeAttested: boolean;
  /** Reason if not eligible */
  ineligibleReason: string | undefined;
  /** Loading state */
  loading: boolean;
  /** Error if any */
  error: Error | null;
  /** Refresh status */
  refresh: () => void;
}

/**
 * Hook for checking attestation status and eligibility.
 *
 * Useful for the verification flow UI to determine what actions
 * the user can take.
 *
 * @param address - Optional specific address to check (defaults to connected wallet)
 * @returns Attestation status with eligibility check
 *
 * @example
 * ```tsx
 * function VerificationPage() {
 *   const { status, canBeAttested, ineligibleReason, loading } = useAttestationStatus();
 *
 *   if (loading) return <div>Checking status...</div>;
 *
 *   if (status?.status === 'registered') {
 *     return <div>Already verified!</div>;
 *   }
 *
 *   if (!canBeAttested) {
 *     return <div>Cannot verify: {ineligibleReason}</div>;
 *   }
 *
 *   return <VerificationFlow />;
 * }
 * ```
 */
export function useAttestationStatus(address?: PolkadotAddress): UseAttestationStatusResult {
  const { selectedAccount } = useSigner();
  const [status, setStatus] = useState<AttestationStatus | null>(null);
  const [eligibility, setEligibility] = useState<AttestationEligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Determine address to check
  const checkAddress =
    address ?? (selectedAccount ? createPolkadotAddress(selectedAccount.address) : null);

  useEffect(() => {
    if (checkAddress === null) {
      setStatus(null);
      setEligibility(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Track this effect instance to prevent stale updates
    let isCurrent = true;
    const currentAddress = checkAddress;

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        // Fetch both status and eligibility in parallel
        const [attestationStatus, attestationEligibility] = await Promise.all([
          chainPersonhoodService.getAttestationStatus(currentAddress),
          chainPersonhoodService.canBeAttested(currentAddress),
        ]);

        // Cleanup sets isCurrent=false during await - TS can't track this
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (isCurrent) {
          setStatus(attestationStatus);
          setEligibility(attestationEligibility);
          setLoading(false);
        }
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (isCurrent) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    })();

    return () => {
      isCurrent = false; // Mark this effect as stale
    };
  }, [checkAddress, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return {
    status,
    canBeAttested: eligibility?.eligible ?? false,
    ineligibleReason: eligibility?.reason,
    loading,
    error,
    refresh,
  };
}

// ============================================================
// usePersonhoodCapabilities Hook
// ============================================================

/**
 * Return type for usePersonhoodCapabilities hook.
 */
export interface UsePersonhoodCapabilitiesResult {
  /** Current capabilities */
  capabilities: PersonhoodCapabilities;
  /** Whether user can illuminate (create posts) */
  canIlluminate: boolean;
  /** Whether user can corroborate */
  canCorroborate: boolean;
  /** Whether user can challenge */
  canChallenge: boolean;
  /** Whether user can fund bounties */
  canFundBounty: boolean;
  /** Whether user can claim payouts */
  canClaimPayout: boolean;
  /** Whether user can receive private payments */
  canReceiveCoinage: boolean;
  /** Loading state */
  loading: boolean;
}

/**
 * Hook for checking specific personhood capabilities.
 *
 * Convenience hook that extracts common capability checks.
 *
 * @returns Individual capability flags
 *
 * @example
 * ```tsx
 * function IlluminateButton() {
 *   const { canIlluminate, loading } = usePersonhoodCapabilities();
 *
 *   return (
 *     <button disabled={!canIlluminate || loading}>
 *       Illuminate
 *     </button>
 *   );
 * }
 * ```
 */
export function usePersonhoodCapabilities(): UsePersonhoodCapabilitiesResult {
  const { capabilities, loading } = usePersonhoodService();

  return {
    capabilities,
    canIlluminate: capabilities.canIlluminate,
    canCorroborate: capabilities.canCorroborate,
    canChallenge: capabilities.canChallenge,
    canFundBounty: capabilities.canFundBounty,
    canClaimPayout: capabilities.canClaimPayout,
    canReceiveCoinage: capabilities.canReceiveCoinage,
    loading,
  };
}
