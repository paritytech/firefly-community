'use client';

/**
 * Coinage Service Hook
 *
 * Provides React integration for private payment functionality.
 * Manages wallet state, coin operations, and transfer flows.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Coin,
  CoinWallet,
  CoinExponent,
  RecyclerVoucher,
  RecyclerClaimToken,
  TransferPackage,
  ClaimTokenAllocation,
  CoinageError,
  PUSDAmount,
  PolkadotAddress,
  TransactionHash,
  Result,
} from '@cocuyo/types';
import { err, createEmptyCoinWallet } from '@cocuyo/types';
import { useSigner } from '@/lib/context/SignerContext';
import { getCoinageService } from '../coinage-service';
import { createCredentialForAccount } from '../chain-personhood-service';

// ============================================================
// Types
// ============================================================

export interface UseCoinageResult {
  /** Current coin wallet state */
  wallet: CoinWallet;

  /** Current claim token allocation */
  claimTokens: ClaimTokenAllocation | null;

  /** Whether the service is initializing */
  loading: boolean;

  /** Whether the service is ready to use */
  ready: boolean;

  /** Error if initialization failed */
  error: Error | null;

  /** Whether wallet is connected */
  isConnected: boolean;

  /** Connected wallet address */
  address: string | undefined;

  // Operations

  /** Refresh wallet state from chain */
  refresh: () => Promise<void>;

  /** Onboard pUSD to private coins */
  onboard: (amount: PUSDAmount) => Promise<Result<RecyclerVoucher[], CoinageError>>;

  /** Claim coins from vouchers */
  claimVouchers: (vouchers: readonly RecyclerVoucher[]) => Promise<Result<Coin[], CoinageError>>;

  /** Split a coin into smaller denominations */
  splitCoin: (coin: Coin, into: readonly CoinExponent[]) => Promise<Result<Coin[], CoinageError>>;

  /** Prepare a transfer */
  prepareTransfer: (coins: readonly Coin[], expiresInSeconds?: number) => TransferPackage;

  /** Claim an incoming transfer */
  claimTransfer: (keys: readonly string[]) => Promise<Result<Coin[], CoinageError>>;

  /** Cancel a pending transfer */
  cancelTransfer: (coins: readonly Coin[]) => Promise<Result<Coin[], CoinageError>>;

  /** Recycle coins to reset age */
  recycleCoin: (coins: readonly Coin[]) => Promise<Result<Coin[], CoinageError>>;

  /** Offboard coins to pUSD */
  offboard: (
    coins: readonly Coin[],
    destinationAddress: PolkadotAddress
  ) => Promise<Result<TransactionHash, CoinageError>>;
}

// ============================================================
// Helper
// ============================================================

/**
 * Create a mock RecyclerClaimToken for development.
 * In production, this would be obtained from the DIM service.
 */
function createMockClaimToken(): RecyclerClaimToken {
  return {
    type: 'free_person',
    ringIndex: 0,
    counter: 0,
    period: Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)),
    proof: new Uint8Array(64),
  };
}

// ============================================================
// Hook
// ============================================================

