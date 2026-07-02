'use client';

/**
 * Crowdstacking service hook.
 *
 * Provides wallet-integrated access to the crowdstacking pool.
 * Handles contribution, withdrawal, and position queries with
 * automatic wallet state management.
 */

import { useCallback } from 'react';
import type {
  PoolState,
  PoolStats,
  ContributorPosition,
  WithdrawalRequest,
  WithdrawalRequestId,
  PUSDAmount,
  PolkadotAddress,
  TransactionHash,
  Result,
} from '@cocuyo/types';
import { err, createPolkadotAddress } from '@cocuyo/types';
import { crowdstackingService, type CrowdstackingError } from '../crowdstacking-service';
import { setConnectedWallet } from '../service-utils';
import { useServiceWithWallet } from './useServiceWithWallet';

/**
 * Crowdstacking service interface for hooks.
 */
export interface CrowdstackingHookService {
  /** Get the current state of the pool */
  getPoolState(): Promise<PoolState | null>;

  /** Get pool statistics */
  getPoolStats(): Promise<PoolStats | null>;

  /** Get the connected user's position */
  getMyPosition(): Promise<ContributorPosition | null>;

  /** Get a specific address's position */
  getPosition(address: PolkadotAddress): Promise<ContributorPosition | null>;

  /** Contribute pUSD to the pool */
  contribute(
    amount: PUSDAmount
  ): Promise<Result<{ txHash: TransactionHash; shares: bigint }, CrowdstackingError>>;

  /** Request a withdrawal (starts cooldown) */
  requestWithdrawal(
    shares: bigint
  ): Promise<Result<{ requestId: WithdrawalRequestId }, CrowdstackingError>>;

  /** Complete a withdrawal after cooldown */
  completeWithdrawal(
    requestId: WithdrawalRequestId
  ): Promise<Result<{ assets: PUSDAmount }, CrowdstackingError>>;

  /** Cancel a pending withdrawal */
  cancelWithdrawal(requestId: WithdrawalRequestId): Promise<Result<void, CrowdstackingError>>;

  /** Get the connected user's withdrawal requests */
  getMyWithdrawalRequests(): Promise<readonly WithdrawalRequest[]>;

  /** Get withdrawal requests for a specific address */
  getWithdrawalRequests(address: PolkadotAddress): Promise<readonly WithdrawalRequest[]>;

  /** Get a specific withdrawal request */
  getWithdrawalRequest(requestId: WithdrawalRequestId): Promise<WithdrawalRequest | null>;

  /** Whether the user's wallet is connected */
  isConnected: boolean;

  /** The connected wallet address (if any) */
  address: string | undefined;
}

/**
 * Hook providing crowdstacking service operations.
 *
 * All write operations require a connected wallet and will fail
 * with WALLET_NOT_CONNECTED if no wallet is connected.
 */
export function useCrowdstackingService(): CrowdstackingHookService {
  const { accountRef, connectedRef, isConnected, address } = useServiceWithWallet({
    clearOnDisconnect: true,
  });

  // Read operations - delegate directly to singleton
  const getPoolState = useCallback(async (): Promise<PoolState | null> => {
    return crowdstackingService.getPoolState();
  }, []);

  const getPoolStats = useCallback(async (): Promise<PoolStats | null> => {
    return crowdstackingService.getPoolStats();
  }, []);

  const getPosition = useCallback(
    async (address: PolkadotAddress): Promise<ContributorPosition | null> => {
      return crowdstackingService.getPosition(address);
    },
    []
  );

  const getMyPosition = useCallback(async (): Promise<ContributorPosition | null> => {
    const account = accountRef.current;
    if (!account) return null;

    const address = createPolkadotAddress(account.address);
    return crowdstackingService.getPosition(address);
  }, []);

  const getWithdrawalRequests = useCallback(
    async (address: PolkadotAddress): Promise<readonly WithdrawalRequest[]> => {
      return crowdstackingService.getWithdrawalRequests(address);
    },
    []
  );

  const getMyWithdrawalRequests = useCallback(async (): Promise<readonly WithdrawalRequest[]> => {
    const account = accountRef.current;
    if (!account) return [];

    const address = createPolkadotAddress(account.address);
    return crowdstackingService.getWithdrawalRequests(address);
  }, []);

  const getWithdrawalRequest = useCallback(
    async (requestId: WithdrawalRequestId): Promise<WithdrawalRequest | null> => {
      return crowdstackingService.getWithdrawalRequest(requestId);
    },
    []
  );

  // Write operations - require connected wallet
  const contribute = useCallback(
    async (
      amount: PUSDAmount
    ): Promise<Result<{ txHash: TransactionHash; shares: bigint }, CrowdstackingError>> => {
      const account = accountRef.current;
      const connected = connectedRef.current;

      if (!connected || !account) {
        return err({ type: 'WALLET_NOT_CONNECTED' });
      }

      // Sync wallet state to singleton
      setConnectedWallet(account.address);

      return crowdstackingService.contribute(amount);
    },
    []
  );

  const requestWithdrawal = useCallback(
    async (
      shares: bigint
    ): Promise<Result<{ requestId: WithdrawalRequestId }, CrowdstackingError>> => {
      const account = accountRef.current;
      const connected = connectedRef.current;

      if (!connected || !account) {
        return err({ type: 'WALLET_NOT_CONNECTED' });
      }

      setConnectedWallet(account.address);
      return crowdstackingService.requestWithdrawal(shares);
    },
    []
  );

  const completeWithdrawal = useCallback(
    async (
      requestId: WithdrawalRequestId
    ): Promise<Result<{ assets: PUSDAmount }, CrowdstackingError>> => {
      const account = accountRef.current;
      const connected = connectedRef.current;

      if (!connected || !account) {
        return err({ type: 'WALLET_NOT_CONNECTED' });
      }

      setConnectedWallet(account.address);
      return crowdstackingService.completeWithdrawal(requestId);
    },
    []
  );

  const cancelWithdrawal = useCallback(
    async (requestId: WithdrawalRequestId): Promise<Result<void, CrowdstackingError>> => {
      const account = accountRef.current;
      const connected = connectedRef.current;

      if (!connected || !account) {
        return err({ type: 'WALLET_NOT_CONNECTED' });
      }

      setConnectedWallet(account.address);
      return crowdstackingService.cancelWithdrawal(requestId);
    },
    []
  );

  return {
    getPoolState,
    getPoolStats,
    getMyPosition,
    getPosition,
    contribute,
    requestWithdrawal,
    completeWithdrawal,
    cancelWithdrawal,
    getMyWithdrawalRequests,
    getWithdrawalRequests,
    getWithdrawalRequest,
    isConnected,
    address,
  };
}
