'use client';

/**
 * TrustDrawerProvider — Context for managing the trust drawer state.
 *
 * The trust drawer shows detailed verification information for a post:
 * - Claims extracted from the post
 * - Corroborations and disputes
 * - Verdicts
 * - Campaign information
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
import type { PostId } from '@cocuyo/types';

interface TrustDrawerContextValue {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** The post ID to show details for */
  postId: PostId | null;
  /** Open the drawer for a specific post */
  openDrawer: (postId: PostId) => void;
  /** Close the drawer */
  closeDrawer: () => void;
}

const TrustDrawerContext = createContext<TrustDrawerContextValue | null>(null);

interface TrustDrawerProviderProps {
  children: ReactNode;
}

export function TrustDrawerProvider({ children }: TrustDrawerProviderProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [postId, setPostId] = useState<PostId | null>(null);

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

  const openDrawer = useCallback((id: PostId): void => {
    // Cancel any pending clear timeout when reopening
    if (clearTimeoutRef.current !== null) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
    setPostId(id);
    setIsOpen(true);
  }, []);

  const closeDrawer = useCallback((): void => {
    setIsOpen(false);
    // Clear state after animation
    clearTimeoutRef.current = setTimeout(() => {
      setPostId(null);
      clearTimeoutRef.current = null;
    }, 200);
  }, []);

  const value = useMemo(
    (): TrustDrawerContextValue => ({
      isOpen,
      postId,
      openDrawer,
      closeDrawer,
    }),
    [isOpen, postId, openDrawer, closeDrawer]
  );

  return <TrustDrawerContext.Provider value={value}>{children}</TrustDrawerContext.Provider>;
}

/**
 * Hook to access the trust drawer context.
 */
export function useTrustDrawer(): TrustDrawerContextValue {
  const ctx = useContext(TrustDrawerContext);
  if (ctx === null) {
    throw new Error('useTrustDrawer must be used within a TrustDrawerProvider');
  }
  return ctx;
}
