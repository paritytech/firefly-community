/**
 * Tests for service utility functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setConnectedWallet,
  getConnectedWallet,
  isWalletConnected,
  getConnectedCredential,
  generatePseudonym,
  paginate,
  filterByString,
  filterByTopic,
  TTLCache,
  TTLListCache,
} from './service-utils';

describe('Wallet State Management', () => {
  beforeEach(() => {
    // Reset wallet state between tests
    setConnectedWallet(null);
  });

  describe('setConnectedWallet / getConnectedWallet', () => {
    it('stores and retrieves wallet address', () => {
      setConnectedWallet('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');

      expect(getConnectedWallet()).toBe('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
    });

    it('clears wallet address when set to null', () => {
      setConnectedWallet('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
      setConnectedWallet(null);

      expect(getConnectedWallet()).toBeNull();
    });
  });

  describe('isWalletConnected', () => {
    it('returns false when no wallet connected', () => {
      expect(isWalletConnected()).toBe(false);
    });

    it('returns true when wallet connected', () => {
      setConnectedWallet('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');

      expect(isWalletConnected()).toBe(true);
    });
  });

  describe('getConnectedCredential', () => {
    it('returns null when no wallet connected', () => {
      expect(getConnectedCredential()).toBeNull();
    });

    it('returns DIM credential when wallet connected', () => {
      setConnectedWallet('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');

      const credential = getConnectedCredential();
      expect(credential).not.toBeNull();
      expect(credential).toContain('dim-');
    });

    it('generates deterministic credential from address', () => {
      setConnectedWallet('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
      const credential1 = getConnectedCredential();

      setConnectedWallet('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
      const credential2 = getConnectedCredential();

      expect(credential1).toBe(credential2);
    });
  });
});

describe('generatePseudonym', () => {
  it('generates pseudonym from address', () => {
    const pseudonym = generatePseudonym('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');

    expect(pseudonym).toMatch(/^\w+ \w+$/);
  });

  it('generates deterministic pseudonym', () => {
    const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
    const pseudonym1 = generatePseudonym(address);
    const pseudonym2 = generatePseudonym(address);

    expect(pseudonym1).toBe(pseudonym2);
  });

  it('generates different pseudonyms for different addresses', () => {
    const pseudonym1 = generatePseudonym('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
    const pseudonym2 = generatePseudonym('5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty');

    expect(pseudonym1).not.toBe(pseudonym2);
  });
});

describe('Pagination Helpers', () => {
  describe('paginate', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    it('returns first page', () => {
      const result = paginate(items, { offset: 0, limit: 3 });

      expect(result.items).toEqual([1, 2, 3]);
      expect(result.total).toBe(10);
      expect(result.hasMore).toBe(true);
    });

    it('returns middle page', () => {
      const result = paginate(items, { offset: 3, limit: 3 });

      expect(result.items).toEqual([4, 5, 6]);
      expect(result.total).toBe(10);
      expect(result.hasMore).toBe(true);
    });

    it('returns last page', () => {
      const result = paginate(items, { offset: 9, limit: 3 });

      expect(result.items).toEqual([10]);
      expect(result.total).toBe(10);
      expect(result.hasMore).toBe(false);
    });

    it('returns empty array when offset exceeds total', () => {
      const result = paginate(items, { offset: 100, limit: 3 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(10);
      expect(result.hasMore).toBe(false);
    });

    it('handles empty array', () => {
      const result = paginate([], { offset: 0, limit: 10 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('filterByString', () => {
    const items = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }, { name: 'Alex' }];

    it('returns all items when no search term', () => {
      const result = filterByString(items, (i) => i.name, undefined);

      expect(result).toHaveLength(4);
    });

    it('filters by partial match', () => {
      const result = filterByString(items, (i) => i.name, 'li');

      expect(result).toHaveLength(2); // Alice, Charlie
    });

    it('is case insensitive', () => {
      const result = filterByString(items, (i) => i.name, 'AL');

      expect(result).toHaveLength(2); // Alice, Alex
    });

    it('returns empty array when no match', () => {
      const result = filterByString(items, (i) => i.name, 'xyz');

      expect(result).toHaveLength(0);
    });

    it('handles undefined values', () => {
      const itemsWithUndefined = [{ name: 'Alice' }, { name: undefined }, { name: 'Bob' }];
      const result = filterByString(itemsWithUndefined, (i) => i.name, 'Alice');

      expect(result).toHaveLength(1);
    });
  });

  describe('filterByTopic', () => {
    const items = [
      { topics: ['politics', 'economy'] },
      { topics: ['health', 'science'] },
      { topics: ['politics', 'local'] },
    ];

    it('returns all items when no topic filter', () => {
      const result = filterByTopic(items, (i) => i.topics, undefined);

      expect(result).toHaveLength(3);
    });

    it('filters by topic', () => {
      const result = filterByTopic(items, (i) => i.topics, 'politics');

      expect(result).toHaveLength(2);
    });

    it('is case insensitive', () => {
      const result = filterByTopic(items, (i) => i.topics, 'HEALTH');

      expect(result).toHaveLength(1);
    });

    it('matches partial topic', () => {
      const result = filterByTopic(items, (i) => i.topics, 'eco');

      expect(result).toHaveLength(1);
    });

    it('returns empty array when no match', () => {
      const result = filterByTopic(items, (i) => i.topics, 'environment');

      expect(result).toHaveLength(0);
    });
  });
});

describe('TTLCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves values', () => {
    const cache = new TTLCache<string, number>({ ttlMs: 1000, maxSize: 10 });

    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
  });

  it('returns undefined for missing keys', () => {
    const cache = new TTLCache<string, number>({ ttlMs: 1000, maxSize: 10 });

    expect(cache.get('missing')).toBeUndefined();
  });

  it('expires entries after TTL', () => {
    const cache = new TTLCache<string, number>({ ttlMs: 1000, maxSize: 10 });

    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);

    vi.advanceTimersByTime(1001);
    expect(cache.get('a')).toBeUndefined();
  });

  it('evicts oldest when at max size', () => {
    const cache = new TTLCache<string, number>({ ttlMs: 10000, maxSize: 2 });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('has() returns correct boolean', () => {
    const cache = new TTLCache<string, number>({ ttlMs: 1000, maxSize: 10 });

    cache.set('a', 1);

    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });

  it('delete() removes entry', () => {
    const cache = new TTLCache<string, number>({ ttlMs: 1000, maxSize: 10 });

    cache.set('a', 1);
    expect(cache.delete('a')).toBe(true);
    expect(cache.get('a')).toBeUndefined();
  });

  it('clear() removes all entries', () => {
    const cache = new TTLCache<string, number>({ ttlMs: 1000, maxSize: 10 });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
  });

  it('size returns count of valid entries', () => {
    const cache = new TTLCache<string, number>({ ttlMs: 1000, maxSize: 10 });

    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.size).toBe(2);

    vi.advanceTimersByTime(1001);
    expect(cache.size).toBe(0);
  });

  it('values() returns all valid values', () => {
    const cache = new TTLCache<string, number>({ ttlMs: 1000, maxSize: 10 });

    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.values()).toEqual([1, 2]);
  });

  it('entries() returns all valid entries', () => {
    const cache = new TTLCache<string, number>({ ttlMs: 1000, maxSize: 10 });

    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.entries()).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });
});

describe('TTLListCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('push adds items', () => {
    const cache = new TTLListCache<number>({ ttlMs: 1000, maxSize: 10 });

    cache.push(1);
    cache.push(2);

    expect(cache.getAll()).toEqual([1, 2]);
  });

  it('unshift adds items at front', () => {
    const cache = new TTLListCache<number>({ ttlMs: 1000, maxSize: 10 });

    cache.push(1);
    cache.unshift(0);

    expect(cache.getAll()).toEqual([0, 1]);
  });

  it('expires items after TTL', () => {
    const cache = new TTLListCache<number>({ ttlMs: 1000, maxSize: 10 });

    cache.push(1);
    expect(cache.getAll()).toEqual([1]);

    vi.advanceTimersByTime(1001);
    expect(cache.getAll()).toEqual([]);
  });

  it('evicts oldest when at max size (push)', () => {
    const cache = new TTLListCache<number>({ ttlMs: 10000, maxSize: 2 });

    cache.push(1);
    cache.push(2);
    cache.push(3);

    expect(cache.getAll()).toEqual([2, 3]);
  });

  it('evicts newest when at max size (unshift)', () => {
    const cache = new TTLListCache<number>({ ttlMs: 10000, maxSize: 2 });

    cache.push(1);
    cache.push(2);
    cache.unshift(0);

    expect(cache.getAll()).toEqual([0, 1]);
  });

  it('find returns matching item', () => {
    const cache = new TTLListCache<{ id: number }>({ ttlMs: 1000, maxSize: 10 });

    cache.push({ id: 1 });
    cache.push({ id: 2 });

    expect(cache.find((i) => i.id === 2)).toEqual({ id: 2 });
    expect(cache.find((i) => i.id === 99)).toBeUndefined();
  });

  it('findIndex returns correct index', () => {
    const cache = new TTLListCache<{ id: number }>({ ttlMs: 1000, maxSize: 10 });

    cache.push({ id: 1 });
    cache.push({ id: 2 });

    expect(cache.findIndex((i) => i.id === 2)).toBe(1);
    expect(cache.findIndex((i) => i.id === 99)).toBe(-1);
  });

  it('filter returns matching items', () => {
    const cache = new TTLListCache<{ active: boolean }>({ ttlMs: 1000, maxSize: 10 });

    cache.push({ active: true });
    cache.push({ active: false });
    cache.push({ active: true });

    expect(cache.filter((i) => i.active)).toHaveLength(2);
  });

  it('update modifies item at index', () => {
    const cache = new TTLListCache<{ value: number }>({ ttlMs: 1000, maxSize: 10 });

    cache.push({ value: 1 });
    cache.push({ value: 2 });

    cache.update(1, { value: 20 });

    expect(cache.getAll()).toEqual([{ value: 1 }, { value: 20 }]);
  });

  it('remove deletes matching item', () => {
    const cache = new TTLListCache<{ id: number }>({ ttlMs: 1000, maxSize: 10 });

    cache.push({ id: 1 });
    cache.push({ id: 2 });

    expect(cache.remove((i) => i.id === 1)).toBe(true);
    expect(cache.getAll()).toEqual([{ id: 2 }]);
  });

  it('remove returns false when not found', () => {
    const cache = new TTLListCache<{ id: number }>({ ttlMs: 1000, maxSize: 10 });

    cache.push({ id: 1 });

    expect(cache.remove((i) => i.id === 99)).toBe(false);
  });

  it('clear removes all items', () => {
    const cache = new TTLListCache<number>({ ttlMs: 1000, maxSize: 10 });

    cache.push(1);
    cache.push(2);
    cache.clear();

    expect(cache.length).toBe(0);
  });

  it('length returns count of valid items', () => {
    const cache = new TTLListCache<number>({ ttlMs: 1000, maxSize: 10 });

    cache.push(1);
    cache.push(2);

    expect(cache.length).toBe(2);
  });
});
