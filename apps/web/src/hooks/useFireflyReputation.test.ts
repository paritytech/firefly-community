/**
 * Behavioural tests for useFireflyReputation.
 *
 * The ethers Contract boundary is mocked so we control each read's resolved
 * value; everything inside the hook (hash derivation, bigint→number coercion,
 * multi-topic map assembly, default-on-error fallbacks) runs for real and is
 * asserted. Nothing inside the hook is mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFireflyReputation } from './useFireflyReputation';
import { DEFAULT_TOPICS } from '@/lib/chain/evm/abis';

const fns = new Map<string, ReturnType<typeof vi.fn>>();
function fn(name: string): ReturnType<typeof vi.fn> {
  let f = fns.get(name);
  if (!f) {
    f = vi.fn();
    fns.set(name, f);
  }
  return f;
}

vi.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: vi.fn().mockImplementation(() => ({})),
    Contract: vi.fn().mockImplementation(() => ({
      getFunction: (name: string) => fn(name),
    })),
    keccak256: (bytes: Uint8Array) => {
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

beforeEach(() => {
  vi.clearAllMocks();
  fns.clear();
});

describe('useFireflyReputation hashing', () => {
  it('hashes a plain credential string to bytes32 but passes through an existing bytes32', () => {
    const { result } = renderHook(() => useFireflyReputation());
    const plain = result.current.toCredentialHash('did:example:alice');
    const existing = '0x' + 'a'.repeat(64);

    expect(plain).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.current.toCredentialHash(existing)).toBe(existing); // already a hash → unchanged
    // A 0x-prefixed string of the wrong length is still hashed, not passed through.
    expect(result.current.toCredentialHash('0xdeadbeef')).not.toBe('0xdeadbeef');
  });

  it('topic hashing is deterministic and distinct per topic', () => {
    const { result } = renderHook(() => useFireflyReputation());
    expect(result.current.toTopicHash('economy')).toBe(result.current.toTopicHash('economy'));
    expect(result.current.toTopicHash('economy')).not.toBe(result.current.toTopicHash('health'));
  });
});

describe('useFireflyReputation.getScore', () => {
  it('passes the hashed credential and topic to the contract and coerces the bigint result to a number', async () => {
    fn('getScore').mockResolvedValue(742n);
    const { result } = renderHook(() => useFireflyReputation());
    const credHash = result.current.toCredentialHash('alice');
    const topicHash = result.current.toTopicHash('economy');

    const score = await result.current.getScore('alice', 'economy');

    expect(score).toBe(742);
    expect(typeof score).toBe('number');
    expect(fn('getScore')).toHaveBeenCalledWith(credHash, topicHash);
  });

  it('falls back to the default score of 500 on read failure', async () => {
    fn('getScore').mockRejectedValue(new Error('rpc down'));
    const { result } = renderHook(() => useFireflyReputation());
    expect(await result.current.getScore('alice', 'economy')).toBe(500);
  });
});

describe('useFireflyReputation.getTopicScore', () => {
  it('coerces every numeric field but preserves lastUpdated as a bigint', async () => {
    fn('getTopicScore').mockResolvedValue({
      score: 600n,
      corroborationsGiven: 3n,
      corroborationsReceived: 9n,
      challengesWon: 2n,
      challengesLost: 1n,
      lastUpdated: 1_700_000_000n,
    });
    const { result } = renderHook(() => useFireflyReputation());

    const ts = await result.current.getTopicScore('alice', 'economy');

    expect(ts).toEqual({
      score: 600,
      corroborationsGiven: 3,
      corroborationsReceived: 9,
      challengesWon: 2,
      challengesLost: 1,
      lastUpdated: 1_700_000_000n,
    });
    expect(typeof ts.score).toBe('number');
    expect(typeof ts.lastUpdated).toBe('bigint');
  });

  it('returns a default neutral score struct on failure', async () => {
    fn('getTopicScore').mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useFireflyReputation());
    const ts = await result.current.getTopicScore('alice', 'economy');
    expect(ts.score).toBe(500);
    expect(ts.lastUpdated).toBe(0n);
  });
});

describe('useFireflyReputation.getScores / getAllDefaultScores', () => {
  it('builds a topic→score map preserving order alignment with the requested topics', async () => {
    // Contract returns scores positionally; the hook must zip them back to topic names.
    fn('getScores').mockResolvedValue([100n, 200n, 300n]);
    const { result } = renderHook(() => useFireflyReputation());

    const map = await result.current.getScores('alice', ['economy', 'health', 'politics']);

    expect(map.get('economy')).toBe(100);
    expect(map.get('health')).toBe(200);
    expect(map.get('politics')).toBe(300);
  });

  it('returns a default-500 map for every requested topic on failure', async () => {
    fn('getScores').mockRejectedValue(new Error('rpc'));
    const { result } = renderHook(() => useFireflyReputation());

    const map = await result.current.getScores('alice', ['economy', 'health']);
    expect(map.get('economy')).toBe(500);
    expect(map.get('health')).toBe(500);
    expect(map.size).toBe(2);
  });

  it('getAllDefaultScores requests exactly the DEFAULT_TOPICS and maps them all', async () => {
    fn('getScores').mockResolvedValue(DEFAULT_TOPICS.map((_, i) => BigInt(i + 1)));
    const { result } = renderHook(() => useFireflyReputation());

    const map = await result.current.getAllDefaultScores('alice');

    expect(map.size).toBe(DEFAULT_TOPICS.length);
    // The credential is hashed; the topics passed are the default set, in order.
    const [, topicHashes] = fn('getScores').mock.calls[0] as [string, string[]];
    expect(topicHashes).toHaveLength(DEFAULT_TOPICS.length);
    expect(map.get('economy')).toBe(1);
  });
});

describe('useFireflyReputation topic registry reads', () => {
  it('getTopics returns the contract array and getTopicCount coerces the count', async () => {
    fn('getTopics').mockResolvedValue(['0xaaa', '0xbbb']);
    fn('topicCount').mockResolvedValue(2n);
    const { result } = renderHook(() => useFireflyReputation());

    expect(await result.current.getTopics()).toEqual(['0xaaa', '0xbbb']);
    expect(await result.current.getTopicCount()).toBe(2);
  });

  it('getTopics returns [] and getTopicCount returns 0 on failure', async () => {
    fn('getTopics').mockRejectedValue(new Error('x'));
    fn('topicCount').mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useFireflyReputation());

    expect(await result.current.getTopics()).toEqual([]);
    expect(await result.current.getTopicCount()).toBe(0);
  });

  it('isTopicRegistered hashes the topic and forwards the boolean; isUpdater forwards the address verbatim', async () => {
    fn('isRegisteredTopic').mockResolvedValue(true);
    fn('updaters').mockResolvedValue(false);
    const { result } = renderHook(() => useFireflyReputation());
    const topicHash = result.current.toTopicHash('economy');

    expect(await result.current.isTopicRegistered('economy')).toBe(true);
    expect(fn('isRegisteredTopic')).toHaveBeenCalledWith(topicHash);

    expect(await result.current.isUpdater('0xUPDATER')).toBe(false);
    expect(fn('updaters')).toHaveBeenCalledWith('0xUPDATER');
  });

  it('isTopicRegistered / isUpdater fail safe to false', async () => {
    fn('isRegisteredTopic').mockRejectedValue(new Error('x'));
    fn('updaters').mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useFireflyReputation());
    expect(await result.current.isTopicRegistered('economy')).toBe(false);
    expect(await result.current.isUpdater('0x0')).toBe(false);
  });
});

describe('useFireflyReputation.getConstants', () => {
  it('reads the three constants in parallel and coerces them to numbers', async () => {
    fn('DEFAULT_SCORE').mockResolvedValue(500n);
    fn('MIN_SCORE').mockResolvedValue(0n);
    fn('MAX_SCORE').mockResolvedValue(1000n);
    const { result } = renderHook(() => useFireflyReputation());

    expect(await result.current.getConstants()).toEqual({
      defaultScore: 500,
      minScore: 0,
      maxScore: 1000,
    });
  });

  it('returns sensible defaults if any constant read rejects', async () => {
    fn('DEFAULT_SCORE').mockResolvedValue(500n);
    fn('MIN_SCORE').mockRejectedValue(new Error('x'));
    fn('MAX_SCORE').mockResolvedValue(1000n);
    const { result } = renderHook(() => useFireflyReputation());

    expect(await result.current.getConstants()).toEqual({
      defaultScore: 500,
      minScore: 0,
      maxScore: 1000,
    });
  });
});
