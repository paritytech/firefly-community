'use client';

/**
 * useBulletinStatus — Hook for Bulletin Chain connection status.
 *
 * Provides connection state to UI components for showing feedback
 * when the chain is unavailable.
 */

import { useEffect, useState } from 'react';
import { isInContainer } from '../lib/host/detect';

export type BulletinConnectionStatus = 'connecting' | 'connected' | 'error';

export interface UseBulletinStatusResult {
  /** Current connection status */
  status: BulletinConnectionStatus;
  /** Whether the client is connected and ready */
  isConnected: boolean;
  /** Error message if connection failed */
  error: string | null;
  /** Retry connection */
  retry: () => void;
}

/**
 * Hook to monitor Bulletin Chain connection status.
 *
 * @example
 * const { isConnected, status, error } = useBulletinStatus();
 * if (!isConnected) {
 *   return <ChainUnavailableBanner error={error} />;
 * }
 */
export function useBulletinStatus(): UseBulletinStatusResult {
  const [status, setStatus] = useState<BulletinConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);

  const checkConnection = (): void => {
    setStatus('connecting');
    setError(null);

    // Bulletin reads/writes go through the host preimage API, so availability is
    // determined by whether we're running inside the Polkadot host container.
    if (isInContainer()) {
      setStatus('connected');
      return;
    }
    setStatus('error');
    setError('Bulletin Chain is only available inside the Polkadot host.');
  };

  useEffect(() => {
    checkConnection();
  }, []);

  return {
    status,
    isConnected: status === 'connected',
    error,
    retry: checkConnection,
  };
}
