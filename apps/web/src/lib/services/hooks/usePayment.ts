'use client';

/**
 * Payment service hooks.
 *
 * Provides React hooks for pUSD balance subscriptions and payment requests.
 * Integrates with wallet state from SignerContext.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PUSDAmount, PolkadotAddress } from '@cocuyo/types';
import { createPolkadotAddress, ZERO_PUSD } from '@cocuyo/types';
import { useSigner } from '@/lib/context/SignerContext';
import {
  getPaymentService,
  type PaymentRequest,
  type PaymentResult,
  type PaymentStatus,
} from '../pusd-payment-service';

// ============================================================
// usePUSDBalance Hook
// ============================================================

/**
 * Return type for usePUSDBalance hook.
 */
export interface UsePUSDBalanceResult {
  /** Current pUSD balance */
  balance: PUSDAmount;
  /** Whether the balance is loading */
  loading: boolean;
  /** Error if balance fetch failed */
  error: Error | null;
  /** Refresh the balance manually */
  refresh: () => void;
}

/**
 * Hook for subscribing to pUSD balance updates.
 *
 * Automatically subscribes to the connected wallet's balance
 * and updates in real-time.
 *
 * @param address - Optional specific address to track (defaults to connected wallet)
 * @returns Balance state with loading and error handling
 *
 * @example
 * ```tsx
 * function BalanceDisplay() {
 *   const { balance, loading, error } = usePUSDBalance();
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return <div>{formatPUSD(balance)}</div>;
 * }
 * ```
 */
export function usePUSDBalance(address?: PolkadotAddress): UsePUSDBalanceResult {
  const { selectedAccount } = useSigner();
  const [balance, setBalance] = useState<PUSDAmount>(ZERO_PUSD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Determine the address to track
  const trackAddress =
    address ?? (selectedAccount ? createPolkadotAddress(selectedAccount.address) : null);

  useEffect(() => {
    if (!trackAddress) {
      setBalance(ZERO_PUSD);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const service = getPaymentService();
    const unsubscribe = service.subscribeBalance(
      trackAddress,
      (newBalance) => {
        setBalance(newBalance);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [trackAddress, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return {
    balance,
    loading,
    error,
    refresh,
  };
}

// ============================================================
// usePaymentRequest Hook
// ============================================================

/**
 * Return type for usePaymentRequest hook.
 */
export interface UsePaymentRequestResult {
  /** Current payment request (if initiated) */
  request: PaymentRequest | null;
  /** Current payment status */
  status: PaymentStatus | null;
  /** Full payment result (includes txHash on success) */
  result: PaymentResult | null;
  /** Whether a payment is being processed */
  loading: boolean;
  /** Error if payment failed */
  error: Error | null;
  /** Initiate a new payment */
  initiatePayment: (to: PolkadotAddress, amount: PUSDAmount, memo?: string) => Promise<void>;
  /** Reset state to initiate a new payment */
  reset: () => void;
  /** Whether wallet is connected */
  isConnected: boolean;
  /** Connected wallet address */
  address: string | undefined;
}

/**
 * Hook for initiating and tracking pUSD payments.
 *
 * Provides payment lifecycle management with status tracking.
 *
 * @returns Payment state with actions for initiating and tracking
 *
 * @example
 * ```tsx
 * function PaymentForm() {
 *   const { initiatePayment, status, result, loading, error, reset } = usePaymentRequest();
 *
 *   const handleSubmit = async (to: PolkadotAddress, amount: PUSDAmount) => {
 *     await initiatePayment(to, amount, 'Payment for services');
 *   };
 *
 *   if (status === 'confirmed') {
 *     return (
 *       <div>
 *         Payment confirmed! Tx: {result?.txHash}
 *         <button onClick={reset}>New Payment</button>
 *       </div>
 *     );
 *   }
 *
 *   return <PaymentFormUI onSubmit={handleSubmit} loading={loading} />;
 * }
 * ```
 */
export function usePaymentRequest(): UsePaymentRequestResult {
  const { selectedAccount, isConnected } = useSigner();
  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track unsubscribe function for cleanup
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Use refs to avoid stale closures
  const accountRef = useRef(selectedAccount);
  accountRef.current = selectedAccount;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  const initiatePayment = useCallback(
    async (to: PolkadotAddress, amount: PUSDAmount, memo?: string): Promise<void> => {
      const account = accountRef.current;
      if (!account) {
        setError(new Error('Wallet not connected'));
        return;
      }

      // Clean up previous subscription
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      setLoading(true);
      setError(null);
      setStatus(null);
      setResult(null);

      try {
        const service = getPaymentService();
        const from = createPolkadotAddress(account.address);
        const paymentRequest = await service.requestPayment(from, to, amount, memo);

        setRequest(paymentRequest);

        // Subscribe to status updates
        const unsubscribe = service.subscribePaymentStatus(
          paymentRequest.id,
          (paymentResult) => {
            setStatus(paymentResult.status);
            setResult(paymentResult);

            // Mark as not loading once we get a final status
            if (
              paymentResult.status === 'confirmed' ||
              paymentResult.status === 'failed' ||
              paymentResult.status === 'expired'
            ) {
              setLoading(false);
              if (paymentResult.status === 'failed') {
                setError(new Error(paymentResult.error ?? 'Payment failed'));
              }
            }
          },
          (err) => {
            setError(err);
            setLoading(false);
          }
        );

        unsubscribeRef.current = unsubscribe;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    // Clean up subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    setRequest(null);
    setStatus(null);
    setResult(null);
    setLoading(false);
    setError(null);
  }, []);

  return {
    request,
    status,
    result,
    loading,
    error,
    initiatePayment,
    reset,
    isConnected,
    address: selectedAccount?.address,
  };
}

// ============================================================
// usePaymentStatus Hook (Standalone)
// ============================================================

/**
 * Return type for usePaymentStatus hook.
 */
export interface UsePaymentStatusResult {
  /** Current payment status */
  status: PaymentStatus | null;
  /** Full payment result */
  result: PaymentResult | null;
  /** Error if subscription failed */
  error: Error | null;
}

/**
 * Hook for tracking the status of an existing payment request.
 *
 * Useful when you need to track a payment initiated elsewhere.
 *
 * @param requestId - The payment request ID to track
 * @returns Payment status state
 */
export function usePaymentStatus(requestId: string | null): UsePaymentStatusResult {
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (requestId === null || requestId === '') {
      setStatus(null);
      setResult(null);
      setError(null);
      return;
    }

    const service = getPaymentService();
    const unsubscribe = service.subscribePaymentStatus(
      requestId,
      (paymentResult) => {
        setStatus(paymentResult.status);
        setResult(paymentResult);
      },
      (err) => {
        setError(err);
      }
    );

    return unsubscribe;
  }, [requestId]);

  return {
    status,
    result,
    error,
  };
}
