/**
 * useCopyToClipboard — Hook for clipboard operations.
 *
 * Returns a function to copy text and a state indicating success.
 */

'use client';

import { useState, useCallback } from 'react';

interface UseCopyToClipboardReturn {
  /** Copy text to clipboard */
  copy: (text: string) => Promise<boolean>;
  /** Whether the last copy was successful */
  copied: boolean;
  /** Reset the copied state */
  reset: () => void;
}

export function useCopyToClipboard(
  /** Duration to show copied state (ms) */
  resetDelay = 2000
): UseCopyToClipboardReturn {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      // Check for browser environment and clipboard API
      if (typeof navigator === 'undefined' || !('clipboard' in navigator)) {
        return false;
      }

      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);

        if (resetDelay > 0) {
          setTimeout(() => {
            setCopied(false);
          }, resetDelay);
        }

        return true;
      } catch {
        return false;
      }
    },
    [resetDelay]
  );

  const reset = useCallback(() => {
    setCopied(false);
  }, []);

  return { copy, copied, reset };
}
