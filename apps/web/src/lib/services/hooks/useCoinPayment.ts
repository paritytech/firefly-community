/**
 * useCoinPayment Hook
 *
 * React hook for CoinPayment service with integrated host state.
 * Provides purse management operations with proper loading/error states.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSigner } from '../../context/SignerContext';
import { isInContainer } from '../../host/detect';
import { createCoinPaymentService, isCoinPaymentAvailable } from '../coin-payment-service';
import type {
  CoinPaymentService,
  CoinPaymentPurseId,
  CoinPaymentPurseInfo,
  CoinPaymentBalance,
  CoinPaymentReceivable,
  CoinPaymentCheque,
  CoinPaymentStatus,
  CoinPaymentError,
} from '@cocuyo/types';

/** Result type for hook operations */
export interface CoinPaymentOperationResult<T> {
  readonly ok: boolean;
  readonly value?: T;
  readonly error?: CoinPaymentError;
}

/** Return type for useCoinPayment hook */
export interface UseCoinPaymentResult {
  /** Whether the service is available (host connected or mock mode) */
  readonly isAvailable: boolean;
  /** Whether currently in host environment */
  readonly isInContainer: boolean;
  /** List of user's purses */
  readonly purses: readonly CoinPaymentPurseInfo[];
  /** Whether purses are currently loading */
  readonly loading: boolean;
  /** Current error state */
  readonly error: CoinPaymentError | null;

  /** Refresh purse list */
  readonly refreshPurses: () => Promise<void>;
  /** Create a new purse */
  readonly createPurse: (name: string) => Promise<CoinPaymentOperationResult<CoinPaymentPurseId>>;
  /** Query a specific purse */
  readonly queryPurse: (
    purse: CoinPaymentPurseId
  ) => Promise<CoinPaymentOperationResult<CoinPaymentPurseInfo>>;
  /** Rebalance between purses (returns async iterator for progress) */
  readonly rebalancePurse: (
    from: CoinPaymentPurseId,
    to: CoinPaymentPurseId,
    amount: CoinPaymentBalance
  ) => AsyncIterable<CoinPaymentStatus>;
  /** Delete a purse, draining to another */
  readonly deletePurse: (
    target: CoinPaymentPurseId,
    drainInto: CoinPaymentPurseId
  ) => AsyncIterable<CoinPaymentStatus>;
  /** Create a receivable address */
  readonly createReceivable: (
    intoPurse: CoinPaymentPurseId
  ) => Promise<CoinPaymentOperationResult<CoinPaymentReceivable>>;
  /** Create a cheque for payment */
  readonly createCheque: (
    from: CoinPaymentPurseId,
    to: CoinPaymentReceivable,
    amount: CoinPaymentBalance
  ) => Promise<CoinPaymentOperationResult<CoinPaymentCheque>>;
  /** Deposit a cheque */
  readonly deposit: (cheque: CoinPaymentCheque) => AsyncIterable<CoinPaymentStatus>;
  /** Refund a receivable */
  readonly refund: (receivable: CoinPaymentReceivable) => AsyncIterable<CoinPaymentStatus>;
}

/**
 * Hook for CoinPayment service operations.
 *
 * Provides a React-friendly interface to the CoinPayment service with:
 * - Automatic service selection (host vs mock)
 * - Loading and error state management
 * - Purse list caching with manual refresh
 */
