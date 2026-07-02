/**
 * Tests for usePersonhood hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { usePersonhood } from './usePersonhood';
import { clearPersonhoodCache, setPersonhoodLevel } from '@/lib/services/personhood-service';
import {
  createCredentialForAccount,
  clearChainPersonhoodCache,
} from '@/lib/services/chain-personhood-service';

interface MockAccount {
  address: string;
}

interface MockSignerResult {
  selectedAccount: MockAccount | null;
  isConnected: boolean;
}

// Mock useSigner hook
const mockUseSigner = vi.fn<() => MockSignerResult>();

vi.mock('@/lib/context/SignerContext', () => ({
  useSigner: (): MockSignerResult => mockUseSigner(),
}));

describe('usePersonhood', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPersonhoodCache();
    clearChainPersonhoodCache();
  });

  describe('when not connected', () => {
    beforeEach(() => {
      mockUseSigner.mockReturnValue({
        selectedAccount: null,
        isConnected: false,
      });
    });

    it('returns none level', async () => {
      const { result } = renderHook(() => usePersonhood());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.level).toBe('none');
      expect(result.current.state).toBeNull();
    });

    it('returns none capabilities', async () => {
      const { result } = renderHook(() => usePersonhood());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.capabilities.canIlluminate).toBe(false);
      expect(result.current.capabilities.canCorroborate).toBe(false);
    });

    it('canPerform returns false for all actions', async () => {
      const { result } = renderHook(() => usePersonhood());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canPerform('canIlluminate')).toBe(false);
      expect(result.current.canPerform('canCorroborate')).toBe(false);
    });

    it('canUpgrade is false when not connected', async () => {
      const { result } = renderHook(() => usePersonhood());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canUpgrade).toBe(false);
    });

    it('canUpgrade is false when isConnected but no account (null credential edge case)', async () => {
      // Edge case: isConnected could be true briefly while account is still null
      mockUseSigner.mockReturnValue({
        selectedAccount: null,
        isConnected: true, // Connected but no account yet
      });

      const { result } = renderHook(() => usePersonhood());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canUpgrade).toBe(false);
    });
  });

  describe('when connected', () => {
    const mockAddress = '0x1234567890123456789012345678901234567890';

    beforeEach(() => {
      mockUseSigner.mockReturnValue({
        selectedAccount: { address: mockAddress },
        isConnected: true,
      });
    });

    it('loads lite level by default', async () => {
      const { result } = renderHook(() => usePersonhood());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.level).toBe('lite');
    });

    it('returns lite capabilities', async () => {
      const { result } = renderHook(() => usePersonhood());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.capabilities.canIlluminate).toBe(true);
      expect(result.current.capabilities.canCorroborate).toBe(true);
      expect(result.current.capabilities.canClaimPayout).toBe(true);
    });

    it('canPerform delegates to capabilities', async () => {
      const { result } = renderHook(() => usePersonhood());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.canPerform('canIlluminate')).toBe(true);
      expect(result.current.canPerform('canCorroborate')).toBe(true);
      expect(result.current.canPerform('canClaimPayout')).toBe(true);
    });

    it('setLevel updates state', async () => {
      const { result } = renderHook(() => usePersonhood());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setLevel('full');
      });

      expect(result.current.level).toBe('full');
      expect(result.current.capabilities.canClaimPayout).toBe(true);
    });

    it('upgradeToFull changes level to full', async () => {
      const { result } = renderHook(() => usePersonhood());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.upgradeToFull();
      });

      expect(result.current.level).toBe('full');
    });

    it('canUpgrade is true when connected at lite level', async () => {
      const { result } = renderHook(() => usePersonhood());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.level).toBe('lite');
      expect(result.current.canUpgrade).toBe(true);
    });

    it('canUpgrade is false when already at full level', async () => {
      const { result } = renderHook(() => usePersonhood());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Upgrade to full
      act(() => {
        result.current.setLevel('full');
      });

      expect(result.current.level).toBe('full');
      expect(result.current.canUpgrade).toBe(false);
    });
  });

  describe('when account changes', () => {
    it('reloads personhood for new account', async () => {
      const mockAddress1 = '0x1111111111111111111111111111111111111111';
      const mockAddress2 = '0x2222222222222222222222222222222222222222';

      // Set different levels for different addresses using centralized credential creation
      const cred1 = createCredentialForAccount(mockAddress1);
      const cred2 = createCredentialForAccount(mockAddress2);
      setPersonhoodLevel(cred1, 'full');
      setPersonhoodLevel(cred2, 'lite');

      mockUseSigner.mockReturnValue({
        selectedAccount: { address: mockAddress1 },
        isConnected: true,
      });

      const { result, rerender } = renderHook(() => usePersonhood());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.level).toBe('full');

      // Change account
      mockUseSigner.mockReturnValue({
        selectedAccount: { address: mockAddress2 },
        isConnected: true,
      });

      rerender();

      await waitFor(() => {
        expect(result.current.level).toBe('lite');
      });
    });
  });
});
