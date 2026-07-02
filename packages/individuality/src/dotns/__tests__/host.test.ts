/**
 * Tests for Host-Only DotNS Provider
 *
 * @license GPL-3.0
 */

import { describe, it, expect, vi } from 'vitest';
import { createHostAliasProvider } from '../host';
import type { HostAliasAdapter } from '../types';

describe('createHostAliasProvider', () => {
  function createMockAdapter(overrides?: Partial<HostAliasAdapter>): HostAliasAdapter {
    return {
      getCurrentAlias: vi.fn().mockResolvedValue(null),
      isHosted: vi.fn().mockReturnValue(false),
      ...overrides,
    };
  }

  describe('getCurrentAlias', () => {
    it('returns host_unavailable when not in hosted mode', async () => {
      const getCurrentAlias = vi.fn().mockResolvedValue(null);
      const adapter = createMockAdapter({
        isHosted: vi.fn().mockReturnValue(false),
        getCurrentAlias,
      });
      const provider = createHostAliasProvider(adapter);

      const result = await provider.getCurrentAlias();

      expect(result).toEqual({
        ok: false,
        error: { code: 'host_unavailable', message: 'Not in hosted mode' },
      });
      expect(getCurrentAlias).not.toHaveBeenCalled();
    });

    it('returns alias from host when in hosted mode', async () => {
      const adapter = createMockAdapter({
        isHosted: vi.fn().mockReturnValue(true),
        getCurrentAlias: vi.fn().mockResolvedValue('alice'),
      });
      const provider = createHostAliasProvider(adapter);

      const result = await provider.getCurrentAlias();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('alice');
        expect(result.source).toBe('host');
        expect(typeof result.fetchedAt).toBe('number');
      }
    });

    it('returns null value when host returns no alias', async () => {
      const adapter = createMockAdapter({
        isHosted: vi.fn().mockReturnValue(true),
        getCurrentAlias: vi.fn().mockResolvedValue(null),
      });
      const provider = createHostAliasProvider(adapter);

      const result = await provider.getCurrentAlias();

      expect(result).toEqual({
        ok: true,
        value: null,
        source: 'host',
        fetchedAt: expect.any(Number) as number,
      });
    });

    it('returns network_error when adapter throws', async () => {
      const adapter = createMockAdapter({
        isHosted: vi.fn().mockReturnValue(true),
        getCurrentAlias: vi.fn().mockRejectedValue(new Error('Network failed')),
      });
      const provider = createHostAliasProvider(adapter);

      const result = await provider.getCurrentAlias();

      expect(result).toEqual({
        ok: false,
        error: { code: 'network_error', message: 'Network failed' },
      });
    });

    it('handles non-Error thrown values', async () => {
      const adapter = createMockAdapter({
        isHosted: vi.fn().mockReturnValue(true),
        getCurrentAlias: vi.fn().mockRejectedValue('string error'),
      });
      const provider = createHostAliasProvider(adapter);

      const result = await provider.getCurrentAlias();

      expect(result).toEqual({
        ok: false,
        error: { code: 'network_error', message: 'string error' },
      });
    });
  });

  describe('subscribeCurrentAlias', () => {
    it('emits current value immediately', async () => {
      const adapter = createMockAdapter({
        isHosted: vi.fn().mockReturnValue(true),
        getCurrentAlias: vi.fn().mockResolvedValue('alice'),
      });
      const provider = createHostAliasProvider(adapter);
      const callback = vi.fn();

      provider.subscribeCurrentAlias(callback);

      // Wait for async getCurrentAlias
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledTimes(1);
      });

      expect(callback).toHaveBeenCalledWith({
        ok: true,
        value: 'alice',
        source: 'host',
        fetchedAt: expect.any(Number) as number,
      });
    });

    it('uses adapter subscription when available', () => {
      const unsubscribeFn = vi.fn();
      let capturedCallback: ((alias: string | null) => void) | undefined;

      const subscribeCurrentAlias = vi.fn((cb: (alias: string | null) => void) => {
        capturedCallback = cb;
        return unsubscribeFn;
      });

      const adapter = createMockAdapter({
        isHosted: vi.fn().mockReturnValue(true),
        getCurrentAlias: vi.fn().mockResolvedValue('alice'),
        subscribeCurrentAlias,
      });
      const provider = createHostAliasProvider(adapter);
      const callback = vi.fn();

      const unsubscribe = provider.subscribeCurrentAlias(callback);

      // Verify adapter subscription was set up
      expect(subscribeCurrentAlias).toHaveBeenCalled();

      // Call the adapter callback
      expect(capturedCallback).toBeDefined();
      capturedCallback?.('bob');

      // Verify callback received the update
      expect(callback).toHaveBeenCalledWith({
        ok: true,
        value: 'bob',
        source: 'host',
        fetchedAt: expect.any(Number) as number,
      });

      // Verify unsubscribe works
      unsubscribe();
      expect(unsubscribeFn).toHaveBeenCalled();
    });

    it('returns no-op unsubscribe when adapter lacks subscription', () => {
      const adapter = createMockAdapter({
        isHosted: vi.fn().mockReturnValue(true),
        getCurrentAlias: vi.fn().mockResolvedValue('alice'),
      });
      const provider = createHostAliasProvider(adapter);

      const unsubscribe = provider.subscribeCurrentAlias(vi.fn());

      // Should not throw
      expect(() => unsubscribe()).not.toThrow();
    });
  });
});
