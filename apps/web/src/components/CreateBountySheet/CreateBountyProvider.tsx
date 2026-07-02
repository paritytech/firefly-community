'use client';

/**
 * CreateBountyProvider — Context for managing the create bounty sheet.
 *
 * Tracks which claim is being funded with a bounty.
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

/** Animation duration for sheet transitions (matches CSS duration-200) */
const SHEET_ANIMATION_DURATION_MS = 200;

interface CreateBountyContextValue {
  /** Whether the sheet is open */
  isOpen: boolean;
  /** The claim ID to fund a bounty for, or null for a general (claim-less) campaign */
  claimId: ClaimId | null;
  /** Open the sheet. Pass a claimId to fund a specific claim; omit it for a general campaign. */
  openSheet: (claimId?: ClaimId) => void;
  /** Close the sheet */
  closeSheet: () => void;
}

const CreateBountyContext = createContext<CreateBountyContextValue | null>(null);

interface CreateBountyProviderProps {
  children: ReactNode;
}

export function CreateBountyProvider({ children }: CreateBountyProviderProps): ReactElement {
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

  const openSheet = useCallback((id?: ClaimId): void => {
    // Cancel any pending clear timeout when reopening
    if (clearTimeoutRef.current !== null) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
    setClaimId(id ?? null);
    setIsOpen(true);
  }, []);

  const closeSheet = useCallback((): void => {
    setIsOpen(false);
    // Clear state after animation completes
    clearTimeoutRef.current = setTimeout(() => {
      setClaimId(null);
      clearTimeoutRef.current = null;
    }, SHEET_ANIMATION_DURATION_MS);
  }, []);

  const value = useMemo(
    (): CreateBountyContextValue => ({
      isOpen,
      claimId,
      openSheet,
      closeSheet,
    }),
    [isOpen, claimId, openSheet, closeSheet]
  );

  return <CreateBountyContext.Provider value={value}>{children}</CreateBountyContext.Provider>;
}

/**
 * Hook to access the create bounty sheet context.
 */
export function useCreateBounty(): CreateBountyContextValue {
  const ctx = useContext(CreateBountyContext);
  if (ctx === null) {
    throw new Error('useCreateBounty must be used within a CreateBountyProvider');
  }
  return ctx;
}
