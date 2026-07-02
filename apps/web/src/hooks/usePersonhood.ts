'use client';

/**
 * Personhood Hook
 *
 * Provides personhood state and capability checks for the current user.
 * Integrates with wallet state from useSigner.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSigner } from '@/lib/context/SignerContext';
import { personhoodService, isChainPersonhoodService } from '@/lib/services/service-instances';
import { createCredentialForAccount } from '@/lib/services/chain-personhood-service';
import { setPersonhoodLevel as setMockPersonhoodLevel } from '@/lib/services/personhood-service';
import type { PersonhoodLevel, PersonhoodCapabilities, PersonhoodState } from '@cocuyo/types';
import { getCapabilities } from '@cocuyo/types';

/**
 * Personhood state and actions returned by the hook.
 */
export interface PersonhoodInfo {
  /** Current personhood level */
  level: PersonhoodLevel;
  /** Full personhood state */
  state: PersonhoodState | null;
  /** Capabilities at current level */
  capabilities: PersonhoodCapabilities;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Whether verification upgrade is available (false in chain mode) */
  canUpgrade: boolean;

  // Actions
  /** Check if a specific action is allowed */
  canPerform: (
    action: keyof Omit<PersonhoodCapabilities, 'maxBountyFunding' | 'maxBountyClaim'>
  ) => boolean;
  /** Initiate upgrade verification (only available in mock mode) */
  upgradeToFull: () => Promise<void>;
  /** For demos: directly set level (only available in mock mode) */
  setLevel: (level: PersonhoodLevel) => void;
}

/**
 * Hook to access personhood state and capabilities.
 */
export function usePersonhood(): PersonhoodInfo {
  const { selectedAccount, isConnected } = useSigner();
  const [level, setLevelState] = useState<PersonhoodLevel>('none');
  const [state, setState] = useState<PersonhoodState | null>(null);
  const [capabilities, setCapabilities] = useState<PersonhoodCapabilities>(getCapabilities('none'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Check if we're using chain service (verification not available)
  const isChainMode = isChainPersonhoodService();

  // Memoize credential to avoid recreation on every render
  const credential = useMemo(() => {
    if (selectedAccount === null) return null;
    return createCredentialForAccount(selectedAccount.address);
  }, [selectedAccount]);

  // Load personhood state when account changes
  useEffect(() => {
    mountedRef.current = true;
    const isMounted = (): boolean => mountedRef.current;

    async function loadPersonhood(): Promise<void> {
      if (!isConnected || credential === null) {
        setLevelState('none');
        setState(null);
        setCapabilities(getCapabilities('none'));
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const personhoodState = await personhoodService.getPersonhood(credential);

        if (!isMounted()) return;

        if (personhoodState !== null) {
          setLevelState(personhoodState.level);
          setState(personhoodState);
          setCapabilities(getCapabilities(personhoodState.level));
        } else {
          // null means lookup failed or no mapping - show as 'none' with potential error
          setLevelState('none');
          setState(null);
          setCapabilities(getCapabilities('none'));
          // Don't set error for chain mode - lookup failures are transient
        }
      } catch (err) {
        if (!isMounted()) return;
        setError(err instanceof Error ? err.message : 'Failed to load personhood');
        setLevelState('none');
        setState(null);
        setCapabilities(getCapabilities('none'));
      } finally {
        if (isMounted()) {
          setIsLoading(false);
        }
      }
    }

    void loadPersonhood();

    return () => {
      mountedRef.current = false;
    };
  }, [credential, isConnected]);

  const canPerform = useCallback(
    (
      action: keyof Omit<PersonhoodCapabilities, 'maxBountyFunding' | 'maxBountyClaim'>
    ): boolean => {
      return capabilities[action];
    },
    [capabilities]
  );

  const upgradeToFull = useCallback(async (): Promise<void> => {
    if (credential === null) {
      throw new Error('No wallet connected');
    }

    if (isChainMode) {
      throw new Error(
        'Verification upgrade is not available in chain mode. ' +
          'Visit polkadot.network/people to verify your personhood on-chain.'
      );
    }

    // Mock mode: use the verification flow
    const result = await personhoodService.startVerification({
      credential,
      targetLevel: 'full',
    });

    if (!result.ok) {
      const errorMsg =
        result.error.type === 'VERIFICATION_FAILED' ? result.error.reason : result.error.type;
      throw new Error(`Verification failed: ${errorMsg}`);
    }

    // In mock mode, directly complete the verification
    const completeResult = await personhoodService.completeVerification({
      credential,
      verificationToken: 'mock-token',
    });

    if (!completeResult.ok) {
      const errorMsg =
        completeResult.error.type === 'VERIFICATION_FAILED'
          ? completeResult.error.reason
          : completeResult.error.type;
      throw new Error(`Verification failed: ${errorMsg}`);
    }

    // Reload state
    const newState = await personhoodService.getPersonhood(credential);
    if (newState !== null) {
      setLevelState(newState.level);
      setState(newState);
      setCapabilities(getCapabilities(newState.level));
    }
  }, [credential, isChainMode]);

  const setLevel = useCallback(
    (newLevel: PersonhoodLevel): void => {
      if (credential === null) return;

      if (isChainMode) {
        // In chain mode, this is a no-op - level comes from chain
        return;
      }

      // Mock mode: directly set level
      setMockPersonhoodLevel(credential, newLevel);
      setLevelState(newLevel);
      setState({ credential, level: newLevel, verifiedAt: Date.now() });
      setCapabilities(getCapabilities(newLevel));
    },
    [credential, isChainMode]
  );

  return {
    level,
    state,
    capabilities,
    isLoading,
    error,
    // Can upgrade only when: wallet connected, not in chain mode, and not already at full level
    canUpgrade: isConnected && credential !== null && !isChainMode && level !== 'full',
    canPerform,
    upgradeToFull,
    setLevel,
  };
}