/**
 * Hook for using the coinage (private payment) service.
 *
 * Automatically initializes when a wallet is connected and provides
 * all coin operations with integrated state management.
 *
 * @example
 * ```tsx
 * function WalletPanel() {
 *   const { wallet, onboard, prepareTransfer, ready } = useCoinage();
 *
 *   if (!ready) return <div>Loading wallet...</div>;
 *
 *   return (
 *     <div>
 *       <p>Coins: {wallet.coins.length}</p>
 *       <button onClick={() => onboard(parsePUSD('10'))}>
 *         Onboard $10
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCoinage(): UseCoinageResult {
  const { selectedAccount, isConnected } = useSigner();
  const [wallet, setWallet] = useState<CoinWallet>(createEmptyCoinWallet());
  const [claimTokens, setClaimTokens] = useState<ClaimTokenAllocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const accountRef = useRef(selectedAccount);
  accountRef.current = selectedAccount;

  // Initialize service when account changes
  useEffect(() => {
    if (!selectedAccount) {
      setWallet(createEmptyCoinWallet());
      setClaimTokens(null);
      setReady(false);
      return;
    }

    // Capture address before async to avoid non-null assertion
    const accountAddress = selectedAccount.address;
    let cancelled = false;

    async function initialize(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const credential = createCredentialForAccount(accountAddress);

        // Check if effect was cleaned up during await
        if (cancelled) return;

        const service = getCoinageService();
        const walletState = await service.scanForCoins();
        const tokens = await service.getClaimTokenAllocation(credential);

        // Check again after async operations (cancelled is set by cleanup function)
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (cancelled) return;

        setWallet(walletState);
        setClaimTokens(tokens);
        setReady(true);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [selectedAccount]);

  // Refresh wallet state
  const refresh = useCallback(async (): Promise<void> => {
    if (!ready) return;

    const service = getCoinageService();
    const walletState = await service.scanForCoins();
    setWallet(walletState);
  }, [ready]);

  // Onboard pUSD to coins
  const onboard = useCallback(
    async (amount: PUSDAmount): Promise<Result<RecyclerVoucher[], CoinageError>> => {
      const account = accountRef.current;
      if (!account) {
        return err({ type: 'INSUFFICIENT_COINS', available: 0, required: 1 });
      }

      const service = getCoinageService();
      const result = await service.onboard({
        amount,
        sourceAddress: account.address as PolkadotAddress,
      });

      // Refresh wallet after onboard
      if (result.ok) {
        await refresh();
      }

      return result;
    },
    [refresh]
  );

  // Claim coins from vouchers
  const claimVouchers = useCallback(
    async (vouchers: readonly RecyclerVoucher[]): Promise<Result<Coin[], CoinageError>> => {
      const account = accountRef.current;
      if (!account || !claimTokens) {
        return err({ type: 'NO_CLAIM_TOKENS', reason: 'Not initialized' });
      }

      const credential = createCredentialForAccount(account.address);
      const service = getCoinageService();
      const result = await service.claimCoins({
        vouchers,
        claimToken: createMockClaimToken(),
      });

      // Refresh wallet after claim
      if (result.ok) {
        await refresh();
        // Update claim tokens
        const tokens = await service.getClaimTokenAllocation(credential);
        setClaimTokens(tokens);
      }

      return result;
    },
    [claimTokens, refresh]
  );

  // Split a coin
  const splitCoin = useCallback(
    async (coin: Coin, into: readonly CoinExponent[]): Promise<Result<Coin[], CoinageError>> => {
      const service = getCoinageService();
      const result = await service.splitCoin({ coin, into });

      if (result.ok) {
        await refresh();
      }

      return result;
    },
    [refresh]
  );

  // Prepare a transfer
  const prepareTransfer = useCallback(
    (coins: readonly Coin[], expiresInSeconds?: number): TransferPackage => {
      const service = getCoinageService();
      const pkg = service.prepareTransfer({
        coins,
        ...(expiresInSeconds !== undefined ? { expiresInSeconds } : {}),
      });

      // Refresh wallet (coins are now in escrow)
      void refresh();

      return pkg;
    },
    [refresh]
  );

  // Claim an incoming transfer
  const claimTransfer = useCallback(
    async (keys: readonly string[]): Promise<Result<Coin[], CoinageError>> => {
      const service = getCoinageService();
      const result = await service.claimTransfer({ keys });

      if (result.ok) {
        await refresh();
      }

      return result;
    },
    [refresh]
  );

  // Cancel a pending transfer
  const cancelTransfer = useCallback(
    async (coins: readonly Coin[]): Promise<Result<Coin[], CoinageError>> => {
      const service = getCoinageService();
      const result = await service.cancelTransfer({ coins });

      if (result.ok) {
        await refresh();
      }

      return result;
    },
    [refresh]
  );

  // Recycle coins
  const recycleCoin = useCallback(
    async (coins: readonly Coin[]): Promise<Result<Coin[], CoinageError>> => {
      const account = accountRef.current;
      if (!account || !claimTokens) {
        return err({ type: 'NO_CLAIM_TOKENS', reason: 'Not initialized' });
      }

      const credential = createCredentialForAccount(account.address);
      const service = getCoinageService();
      const result = await service.recycleCoin({
        coins,
        claimToken: createMockClaimToken(),
      });

      if (result.ok) {
        await refresh();
        // Update claim tokens
        const tokens = await service.getClaimTokenAllocation(credential);
        setClaimTokens(tokens);
      }

      return result;
    },
    [claimTokens, refresh]
  );

  // Offboard coins to pUSD
  const offboard = useCallback(
    async (
      coins: readonly Coin[],
      destinationAddress: PolkadotAddress
    ): Promise<Result<TransactionHash, CoinageError>> => {
      const account = accountRef.current;
      if (!account || !claimTokens) {
        return err({ type: 'NO_CLAIM_TOKENS', reason: 'Not initialized' });
      }

      const service = getCoinageService();
      const result = await service.offboard({
        coins,
        destinationAddress,
        claimToken: createMockClaimToken(),
      });

      if (result.ok) {
        await refresh();
      }

      return result;
    },
    [claimTokens, refresh]
  );

  return {
    wallet,
    claimTokens,
    loading,
    ready,
    error,
    isConnected,
    address: selectedAccount?.address,
    refresh,
    onboard,
    claimVouchers,
    splitCoin,
    prepareTransfer,
    claimTransfer,
    cancelTransfer,
    recycleCoin,
    offboard,
  };
}