export function useCoinPayment(): UseCoinPaymentResult {
  const { isConnected } = useSigner();
  const [purses, setPurses] = useState<readonly CoinPaymentPurseInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CoinPaymentError | null>(null);

  const inHost = isInContainer();
  const isAvailable = useMemo(() => {
    // In host mode, need to be connected and have capability
    if (inHost) {
      return isConnected && isCoinPaymentAvailable();
    }
    // Mock mode is always available
    return true;
  }, [inHost, isConnected]);

  // Get service instance (memoized)
  const service = useMemo((): CoinPaymentService | null => {
    if (!isAvailable) return null;
    return createCoinPaymentService();
  }, [isAvailable]);

  // Load purses on mount and when service becomes available
  useEffect(() => {
    if (!service) {
      setPurses([]);
      return;
    }

    const loadPurses = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const result = await service.listPurses();
        if (result.ok) {
          setPurses(result.value);
        } else {
          setError(result.error);
        }
      } finally {
        setLoading(false);
      }
    };

    void loadPurses();
  }, [service]);

  const refreshPurses = useCallback(async () => {
    if (!service) return;
    setLoading(true);
    setError(null);
    try {
      const result = await service.listPurses();
      if (result.ok) {
        setPurses(result.value);
      } else {
        setError(result.error);
      }
    } finally {
      setLoading(false);
    }
  }, [service]);

  const createPurse = useCallback(
    async (name: string): Promise<CoinPaymentOperationResult<CoinPaymentPurseId>> => {
      if (!service) {
        return { ok: false, error: { type: 'UserAgentCapabilityUnavailable' } };
      }
      const result = await service.createPurse(name);
      if (result.ok) {
        // Refresh purses after creation
        void refreshPurses();
        return { ok: true, value: result.value };
      }
      return { ok: false, error: result.error };
    },
    [service, refreshPurses]
  );

  const queryPurse = useCallback(
    async (
      purse: CoinPaymentPurseId
    ): Promise<CoinPaymentOperationResult<CoinPaymentPurseInfo>> => {
      if (!service) {
        return { ok: false, error: { type: 'UserAgentCapabilityUnavailable' } };
      }
      const result = await service.queryPurse(purse);
      if (result.ok) {
        return { ok: true, value: result.value };
      }
      return { ok: false, error: result.error };
    },
    [service]
  );

  const rebalancePurse = useCallback(
    (
      from: CoinPaymentPurseId,
      to: CoinPaymentPurseId,
      amount: CoinPaymentBalance
    ): AsyncIterable<CoinPaymentStatus> => {
      if (!service) {
        // eslint-disable-next-line @typescript-eslint/require-await -- must return an AsyncIterable to match the hook signature; the fallback yields a synchronous failure with no await
        return (async function* () {
          yield {
            type: 'failed' as const,
            error: { type: 'UserAgentCapabilityUnavailable' as const },
          };
        })();
      }
      return service.rebalancePurse(from, to, amount);
    },
    [service]
  );

  const deletePurse = useCallback(
    (
      target: CoinPaymentPurseId,
      drainInto: CoinPaymentPurseId
    ): AsyncIterable<CoinPaymentStatus> => {
      if (!service) {
        // eslint-disable-next-line @typescript-eslint/require-await -- must return an AsyncIterable to match the hook signature; the fallback yields a synchronous failure with no await
        return (async function* () {
          yield {
            type: 'failed' as const,
            error: { type: 'UserAgentCapabilityUnavailable' as const },
          };
        })();
      }
      return service.deletePurse(target, drainInto);
    },
    [service]
  );

  const createReceivable = useCallback(
    async (
      intoPurse: CoinPaymentPurseId
    ): Promise<CoinPaymentOperationResult<CoinPaymentReceivable>> => {
      if (!service) {
        return { ok: false, error: { type: 'UserAgentCapabilityUnavailable' } };
      }
      const result = await service.createReceivable(intoPurse);
      if (result.ok) {
        return { ok: true, value: result.value };
      }
      return { ok: false, error: result.error };
    },
    [service]
  );

  const createCheque = useCallback(
    async (
      from: CoinPaymentPurseId,
      to: CoinPaymentReceivable,
      amount: CoinPaymentBalance
    ): Promise<CoinPaymentOperationResult<CoinPaymentCheque>> => {
      if (!service) {
        return { ok: false, error: { type: 'UserAgentCapabilityUnavailable' } };
      }
      const result = await service.createCheque(from, to, amount);
      if (result.ok) {
        return { ok: true, value: result.value };
      }
      return { ok: false, error: result.error };
    },
    [service]
  );

  const deposit = useCallback(
    (cheque: CoinPaymentCheque): AsyncIterable<CoinPaymentStatus> => {
      if (!service) {
        // eslint-disable-next-line @typescript-eslint/require-await -- must return an AsyncIterable to match the hook signature; the fallback yields a synchronous failure with no await
        return (async function* () {
          yield {
            type: 'failed' as const,
            error: { type: 'UserAgentCapabilityUnavailable' as const },
          };
        })();
      }
      return service.deposit(cheque);
    },
    [service]
  );

  const refund = useCallback(
    (receivable: CoinPaymentReceivable): AsyncIterable<CoinPaymentStatus> => {
      if (!service) {
        // eslint-disable-next-line @typescript-eslint/require-await -- must return an AsyncIterable to match the hook signature; the fallback yields a synchronous failure with no await
        return (async function* () {
          yield {
            type: 'failed' as const,
            error: { type: 'UserAgentCapabilityUnavailable' as const },
          };
        })();
      }
      return service.refund(receivable);
    },
    [service]
  );

  return {
    isAvailable,
    isInContainer: inHost,
    purses,
    loading,
    error,
    refreshPurses,
    createPurse,
    queryPurse,
    rebalancePurse,
    deletePurse,
    createReceivable,
    createCheque,
    deposit,
    refund,
  };
}
