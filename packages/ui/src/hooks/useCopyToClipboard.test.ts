/* eslint-disable @typescript-eslint/no-deprecated -- act from @testing-library/react is not deprecated */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopyToClipboard } from './useCopyToClipboard';

describe('useCopyToClipboard', () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // Restore navigator
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
    });
  });

  describe('initial state', () => {
    it('returns copied as false initially', () => {
      const { result } = renderHook(() => useCopyToClipboard());
      expect(result.current.copied).toBe(false);
    });

    it('returns copy function', () => {
      const { result } = renderHook(() => useCopyToClipboard());
      expect(typeof result.current.copy).toBe('function');
    });

    it('returns reset function', () => {
      const { result } = renderHook(() => useCopyToClipboard());
      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('copy function', () => {
    it('copies text to clipboard and sets copied to true', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis, 'navigator', {
        value: { clipboard: { writeText: writeTextMock } },
        writable: true,
      });

      const { result } = renderHook(() => useCopyToClipboard());

      let success = false;
      await act(async () => {
        success = await result.current.copy('test text');
      });

      expect(success).toBe(true);
      expect(result.current.copied).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith('test text');
    });

    it('returns false when navigator is undefined', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: undefined,
        writable: true,
      });

      const { result } = renderHook(() => useCopyToClipboard());

      let success = true;
      await act(async () => {
        success = await result.current.copy('test');
      });

      expect(success).toBe(false);
      expect(result.current.copied).toBe(false);
    });

    it('returns false when clipboard API is not available', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        writable: true,
      });

      const { result } = renderHook(() => useCopyToClipboard());

      let success = true;
      await act(async () => {
        success = await result.current.copy('test');
      });

      expect(success).toBe(false);
    });

    it('returns false when clipboard.writeText fails', async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Failed'));
      Object.defineProperty(globalThis, 'navigator', {
        value: { clipboard: { writeText: writeTextMock } },
        writable: true,
      });

      const { result } = renderHook(() => useCopyToClipboard());

      let success = true;
      await act(async () => {
        success = await result.current.copy('test');
      });

      expect(success).toBe(false);
      expect(result.current.copied).toBe(false);
    });
  });

  describe('auto-reset', () => {
    it('resets copied state after default delay (2000ms)', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis, 'navigator', {
        value: { clipboard: { writeText: writeTextMock } },
        writable: true,
      });

      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('test');
      });

      expect(result.current.copied).toBe(true);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.copied).toBe(false);
    });

    it('uses custom reset delay', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis, 'navigator', {
        value: { clipboard: { writeText: writeTextMock } },
        writable: true,
      });

      const { result } = renderHook(() => useCopyToClipboard(1000));

      await act(async () => {
        await result.current.copy('test');
      });

      expect(result.current.copied).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.copied).toBe(false);
    });

    it('does not auto-reset when delay is 0', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis, 'navigator', {
        value: { clipboard: { writeText: writeTextMock } },
        writable: true,
      });

      const { result } = renderHook(() => useCopyToClipboard(0));

      await act(async () => {
        await result.current.copy('test');
      });

      expect(result.current.copied).toBe(true);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should still be true since delay is 0
      expect(result.current.copied).toBe(true);
    });
  });

  describe('reset function', () => {
    it('manually resets copied state', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis, 'navigator', {
        value: { clipboard: { writeText: writeTextMock } },
        writable: true,
      });

      const { result } = renderHook(() => useCopyToClipboard(0)); // No auto-reset

      await act(async () => {
        await result.current.copy('test');
      });

      expect(result.current.copied).toBe(true);

      act(() => {
        result.current.reset();
      });

      expect(result.current.copied).toBe(false);
    });
  });
});
