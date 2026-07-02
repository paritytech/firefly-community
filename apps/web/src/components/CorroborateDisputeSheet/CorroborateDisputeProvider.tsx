'use client';

/**
 * CorroborateDisputeProvider — Context for managing the corroborate/dispute sheet.
 *
 * Tracks which post is being corroborated/disputed and the mode.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
  type ReactElement,
} from 'react';
import type { Post, CampaignId, PUSDAmount } from '@cocuyo/types';

/** Campaign info for display in the sheet */
export interface SheetCampaignInfo {
  readonly id: CampaignId;
  readonly title: string;
  readonly fundingAmount: PUSDAmount;
}

/** Mode of the sheet */
export type CorroborateDisputeMode = 'corroborate' | 'dispute';

/** Options for opening the sheet */
export interface OpenSheetOptions {
  post: Post;
  mode: CorroborateDisputeMode;
  campaign?: SheetCampaignInfo;
}

interface CorroborateDisputeContextValue {
  /** Whether the sheet is open */
  isOpen: boolean;
  /** The post being corroborated/disputed */
  post: Post | null;
  /** The mode (corroborate or dispute) */
  mode: CorroborateDisputeMode;
  /** Optional campaign info */
  campaign: SheetCampaignInfo | null;
  /** Open the sheet */
  openSheet: (options: OpenSheetOptions) => void;
  /** Close the sheet */
  closeSheet: () => void;
}

const CorroborateDisputeContext = createContext<CorroborateDisputeContextValue | null>(null);

interface CorroborateDisputeProviderProps {
  children: ReactNode;
}

export function CorroborateDisputeProvider({
  children,
}: CorroborateDisputeProviderProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [post, setPost] = useState<Post | null>(null);
  const [mode, setMode] = useState<CorroborateDisputeMode>('corroborate');
  const [campaign, setCampaign] = useState<SheetCampaignInfo | null>(null);

  // Track timeout for cleanup
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (clearTimeoutRef.current !== null) {
        clearTimeout(clearTimeoutRef.current);
      }
    };
  }, []);

  const openSheet = useCallback((options: OpenSheetOptions): void => {
    // Cancel any pending clear timeout when reopening
    if (clearTimeoutRef.current !== null) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
    setPost(options.post);
    setMode(options.mode);
    setCampaign(options.campaign ?? null);
    setIsOpen(true);
  }, []);

  const closeSheet = useCallback((): void => {
    setIsOpen(false);
    // Clear state after animation completes
    clearTimeoutRef.current = setTimeout(() => {
      setPost(null);
      setCampaign(null);
      clearTimeoutRef.current = null;
    }, 200);
  }, []);

  const value = useMemo(
    (): CorroborateDisputeContextValue => ({
      isOpen,
      post,
      mode,
      campaign,
      openSheet,
      closeSheet,
    }),
    [isOpen, post, mode, campaign, openSheet, closeSheet]
  );

  return (
    <CorroborateDisputeContext.Provider value={value}>
      {children}
    </CorroborateDisputeContext.Provider>
  );
}

/**
 * Hook to access the corroborate/dispute sheet context.
 */
export function useCorroborateDispute(): CorroborateDisputeContextValue {
  const ctx = useContext(CorroborateDisputeContext);
  if (ctx === null) {
    throw new Error('useCorroborateDispute must be used within a CorroborateDisputeProvider');
  }
  return ctx;
}
