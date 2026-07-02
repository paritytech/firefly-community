/**
 * Tests for native PAS payment primitive.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the chain client before importing the module under test.
vi.mock('./client', () => ({
  getFireflyChainAPI: vi.fn(),
}));

import {
  transferNativePAS,
  getNativeBalance,
  pusdUnitsToPasPlanck,
  PAS_DECIMALS,
} from './native-payment';
import { getFireflyChainAPI } from './client';

const mockGetApi = vi.mocked(getFireflyChainAPI);

interface MockTx {
  signAndSubmit: ReturnType<typeof vi.fn>;
}

function buildApi(opts: { signAndSubmit?: ReturnType<typeof vi.fn>; accountFree?: bigint }): {
  api: unknown;
  transferKeepAlive: ReturnType<typeof vi.fn>;
  tx: MockTx;
} {
  const tx: MockTx = {
    signAndSubmit: opts.signAndSubmit ?? vi.fn(),
  };
  const transferKeepAlive = vi.fn(() => tx);
  const api = {
    assetHub: {
      tx: { Balances: { transfer_keep_alive: transferKeepAlive } },
      query: {
        System: {
          Account: {
            getValue: vi.fn().mockResolvedValue({
              data: { free: opts.accountFree ?? 0n },
            }),
          },
        },
      },
    },
  };
  return { api, transferKeepAlive, tx };
}

const SIGNER = { publicKey: new Uint8Array() } as never;
const RECIPIENT = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

describe('pusdUnitsToPasPlanck', () => {
  it('scales 6-decimal pUSD units to 10-decimal PAS planck', () => {
    // 1 unit at 6 decimals = 1_000_000; same value at 10 decimals = 10_000_000_000
    expect(pusdUnitsToPasPlanck(1_000_000n)).toBe(10_000_000_000n);
    expect(pusdUnitsToPasPlanck(0n)).toBe(0n);
  });

  it('exposes 10 as the PAS decimal count', () => {
    expect(PAS_DECIMALS).toBe(10);
  });
});

describe('transferNativePAS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('submits transfer_keep_alive with the recipient and amount, returning hashes', async () => {
    const signAndSubmit = vi.fn().mockResolvedValue({
      ok: true,
      txHash: '0xabc',
      block: { hash: '0xblock' },
    });
    const { api, transferKeepAlive } = buildApi({ signAndSubmit });
    mockGetApi.mockResolvedValue(api as never);

    const result = await transferNativePAS({
      to: RECIPIENT,
      amountPlanck: 5_000_000_000n,
      signer: SIGNER,
    });

    expect(transferKeepAlive).toHaveBeenCalledTimes(1);
    const arg = transferKeepAlive.mock.calls[0]?.[0] as { dest: unknown; value: bigint };
    expect(arg.value).toBe(5_000_000_000n);
    expect(arg.dest).toEqual({ type: 'Id', value: RECIPIENT });
    expect(result).toEqual({ txHash: '0xabc', blockHash: '0xblock' });
  });

  it('rejects a non-positive amount without touching the chain', async () => {
    const { api, transferKeepAlive } = buildApi({});
    mockGetApi.mockResolvedValue(api as never);

    await expect(
      transferNativePAS({ to: RECIPIENT, amountPlanck: 0n, signer: SIGNER })
    ).rejects.toThrow('greater than zero');
    expect(transferKeepAlive).not.toHaveBeenCalled();
  });

  it('fails closed when the dispatch reports an error', async () => {
    const signAndSubmit = vi.fn().mockResolvedValue({
      ok: false,
      dispatchError: { type: 'Token' },
      txHash: '0xdead',
      block: { hash: '0xblock' },
    });
    const { api } = buildApi({ signAndSubmit });
    mockGetApi.mockResolvedValue(api as never);

    await expect(
      transferNativePAS({ to: RECIPIENT, amountPlanck: 1n, signer: SIGNER })
    ).rejects.toThrow('failed on chain');
  });

  it('fails closed when finalization exceeds the timeout', async () => {
    vi.useFakeTimers();
    const signAndSubmit = vi.fn().mockReturnValue(new Promise(() => undefined)); // never resolves
    const { api } = buildApi({ signAndSubmit });
    mockGetApi.mockResolvedValue(api as never);

    const promise = transferNativePAS({
      to: RECIPIENT,
      amountPlanck: 1n,
      signer: SIGNER,
      timeoutMs: 1000,
    });
    const assertion = expect(promise).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});

describe('getNativeBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the free balance for an account', async () => {
    const { api } = buildApi({ accountFree: 42n });
    mockGetApi.mockResolvedValue(api as never);

    expect(await getNativeBalance(RECIPIENT)).toBe(42n);
  });

  it('returns 0n for an account with no balance (defaulted System.Account)', async () => {
    const { api } = buildApi({ accountFree: 0n });
    mockGetApi.mockResolvedValue(api as never);

    expect(await getNativeBalance(RECIPIENT)).toBe(0n);
  });
});
