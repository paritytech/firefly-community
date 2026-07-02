/**
 * Behavioural tests for useBountyEscrow.
 *
 * The ethers Contract boundary is mocked: `getFunction(name)` returns a
 * per-method jest fn whose resolved value we control, so we can assert the
 * exact arguments the hook encodes (bytes32 id, native-asset sentinel, msg.value),
 * the loading/error state transitions around writes, and the read-path error
 * fallbacks. Nothing inside the hook itself is mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useBountyEscrow } from './useBountyEscrow';
import { BountyStatus } from '@/lib/chain/evm/abis';
import type { ethers as EthersNS } from 'ethers';

// Per-method mock functions keyed by contract function name. Each test sets the
// behaviour of the method it exercises. getFunction returns the matching fn.
const fns = new Map<string, ReturnType<typeof vi.fn>>();
function fn(name: string): ReturnType<typeof vi.fn> {
  let f = fns.get(name);
  if (!f) {
    f = vi.fn();
    fns.set(name, f);
  }
  return f;
}

const contractCtor = vi.fn();

vi.mock('ethers', () => ({
  ethers: {
    ZeroAddress: '0x0000000000000000000000000000000000000000',
    JsonRpcProvider: vi.fn().mockImplementation(() => ({ _isProvider: true })),
    Contract: vi.fn().mockImplementation((address: string, _abi: unknown, runner: unknown) => {
      contractCtor(address, runner);
      return { getFunction: (name: string) => fn(name) };
    }),
    // Use real-ish hashing semantics: deterministic 32-byte hex derived from input.
    keccak256: (bytes: Uint8Array) => {
      // Simple deterministic hash for assertion stability.
      let h = 0;
      for (const b of bytes) h = (h * 31 + b) >>> 0;
      return '0x' + h.toString(16).padStart(64, '0');
    },
    toUtf8Bytes: (s: string) => new TextEncoder().encode(s),
  },
}));

vi.mock('@/lib/chain/evm/config', () => ({
  getContractAddress: vi.fn().mockReturnValue('0x1234567890123456789012345678901234567890'),
  getRpcUrl: vi.fn().mockReturnValue('http://localhost:8545'),
}));

const NATIVE = '0x0000000000000000000000000000000000000000';

/** A fake signer object — its identity is what matters for write-contract wiring. */
const signer = { signerTag: true } as unknown as EthersNS.Signer;

