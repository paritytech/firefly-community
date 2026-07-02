'use client';

/**
 * FactCheckConfirmProvider — Context for managing the fact-check confirmation modal.
 *
 * Tracks which claim is being submitted for fact-checking.
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
import type { ClaimId } from '@cocuyo/types';

/** Animation duration for modal transitions (matches CSS duration-200) */
const MODAL_ANIMATION_DURATION_MS = 200;

interface FactCheckConfirmContextValue {
  /** Whether the modal is open */
  isOpen: boolean;
  /** The claim ID to submit for fact-checking */
  claimId: ClaimId | null;
  /** Open the modal */
  openModal: (claimId: ClaimId) => void;
  /** Close the modal */
  closeModal: () => void;
}

const FactCheckConfirmContext = createContext<FactCheckConfirmContextValue | null>(null);

interface FactCheckConfirmProviderProps {
  children: ReactNode;
}

export function FactCheckConfirmProvider({
  children,
}: FactCheckConfirmProviderProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [claimId, setClaimId] = useState<ClaimId | null>(null);

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

  const openModal = useCallback((id: ClaimId): void => {
    // Cancel any pending clear timeout when reopening
    if (clearTimeoutRef.current !== null) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
    setClaimId(id);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback((): void => {
    // Clear any existing timeout before scheduling new one
    if (clearTimeoutRef.current !== null) {
      clearTimeout(clearTimeoutRef.current);
    }
    setIsOpen(false);
    // Clear state after animation completes
    clearTimeoutRef.current = setTimeout(() => {
      setClaimId(null);
      clearTimeoutRef.current = null;
    }, MODAL_ANIMATION_DURATION_MS);
  }, []);

  const value = useMemo(
    (): FactCheckConfirmContextValue => ({
      isOpen,
      claimId,
      openModal,
      closeModal,
    }),
    [isOpen, claimId, openModal, closeModal]
  );

  return (
    <FactCheckConfirmContext.Provider value={value}>{children}</FactCheckConfirmContext.Provider>
  );
}

/**
 * Hook to access the fact-check confirmation modal context.
 */
export function useFactCheckConfirm(): FactCheckConfirmContextValue {
  const ctx = useContext(FactCheckConfirmContext);
  if (ctx === null) {
    throw new Error('useFactCheckConfirm must be used within a FactCheckConfirmProvider');
  }
  return ctx;
}
