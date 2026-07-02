/**
 * Tests for FactCheckConfirmProvider and useFactCheckConfirm hook.
 */

/* eslint-disable @typescript-eslint/no-deprecated -- act from RTL is valid for React 18 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FactCheckConfirmProvider, useFactCheckConfirm } from './FactCheckConfirmProvider';
import { createClaimId } from '@cocuyo/types';

describe('FactCheckConfirmProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const wrapper = ({ children }: { children: ReactNode }): React.ReactElement => (
    <FactCheckConfirmProvider>{children}</FactCheckConfirmProvider>
  );

  describe('initial state', () => {
    it('starts with modal closed', () => {
      const { result } = renderHook(() => useFactCheckConfirm(), { wrapper });

      expect(result.current.isOpen).toBe(false);
    });

    it('starts with null claimId', () => {
      const { result } = renderHook(() => useFactCheckConfirm(), { wrapper });

      expect(result.current.claimId).toBeNull();
    });
  });

  describe('openModal', () => {
    it('opens the modal', () => {
      const { result } = renderHook(() => useFactCheckConfirm(), { wrapper });

      act(() => {
        result.current.openModal(createClaimId('claim-123'));
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('sets the claimId', () => {
      const { result } = renderHook(() => useFactCheckConfirm(), { wrapper });
      const claimId = createClaimId('claim-456');

      act(() => {
        result.current.openModal(claimId);
      });

      expect(result.current.claimId).toBe(claimId);
    });

    it('cancels pending close timeout when reopening', () => {
      const { result } = renderHook(() => useFactCheckConfirm(), { wrapper });
      const claimId1 = createClaimId('claim-1');
      const claimId2 = createClaimId('claim-2');

      // Open, close, then quickly reopen
      act(() => {
        result.current.openModal(claimId1);
      });
      act(() => {
        result.current.closeModal();
      });
      // Don't wait for timeout - reopen immediately
      act(() => {
        result.current.openModal(claimId2);
      });

      // Should have the new claimId, not null
      expect(result.current.claimId).toBe(claimId2);
      expect(result.current.isOpen).toBe(true);

      // Advance past original animation delay to verify old timeout was cancelled
      act(() => {
        vi.advanceTimersByTime(250);
      });

      // Should still have the new claimId (old timeout should not have cleared it)
      expect(result.current.claimId).toBe(claimId2);
      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('closeModal', () => {
    it('closes the modal immediately', () => {
      const { result } = renderHook(() => useFactCheckConfirm(), { wrapper });

      act(() => {
        result.current.openModal(createClaimId('claim-123'));
      });
      act(() => {
        result.current.closeModal();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('clears claimId after animation delay', () => {
      const { result } = renderHook(() => useFactCheckConfirm(), { wrapper });
      const claimId = createClaimId('claim-789');

      act(() => {
        result.current.openModal(claimId);
      });
      act(() => {
        result.current.closeModal();
      });

      // ClaimId should still be set during animation
      expect(result.current.claimId).toBe(claimId);

      // Fast-forward past animation duration (200ms)
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Now claimId should be null
      expect(result.current.claimId).toBeNull();
    });

    it('handles multiple rapid close calls', () => {
      const { result } = renderHook(() => useFactCheckConfirm(), { wrapper });

      act(() => {
        result.current.openModal(createClaimId('claim-test'));
      });

      // Multiple close calls should not cause issues
      act(() => {
        result.current.closeModal();
        result.current.closeModal();
        result.current.closeModal();
      });

      expect(result.current.isOpen).toBe(false);

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.claimId).toBeNull();
    });
  });

  describe('unmount cleanup', () => {
    it('clears pending timeouts on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const { result, unmount } = renderHook(() => useFactCheckConfirm(), { wrapper });

      act(() => {
        result.current.openModal(createClaimId('claim-unmount'));
      });
      act(() => {
        result.current.closeModal();
      });

      // Unmount before timeout completes
      unmount();

      // Should have cleared the timeout
      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });
  });
});

describe('useFactCheckConfirm', () => {
  it('throws error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

    expect(() => {
      renderHook(() => useFactCheckConfirm());
    }).toThrow('useFactCheckConfirm must be used within a FactCheckConfirmProvider');

    consoleSpy.mockRestore();
  });
});
