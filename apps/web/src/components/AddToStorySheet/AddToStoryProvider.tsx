'use client';

/**
 * AddToStoryProvider — Context for managing the add to story sheet.
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
import type { Post } from '@cocuyo/types';

interface AddToStoryContextValue {
  /** Whether the sheet is open */
  isOpen: boolean;
  /** The post being added to a story */
  post: Post | null;
  /** Open the sheet for a specific post */
  openSheet: (post: Post) => void;
  /** Close the sheet */
  closeSheet: () => void;
}

const AddToStoryContext = createContext<AddToStoryContextValue | null>(null);

interface AddToStoryProviderProps {
  children: ReactNode;
}

export function AddToStoryProvider({ children }: AddToStoryProviderProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [post, setPost] = useState<Post | null>(null);

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

  const openSheet = useCallback((target: Post): void => {
    // Cancel any pending clear timeout when reopening
    if (clearTimeoutRef.current !== null) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
    setPost(target);
    setIsOpen(true);
  }, []);

  const closeSheet = useCallback((): void => {
    setIsOpen(false);
    // Cancel any pending clear so a stale timer can't null out a re-opened post.
    if (clearTimeoutRef.current !== null) {
      clearTimeout(clearTimeoutRef.current);
    }
    clearTimeoutRef.current = setTimeout(() => {
      setPost(null);
      clearTimeoutRef.current = null;
    }, 200);
  }, []);

  const value = useMemo(
    (): AddToStoryContextValue => ({
      isOpen,
      post,
      openSheet,
      closeSheet,
    }),
    [isOpen, post, openSheet, closeSheet]
  );

  return <AddToStoryContext.Provider value={value}>{children}</AddToStoryContext.Provider>;
}

/**
 * Hook to access the add to story sheet context.
 */
export function useAddToStory(): AddToStoryContextValue {
  const ctx = useContext(AddToStoryContext);
  if (ctx === null) {
    throw new Error('useAddToStory must be used within an AddToStoryProvider');
  }
  return ctx;
}
