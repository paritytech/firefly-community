/**
 * Tests for Composed Current Alias Provider
 *
 * @license GPL-3.0
 */

import { describe, it, expect, vi } from 'vitest';
import { createCurrentAliasProvider } from '../current-alias';
import type { HostAliasAdapter } from '../types';
import type { DotNsGatewayApi } from '../../dotns-gateway';
import type { PolkadotAddress } from '@cocuyo/types';

describe('createCurrentAliasProvider', () => {
  const testAccount = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' as PolkadotAddress;

  function createMockAdapter(overrides: Partial<HostAliasAdapter> = {}): HostAliasAdapter {
    return {
      getCurrentAlias: vi.fn().mockResolvedValue(null),
      isHosted: vi.fn().mockReturnValue(false),
      ...overrides,
    };
  }

  function createMockApi(): { api: DotNsGatewayApi; accountAlias: ReturnType<typeof vi.fn> } {
    const accountAlias = vi.fn().mockResolvedValue(undefined);

    const api: DotNsGatewayApi = {
      query: {
        DotnsGateway: {
          AccountAlias: { getValue: accountAlias },
        },
      },
    };

    return { api, accountAlias };
  }

  describe('host-first priority (default)', () => {
    it('returns host result when host succeeds', async () => {
      const getCurrentAlias = vi.fn().mockResolvedValue('alice');
      const adapter = createMockAdapter({
        isHosted: vi.fn().mockReturnValue(true),
        getCurrentAlias,
      });
      const { api, accountAlias } = createMockApi();

      const provider = createCurrentAliasProvider({
        hostAdapter: adapter,
        chainApi: api,
        currentAccount: () => testAccount,
      });

      const result = await provider.getCurrentAlias();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('alice');
        expect(result.source).toBe('host');
      }
      expect(accountAlias).not.toHaveBeenCalled();
    });

    it('falls back to chain when host fails', async () => {
      const adapter = createMockAdapter({
        isHosted: vi.fn().mockReturnValue(true),
        getCurrentAlias: vi.fn().mockRejectedValue(new Error('Host error')),
      });
      const { api, accountAlias } = createMockApi();
      accountAlias.mockResolvedValue('bob');

      const provider = createCurrentAliasProvider({
        hostAdapter: adapter,
        chainApi: api,
        currentAccount: () => testAccount,
      });

      const result = await provider.getCurrentAlias();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('bob');
        expect(result.source).toBe('chain');
      }
    });

    it('falls back to chain when not in hosted mode', async () => {
      const adapter = createMockAdapter({ isHosted: vi.fn().mockReturnValue(false) });
      const { api, accountAlias } = createMockApi();
      accountAlias.mockResolvedValue('bob');

      const provider = createCurrentAliasProvider({
        hostAdapter: adapter,
        chainApi: api,
        currentAccount: () => testAccount,
      });

      const result = await provider.getCurrentAlias();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('bob');
        expect(result.source).toBe('chain');
      }
    });

    it('returns unsupported when no source configured', async () => {
      const provider = createCurrentAliasProvider({});

      const result = await provider.getCurrentAlias();

      expect(result).toEqual({
        ok: false,
        error: { code: 'unsupported', message: 'No alias source configured' },
      });
    });

    it('returns host null without falling back to chain (error-only fallback)', async () => {
      // Host returns null (no alias) - this is a valid result, not an error
      // Fallback should NOT occur; host is authoritative for "no alias"
      const adapter = createMockAdapter({
        isHosted: vi.fn().mockReturnValue(true),
        getCurrentAlias: vi.fn().mockResolvedValue(null),
      });
      const { api, accountAlias } = createMockApi();
      accountAlias.mockResolvedValue('chain-alias'); // Chain has an alias

      const provider = createCurrentAliasProvider({
        hostAdapter: adapter,
        chainApi: api,
        currentAccount: () => testAccount,
        priority: 'host-first',
      });

      const result = await provider.getCurrentAlias();

      // Should return host's null, not chain's alias
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
        expect(result.source).toBe('host');
      }
      // Chain should NOT have been queried
      expect(accountAlias).not.toHaveBeenCalled();
    });
  });

  describe('host-only priority', () => {
    it('returns host result when available', async () => {
      const adapter = createMockAdapter({
        isHosted: vi.fn().mockReturnValue(true),
        getCurrentAlias: vi.fn().mockResolvedValue('alice'),
      });
      const { api } = createMockApi();

      const provider = createCurrentAliasProvider({
        hostAdapter: adapter,
        chainApi: api,
        currentAccount: () => testAccount,
        priority: 'host-only',
      });

      const result = await provider.getCurrentAlias();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('alice');
        expect(result.source).toBe('host');
      }
    });

    it('returns host_unavailable when not in hosted mode', async () => {
      const adapter = createMockAdapter({ isHosted: vi.fn().mockReturnValue(false) });
      const { api } = createMockApi();

      const provider = createCurrentAliasProvider({
        hostAdapter: adapter,
        chainApi: api,
        currentAccount: () => testAccount,
        priority: 'host-only',
      });

      const result = await provider.getCurrentAlias();

      expect(result).toEqual({
        ok: false,
        error: { code: 'host_unavailable', message: 'Not in hosted mode' },
      });
    });

    it('does not fall back to chain when host fails', async () => {
      const adapter = createMockAdapter({
        isHosted: vi.fn().mockReturnValue(true),
        getCurrentAlias: vi.fn().mockRejectedValue(new Error('Host error')),
      });
      const { api, accountAlias } = createMockApi();
      accountAlias.mockResolvedValue('bob');

      const provider = createCurrentAliasProvider({
        hostAdapter: adapter,
        chainApi: api,
        currentAccount: () => testAccount,
        priority: 'host-only',
      });

      const result = await provider.getCurrentAlias();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('network_error');
      }
      expect(accountAlias).not.toHaveBeenCalled();
    });
  });

  describe('chain-only priority', () => {
    it('returns chain result when available', async () => {
      const getCurrentAlias = vi.fn().mockResolvedValue(null);
      const adapter = createMockAdapter({ getCurrentAlias });
      const { api, accountAlias } = createMockApi();
      accountAlias.mockResolvedValue('bob');

      const provider = createCurrentAliasProvider({
        hostAdapter: adapter,
        chainApi: api,
        currentAccount: () => testAccount,
        priority: 'chain-only',
      });

      const result = await provider.getCurrentAlias();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('bob');
        expect(result.source).toBe('chain');
      }
      expect(getCurrentAlias).not.toHaveBeenCalled();
    });

    it('returns chain_unavailable when no account connected', async () => {
      const adapter = createMockAdapter();
      const { api } = createMockApi();

      const provider = createCurrentAliasProvider({
        hostAdapter: adapter,
        chainApi: api,
        currentAccount: () => null,
        priority: 'chain-only',
      });

      const result = await provider.getCurrentAlias();

      expect(result).toEqual({
        ok: false,
        error: { code: 'chain_unavailable', message: 'No account connected for chain query' },
      });
    });

    it('returns chain_unavailable when chain API not configured', async () => {
      const adapter = createMockAdapter();

      const provider = createCurrentAliasProvider({
        hostAdapter: adapter,
        currentAccount: () => testAccount,
        priority: 'chain-only',
      });

      const result = await provider.getCurrentAlias();

      expect(result).toEqual({
        ok: false,
        error: { code: 'chain_unavailable', message: 'No account connected for chain query' },
      });
    });
  });

  describe('chain-first priority', () => {
    it('returns chain result when chain succeeds', async () => {
      const adapter = createMockAdapter();
      const { api, accountAlias } = createMockApi();
      accountAlias.mockResolvedValue('bob');

      const provider = createCurrentAliasProvider({
        hostAdapter: adapter,
        chainApi: api,
        currentAccount: () => testAccount,
        priority: 'chain-first',
      });

      const result = await provider.getCurrentAlias();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('bob');
        expect(result.source).toBe('chain');
      }
    });

    it('falls back to host when chain fails', async () => {
      const adapter = createMockAdapter({
        isHosted: vi.fn().mockReturnValue(true),
        getCurrentAlias: vi.fn().mockResolvedValue('alice'),
      });
      const { api, accountAlias } = createMockApi();
      accountAlias.mockRejectedValue(new Error('Chain error'));

      const provider = createCurrentAliasProvider({
        hostAdapter: adapter,
        chainApi: api,
        currentAccount: () => testAccount,
        priority: 'chain-first',
      });

      const result = await provider.getCurrentAlias();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('alice');
        expect(result.source).toBe('host');
      }
    });

    it('returns chain_unavailable when no account and no host', async () => {
      const adapter = createMockAdapter({ isHosted: vi.fn().mockReturnValue(false) });
      const { api } = createMockApi();

      const provider = createCurrentAliasProvider({
        hostAdapter: adapter,
        chainApi: api,
        currentAccount: () => null,
        priority: 'chain-first',
      });

      const result = await provider.getCurrentAlias();

      expect(result).toEqual({
        ok: false,
        error: {
          code: 'chain_unavailable',
          message: 'Chain query failed and no host fallback',
        },
      });
    });
  });

  describe('subscribeCurrentAlias', () => {
    it('emits current value immediately', async () => {
      const adapter = createMockAdapter({
        isHosted: vi.fn().mockReturnValue(true),
        getCurrentAlias: vi.fn().mockResolvedValue('alice'),
      });

      const provider = createCurrentAliasProvider({
        hostAdapter: adapter,
        priority: 'host-first',
      });

      const callback = vi.fn();
      provider.subscribeCurrentAlias(callback);

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

    it('uses adapter subscription for host-first mode', () => {
      const unsubscribeFn = vi.fn();
      const subscribeCurrentAlias = vi.fn((_cb: (alias: string | null) => void) => unsubscribeFn);

      const adapter = createMockAdapter({
        isHosted: vi.fn().mockReturnValue(true),
        getCurrentAlias: vi.fn().mockResolvedValue('alice'),
        subscribeCurrentAlias,
      });

      const provider = createCurrentAliasProvider({
        hostAdapter: adapter,
        priority: 'host-first',
      });

      const callback = vi.fn();
      const unsubscribe = provider.subscribeCurrentAlias(callback);

      expect(subscribeCurrentAlias).toHaveBeenCalled();

      unsubscribe();
      expect(unsubscribeFn).toHaveBeenCalled();
    });

    it('returns no-op for chain-only mode', () => {
      const { api, accountAlias } = createMockApi();
      accountAlias.mockResolvedValue('bob');

      const provider = createCurrentAliasProvider({
        chainApi: api,
        currentAccount: () => testAccount,
        priority: 'chain-only',
      });

      const callback = vi.fn();
      const unsubscribe = provider.subscribeCurrentAlias(callback);

      // Should not throw
      expect(() => unsubscribe()).not.toThrow();
    });
  });
});