/** Build a fake tx whose wait() resolves to a receipt with the given hash. */
function txResolving(hash: string): { wait: () => Promise<{ hash: string }> } {
  return { wait: vi.fn().mockResolvedValue({ hash }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  fns.clear();
});

describe('useBountyEscrow toBountyId', () => {
  it('hashes the id to a bytes32 hex string and is deterministic', () => {
    const { result } = renderHook(() => useBountyEscrow());
    const a = result.current.toBountyId('bounty-1');
    const b = result.current.toBountyId('bounty-1');
    const c = result.current.toBountyId('bounty-2');
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(a).toBe(b); // deterministic
    expect(a).not.toBe(c); // distinct inputs → distinct ids
  });
});

describe('useBountyEscrow.fundBounty', () => {
  it('encodes a native-asset funding call with the hashed id and matching msg.value, and returns the receipt hash', async () => {
    fn('fundBounty').mockResolvedValue(txResolving('0xreceipt'));
    const { result } = renderHook(() => useBountyEscrow());
    const expectedId = result.current.toBountyId('b-native');

    let hash: string | undefined;
    await act(async () => {
      hash = await result.current.fundBounty(signer, 'b-native', 5_000n, 1_900_000_000);
    });

    expect(hash).toBe('0xreceipt');
    // Argument encoding: (id, asset, amount, expiresAt, overrides)
    expect(fn('fundBounty')).toHaveBeenCalledWith(expectedId, NATIVE, 5_000n, 1_900_000_000, {
      value: 5_000n, // native asset ⇒ value equals amount
    });
    // Write path used a signer-bound contract.
    expect(contractCtor).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890', signer);
  });

  it('sends zero msg.value when funding with an ERC-20 payment asset', async () => {
    fn('fundBounty').mockResolvedValue(txResolving('0xerc20'));
    const erc20 = '0xabcabcabcabcabcabcabcabcabcabcabcabcabca';
    const { result } = renderHook(() => useBountyEscrow());

    await act(async () => {
      await result.current.fundBounty(signer, 'b-erc20', 9n, 123, erc20);
    });

    const call = fn('fundBounty').mock.calls[0];
    expect(call?.[1]).toBe(erc20);
    expect(call?.[4]).toEqual({ value: 0n }); // non-native ⇒ no native value attached
  });

  it('clears loading and stays error-free after a successful fund', async () => {
    fn('fundBounty').mockResolvedValue(txResolving('0xok'));
    const { result } = renderHook(() => useBountyEscrow());

    await act(async () => {
      await result.current.fundBounty(signer, 'b', 1n, 1);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('surfaces the failure message in state and re-throws when the tx rejects', async () => {
    fn('fundBounty').mockRejectedValue(new Error('insufficient funds'));
    const { result } = renderHook(() => useBountyEscrow());

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.fundBounty(signer, 'b', 1n, 1).catch((e: unknown) => e);
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe('insufficient funds');
    expect(result.current.error).toBe('insufficient funds');
    expect(result.current.isLoading).toBe(false);
  });

  it('returns empty string when the receipt is null (tx mined without receipt)', async () => {
    fn('fundBounty').mockResolvedValue({ wait: vi.fn().mockResolvedValue(null) });
    const { result } = renderHook(() => useBountyEscrow());

    let hash: string | undefined;
    await act(async () => {
      hash = await result.current.fundBounty(signer, 'b', 1n, 1);
    });
    expect(hash).toBe('');
  });
});

describe('useBountyEscrow.releaseBounty / cancelBounty / claimExpired', () => {
  it('releaseBounty passes the hashed id and the allocations array through unchanged', async () => {
    fn('releaseBounty').mockResolvedValue(txResolving('0xrel'));
    const { result } = renderHook(() => useBountyEscrow());
    const id = result.current.toBountyId('rel-1');
    const allocations = [{ recipient: '0xrec', amount: 7n }];

    let hash: string | undefined;
    await act(async () => {
      hash = await result.current.releaseBounty(signer, 'rel-1', allocations);
    });

    expect(hash).toBe('0xrel');
    expect(fn('releaseBounty')).toHaveBeenCalledWith(id, allocations);
  });

  it('cancelBounty records the error message when the call reverts', async () => {
    fn('cancelBounty').mockRejectedValue(new Error('not funder'));
    const { result } = renderHook(() => useBountyEscrow());

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.cancelBounty(signer, 'c-1').catch((e: unknown) => e);
    });
    expect((thrown as Error).message).toBe('not funder');
    expect(result.current.error).toBe('not funder');
  });

  it('claimExpired calls the contract with only the hashed id', async () => {
    fn('claimExpired').mockResolvedValue(txResolving('0xexp'));
    const { result } = renderHook(() => useBountyEscrow());
    const id = result.current.toBountyId('exp-1');

    await act(async () => {
      await result.current.claimExpired(signer, 'exp-1');
    });
    expect(fn('claimExpired')).toHaveBeenCalledWith(id);
  });
});

describe('useBountyEscrow read methods', () => {
  it('getBounty returns null without calling getBounty when the bounty does not exist', async () => {
    fn('bountyExists').mockResolvedValue(false);
    const { result } = renderHook(() => useBountyEscrow());

    const bounty = await result.current.getBounty('missing');

    expect(bounty).toBeNull();
    expect(fn('getBounty')).not.toHaveBeenCalled();
  });

  it('getBounty maps the raw struct to OnChainBounty, narrowing the numeric status', async () => {
    fn('bountyExists').mockResolvedValue(true);
    fn('getBounty').mockResolvedValue({
      funder: '0xfund',
      paymentAsset: NATIVE,
      amount: 42n,
      expiresAt: 1700n,
      status: 1n, // CLOSED, as a bigint from ethers
    });
    const { result } = renderHook(() => useBountyEscrow());

    const bounty = await result.current.getBounty('b');

    expect(bounty).toEqual({
      funder: '0xfund',
      paymentAsset: NATIVE,
      amount: 42n,
      expiresAt: 1700n,
      status: BountyStatus.CLOSED,
    });
    expect(typeof bounty?.status).toBe('number');
  });

  it('getBounty swallows read errors and returns null', async () => {
    fn('bountyExists').mockRejectedValue(new Error('rpc down'));
    const { result } = renderHook(() => useBountyEscrow());
    await expect(result.current.getBounty('b')).resolves.toBeNull();
  });

  it('bountyExists / isExpired / isPaused return false on read failure (fail-safe)', async () => {
    fn('bountyExists').mockRejectedValue(new Error('x'));
    fn('isExpired').mockRejectedValue(new Error('x'));
    fn('paused').mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useBountyEscrow());

    expect(await result.current.bountyExists('b')).toBe(false);
    expect(await result.current.isExpired('b')).toBe(false);
    expect(await result.current.isPaused()).toBe(false);
  });

  it('isPaused passes the boolean through when the read succeeds', async () => {
    fn('paused').mockResolvedValue(true);
    const { result } = renderHook(() => useBountyEscrow());
    expect(await result.current.isPaused()).toBe(true);
  });

  it('read methods build a read-only (provider-bound) contract, not a signer one', async () => {
    fn('paused').mockResolvedValue(false);
    const { result } = renderHook(() => useBountyEscrow());
    await result.current.isPaused();
    // Read contract runner is the JsonRpcProvider instance, never the signer.
    const firstCall = contractCtor.mock.calls[0];
    expect(firstCall).toBeDefined();
    const runner = firstCall?.[1] as { _isProvider?: boolean } | undefined;
    expect(runner?._isProvider).toBe(true);
  });
});

describe('useBountyEscrow contract address resolution', () => {
  it('falls back to false when the contract is not deployed (read guard throws, caught)', async () => {
    const config = await import('@/lib/chain/evm/config');
    vi.mocked(config.getContractAddress).mockReturnValue(null);
    const { result } = renderHook(() => useBountyEscrow());

    // contractAddress useMemo reports null and getReadContract throws "not deployed";
    // bountyExists's try/catch turns the throw into a fail-safe false.
    expect(result.current.contractAddress).toBeNull();
    await expect(result.current.bountyExists('b')).resolves.toBe(false);
  });
});
