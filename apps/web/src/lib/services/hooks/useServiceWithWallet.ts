'use client';

/**
 * Shared wallet-sync boilerplate for service hooks.
 *
 * Most service hooks (signal, campaign, claim, corroboration, crowdstacking)
 * share the same wallet integration:
 *
 * - Read `selectedAccount` / `isConnected` from {@link useSigner}.
 * - Mirror both into refs so write callbacks read fresh values without
 *   re-creating the callback (avoids stale closures).
 * - Sync the connected wallet address into the singleton services on change,
 *   in a `useEffect` (never during render).
 *
 * This hook captures exactly that boilerplate. Each service hook reads
 * `accountRef` / `connectedRef` in its write callbacks and surfaces
 * `isConnected` / `address` if its public API exposes them.
 */

import { useEffect, useRef, type MutableRefObject } from 'react';
import { useSigner, type UseSignerResult } from '@/lib/context/SignerContext';
import { setConnectedWallet, clearConnectedWallet } from '../service-utils';

/** The selected account type as provided by {@link useSigner}. */
type SelectedAccount = UseSignerResult['selectedAccount'];

/** Result of {@link useServiceWithWallet}. */
export interface ServiceWalletState {
  /** Ref mirroring the currently selected account (fresh in callbacks). */
  readonly accountRef: MutableRefObject<SelectedAccount>;
  /** Ref mirroring the current connection flag (fresh in callbacks). */
  readonly connectedRef: MutableRefObject<boolean>;
  /** Whether a wallet is currently connected. */
  readonly isConnected: boolean;
  /** The connected wallet address, if any. */
  readonly address: string | undefined;
}

/** Options for {@link useServiceWithWallet}. */
export interface UseServiceWithWalletOptions {
  /**
   * When `true`, the wallet-sync effect calls {@link clearConnectedWallet} on
   * disconnect (when no account is selected). Defaults to `false`, matching the
   * reference behavior of only syncing while an account is present.
   */
  readonly clearOnDisconnect?: boolean;
}

/**
 * Provide the shared wallet-sync state used by service hooks.
 *
 * Mirrors `selectedAccount` / `isConnected` into refs and syncs the connected
 * wallet address into the singleton services whenever the account changes.
 */
export function useServiceWithWallet(
  options: UseServiceWithWalletOptions = {}
): ServiceWalletState {
  const { clearOnDisconnect = false } = options;
  const { selectedAccount, isConnected } = useSigner();

  // Use refs to avoid stale closures in callbacks
  const accountRef = useRef(selectedAccount);
  accountRef.current = selectedAccount;

  const connectedRef = useRef(isConnected);
  connectedRef.current = isConnected;

  // Sync wallet state to singleton service when account changes.
  // IMPORTANT: This must be in useEffect, not during render phase.
  useEffect(() => {
    if (selectedAccount) {
      setConnectedWallet(selectedAccount.address);
    } else if (clearOnDisconnect) {
      clearConnectedWallet();
    }
  }, [selectedAccount, clearOnDisconnect]);

  return {
    accountRef,
    connectedRef,
    isConnected,
    address: selectedAccount?.address,
  };
}
