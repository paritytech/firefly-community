'use client';

/**
 * useBulletinWithSigner — Bulletin Chain operations with wallet signing.
 *
 * Combines wallet connection state with Bulletin Chain client to ensure
 * transactions are signed before upload. Provides clear error states when
 * wallet is not connected.
 */

import { useCallback, useMemo } from 'react';
import { useSigner } from './index';
import { useBulletinStatus } from './useBulletinStatus';
import { uploadToBulletin, uploadPhotoToBulletin } from '../lib/services/service-utils';
import type { Result } from '@cocuyo/types';
import { err } from '@cocuyo/types';
import type { UploadResult, PhotoUploadResult } from '../lib/services/service-utils';

export interface UseBulletinWithSignerResult {
  /** Whether wallet is connected and chain is available */
  isReady: boolean;
  /** Whether wallet is connected */
  isWalletConnected: boolean;
  /** Whether chain is connected */
  isChainConnected: boolean;
  /** Error message if not ready */
  errorReason: string | null;
  /** Upload JSON data to Bulletin Chain (requires wallet) */
  uploadJson: (data: unknown) => Promise<Result<UploadResult, string>>;
  /** Upload photo file to Bulletin Chain (requires wallet) */
  uploadPhoto: (file: File) => Promise<Result<PhotoUploadResult, string>>;
}

/**
 * Hook for Bulletin Chain operations that require wallet signing.
 *
 * @example
 * const { isReady, errorReason, uploadJson } = useBulletinWithSigner();
 *
 * if (!isReady) {
 *   return <ConnectionRequired reason={errorReason} />;
 * }
 *
 * const result = await uploadJson({ type: 'signal', data: signalData });
 */
export function useBulletinWithSigner(): UseBulletinWithSignerResult {
  const { isConnected: isWalletConnected, selectedAccount } = useSigner();
  const { isConnected: isChainConnected, error: chainError } = useBulletinStatus();

  const isReady = isWalletConnected && isChainConnected;

  const errorReason = useMemo(() => {
    if (!isWalletConnected) {
      return 'Wallet not connected. Please connect your wallet to continue.';
    }
    if (!isChainConnected) {
      return chainError ?? 'Unable to connect to Bulletin Chain.';
    }
    return null;
  }, [isWalletConnected, isChainConnected, chainError]);

  const uploadJson = useCallback(
    async (data: unknown): Promise<Result<UploadResult, string>> => {
      if (!isWalletConnected) {
        return err('Wallet not connected. Please connect your wallet to upload.');
      }
      if (!isChainConnected) {
        return err(chainError ?? 'Bulletin Chain unavailable.');
      }
      if (selectedAccount === null) {
        return err('No account selected. Please select an account.');
      }

      return uploadToBulletin(data);
    },
    [isWalletConnected, isChainConnected, chainError, selectedAccount]
  );

  const uploadPhoto = useCallback(
    async (file: File): Promise<Result<PhotoUploadResult, string>> => {
      if (!isWalletConnected) {
        return err('Wallet not connected. Please connect your wallet to upload.');
      }
      if (!isChainConnected) {
        return err(chainError ?? 'Bulletin Chain unavailable.');
      }
      if (selectedAccount === null) {
        return err('No account selected. Please select an account.');
      }

      return uploadPhotoToBulletin(file);
    },
    [isWalletConnected, isChainConnected, chainError, selectedAccount]
  );

  return {
    isReady,
    isWalletConnected,
    isChainConnected,
    errorReason,
    uploadJson,
    uploadPhoto,
  };
}
