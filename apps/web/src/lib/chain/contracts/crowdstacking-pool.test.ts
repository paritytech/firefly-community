/**
 * Tests for the CrowdstackingPool revive client.
 *
 * Focus on the fail-closed / honest-unknown posture for the live chain path:
 * - getPoolState reads the real `paused()` value (open == !paused) and fails
 *   CLOSED (reports paused) when the read reverts.
 * - requestWithdrawal fails CLOSED rather than fabricating a `wr-${Date.now()}`
 *   id that does not exist on chain.
 * - completeWithdrawal reports `assets` as honestly unknown (null), never 0n.
 *
 * `callContract` / `sendContractTx` are mocked so nothing touches a chain.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { crowdstackingPoolInterface } from '../abi/crowdstacking-pool';

vi.mock('../revive', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../revive')>();
  return { ...actual, callContract: vi.fn(), sendContractTx: vi.fn() };
});

vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>();
  return {
    ...actual,
    requireContractAddress: vi.fn(() => '0xAA3Db3F2BD6E5D0c7C44e8BFc51Ba79A6d65773A'),
  };
});

import { callContract, sendContractTx } from '../revive';
import { CrowdstackingPoolClient } from './crowdstacking-pool';

const mockCall = vi.mocked(callContract);
const mockSend = vi.mocked(sendContractTx);

const POOL = '0xAA3Db3F2BD6E5D0c7C44e8BFc51Ba79A6d65773A';
const TOKEN = '0xBB3Db3F2BD6E5D0c7C44e8BFc51Ba79A6d65773A'; // gitleaks:allow — synthetic mock EVM address, not a secret
const SIGNER = { publicKey: new Uint8Array(32) } as never;

/** ABI-encode a function's return value as the bytes a read would yield. */
function encodeResult(fn: string, values: readonly unknown[]): Uint8Array {
  const hex = crowdstackingPoolInterface.encodeFunctionResult(fn, values as unknown[]);
  return ethers_hexToBytes(hex);
}

function ethers_hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function makeClient(): CrowdstackingPoolClient {
  return new CrowdstackingPoolClient({ poolAddress: POOL, tokenAddress: TOKEN });
}

describe('CrowdstackingPoolClient.getPaused / getPoolState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports isPaused/isOpen from the real paused() read', async () => {
    // Route each read to the right encoded result by selector-free function name.
    mockCall.mockImplementation(({ calldata }) => {
      const fn = crowdstackingPoolInterface.parseTransaction({ data: calldata })?.name;
      switch (fn) {
        case 'totalShares':
          return Promise.resolve(encodeResult('totalShares', [10n]));
        case 'totalAssets':
          return Promise.resolve(encodeResult('totalAssets', [20n]));
        case 'sharePrice':
          return Promise.resolve(encodeResult('sharePrice', [1n]));
        case 'contributorCount':
          return Promise.resolve(encodeResult('contributorCount', [3n]));
        case 'paused':
          return Promise.resolve(encodeResult('paused', [true]));
        default:
          throw new Error(`unexpected call: ${fn ?? 'unknown'}`);
      }
    });

    const state = await makeClient().getPoolState();
    expect(state.isPaused).toBe(true);
    expect(state.isOpen).toBe(false);
  });

  it('open pool: isPaused false / isOpen true when paused() returns false', async () => {
    mockCall.mockImplementation(({ calldata }) => {
      const fn = crowdstackingPoolInterface.parseTransaction({ data: calldata })?.name;
      const map: Record<string, Uint8Array> = {
        totalShares: encodeResult('totalShares', [0n]),
        totalAssets: encodeResult('totalAssets', [0n]),
        sharePrice: encodeResult('sharePrice', [1n]),
        contributorCount: encodeResult('contributorCount', [0n]),
        paused: encodeResult('paused', [false]),
      };
      const out = fn !== undefined ? map[fn] : undefined;
      if (out === undefined) throw new Error(`unexpected call: ${fn ?? 'unknown'}`);
      return Promise.resolve(out);
    });

    const state = await makeClient().getPoolState();
    expect(state.isPaused).toBe(false);
    expect(state.isOpen).toBe(true);
  });

  it('fails CLOSED: a reverting paused() read reports the pool as paused, not open', async () => {
    const client = makeClient();
    mockCall.mockRejectedValue(new Error('revert'));
    await expect(client.getPaused()).resolves.toBe(true);
  });
});

describe('CrowdstackingPoolClient withdrawal write methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ txHash: '0xabc', blockHash: '0xblock', success: true });
  });

  it('requestWithdrawal fails CLOSED instead of fabricating a requestId', async () => {
    await expect(makeClient().requestWithdrawal(5n, SIGNER)).rejects.toThrow(/requestId/i);
    // The tx is still submitted; only the fake-id return is refused.
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('completeWithdrawal reports assets as unknown (null), never a fabricated 0n', async () => {
    const result = await makeClient().completeWithdrawal(1, SIGNER);
    expect(result.assets).toBeNull();
    expect(result.txHash).toBe('0xabc');
  });
});

describe('CrowdstackingPoolClient.getWithdrawalRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fabricate completedAt/amountReceived for completed requests', async () => {
    const completed = {
      requester: '0x1111111111111111111111111111111111111111',
      shares: 7n,
      requestedAt: 100n,
      availableAt: 200n,
      status: 1, // COMPLETED
    };
    mockCall.mockResolvedValue(
      encodeResult('getWithdrawalRequest', [
        [
          completed.requester,
          completed.shares,
          completed.requestedAt,
          completed.availableAt,
          completed.status,
        ],
      ])
    );

    const request = await makeClient().getWithdrawalRequest(1);
    expect(request).not.toBeNull();
    expect(request?.status).toBe('completed');
    // Genuinely unknown on-host — must be absent, not a fabricated value.
    expect(request?.completedAt).toBeUndefined();
    expect(request?.amountReceived).toBeUndefined();
  });
});
