/**
 * Tests for DotNS Directory (chain-based resolution)
 *
 * @license GPL-3.0
 */

import { describe, it, expect, vi } from 'vitest';
import { createDotNsDirectory } from '../directory';
import type { DotNsGatewayApi } from '../../dotns-gateway';
import type { PolkadotAddress } from '@cocuyo/types';

interface MockApiResult {
  api: DotNsGatewayApi;
  aliasRegistration: ReturnType<typeof vi.fn>;
  accountAlias: ReturnType<typeof vi.fn>;
  liteLabelOwner: ReturnType<typeof vi.fn>;
}

describe('createDotNsDirectory', () => {
  function createMockApi(): MockApiResult {
    const aliasRegistration = vi.fn().mockResolvedValue(undefined);
    const accountAlias = vi.fn().mockResolvedValue(undefined);
    const liteLabelOwner = vi.fn().mockResolvedValue(undefined);

    const api: DotNsGatewayApi = {
      query: {
        DotnsGateway: {
          AliasRegistration: { getValue: aliasRegistration },
          AccountAlias: { getValue: accountAlias },
          LiteLabelOwner: { getValue: liteLabelOwner },
        },
      },
    };

    return { api, aliasRegistration, accountAlias, liteLabelOwner };
  }

  describe('resolveAlias', () => {
    it('returns invalid_input for invalid alias format', async () => {
      const { api } = createMockApi();
      const directory = createDotNsDirectory(api);

      const result = await directory.resolveAlias('INVALID!@#');

      expect(result).toEqual({
        ok: false,
        error: {
          code: 'invalid_input',
          message: 'Invalid alias format',
          field: 'alias',
        },
      });
    });

    it('normalizes alias to lowercase', async () => {
      const { api, aliasRegistration } = createMockApi();
      const directory = createDotNsDirectory(api);

      await directory.resolveAlias('ALICE');

      expect(aliasRegistration).toHaveBeenCalledWith('alice');
    });

    it('trims whitespace from alias', async () => {
      const { api, aliasRegistration } = createMockApi();
      const directory = createDotNsDirectory(api);

      await directory.resolveAlias('  alice  ');

      expect(aliasRegistration).toHaveBeenCalledWith('alice');
    });

    it('returns null when alias is not registered', async () => {
      const { api } = createMockApi();
      const directory = createDotNsDirectory(api);

      const result = await directory.resolveAlias('alice');

      expect(result).toEqual({
        ok: true,
        value: null,
        source: 'chain',
        fetchedAt: expect.any(Number) as number,
      });
    });

    it('returns registration record when alias exists', async () => {
      const mockAccount = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const { api, aliasRegistration } = createMockApi();
      aliasRegistration.mockResolvedValue({
        collection: { type: 'People' },
        account: mockAccount,
      });
      const directory = createDotNsDirectory(api);

      const result = await directory.resolveAlias('alice');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          collection: 'People',
          account: mockAccount,
        });
        expect(result.source).toBe('chain');
      }
    });

    it('accepts valid lite labels', async () => {
      const { api } = createMockApi();
      const directory = createDotNsDirectory(api);

      const result = await directory.resolveAlias('alice.42');

      expect(result.ok).toBe(true);
    });

    it('returns chain_unavailable when chain throws', async () => {
      const { api, aliasRegistration } = createMockApi();
      aliasRegistration.mockRejectedValue(new Error('Chain error'));
      const directory = createDotNsDirectory(api);

      const result = await directory.resolveAlias('alice');

      expect(result).toEqual({
        ok: false,
        error: { code: 'chain_unavailable', message: 'Chain error' },
      });
    });
  });

  describe('getAccountAlias', () => {
    const testAccount = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' as PolkadotAddress;

    it('returns null when account has no alias', async () => {
      const { api } = createMockApi();
      const directory = createDotNsDirectory(api);

      const result = await directory.getAccountAlias(testAccount);

      expect(result).toEqual({
        ok: true,
        value: null,
        source: 'chain',
        fetchedAt: expect.any(Number) as number,
      });
    });

    it('returns alias when account has one', async () => {
      const { api, accountAlias } = createMockApi();
      accountAlias.mockResolvedValue('alice');
      const directory = createDotNsDirectory(api);

      const result = await directory.getAccountAlias(testAccount);

      expect(result).toEqual({
        ok: true,
        value: 'alice',
        source: 'chain',
        fetchedAt: expect.any(Number) as number,
      });
    });

    it('returns chain_unavailable when chain throws', async () => {
      const { api, accountAlias } = createMockApi();
      accountAlias.mockRejectedValue(new Error('Connection lost'));
      const directory = createDotNsDirectory(api);

      const result = await directory.getAccountAlias(testAccount);

      expect(result).toEqual({
        ok: false,
        error: { code: 'chain_unavailable', message: 'Connection lost' },
      });
    });
  });

  describe('getLiteLabelOwner', () => {
    it('returns null when lite label has no owner', async () => {
      const { api } = createMockApi();
      const directory = createDotNsDirectory(api);

      const result = await directory.getLiteLabelOwner('alice.42');

      expect(result).toEqual({
        ok: true,
        value: null,
        source: 'chain',
        fetchedAt: expect.any(Number) as number,
      });
    });

    it('returns owner when lite label is owned', async () => {
      const owner = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
      const { api, liteLabelOwner } = createMockApi();
      liteLabelOwner.mockResolvedValue(owner);
      const directory = createDotNsDirectory(api);

      const result = await directory.getLiteLabelOwner('alice.42');

      expect(result).toEqual({
        ok: true,
        value: owner,
        source: 'chain',
        fetchedAt: expect.any(Number) as number,
      });
    });

    it('returns chain_unavailable when chain throws', async () => {
      const { api, liteLabelOwner } = createMockApi();
      liteLabelOwner.mockRejectedValue(new Error('Timeout'));
      const directory = createDotNsDirectory(api);

      const result = await directory.getLiteLabelOwner('alice.42');

      expect(result).toEqual({
        ok: false,
        error: { code: 'chain_unavailable', message: 'Timeout' },
      });
    });
  });

  describe('canRegister', () => {
    const testAccount = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' as PolkadotAddress;

    it('returns eligible when all checks pass', async () => {
      const { api } = createMockApi();
      const directory = createDotNsDirectory(api);

      const result = await directory.canRegister(testAccount, 'alice');

      expect(result.eligible).toBe(true);
    });

    it('returns not eligible when account already has alias', async () => {
      const { api, accountAlias } = createMockApi();
      accountAlias.mockResolvedValue('existingalias');
      const directory = createDotNsDirectory(api);

      const result = await directory.canRegister(testAccount, 'alice');

      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reason).toBe('account_has_alias');
      }
    });

    it('returns not eligible when alias is taken', async () => {
      const { api, aliasRegistration } = createMockApi();
      aliasRegistration.mockResolvedValue({
        collection: { type: 'People' },
        account: 'someoneelse',
      });
      const directory = createDotNsDirectory(api);

      const result = await directory.canRegister(testAccount, 'alice');

      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reason).toBe('alias_taken');
      }
    });

    it('returns network_error when chain throws', async () => {
      const { api, accountAlias } = createMockApi();
      accountAlias.mockRejectedValue(new Error('Network error'));
      const directory = createDotNsDirectory(api);

      const result = await directory.canRegister(testAccount, 'alice');

      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reason).toBe('network_error');
      }
    });
  });
});
