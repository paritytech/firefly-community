/**
 * Tests for ProductAccountId helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  createDerivationIndex,
  createProductAccountId,
  getDefaultProductAccountId,
  getAccountIdentifier,
  getAccountDerivationIndex,
  isDefaultAccount,
  formatProductAccountId,
} from './product-account';

describe('createDerivationIndex', () => {
  it('accepts a non-negative integer', () => {
    expect(createDerivationIndex(0)).toBe(0);
    expect(createDerivationIndex(7)).toBe(7);
  });

  it('rejects negative values', () => {
    expect(() => createDerivationIndex(-1)).toThrow(/Invalid derivation index/);
  });

  it('rejects non-integers', () => {
    expect(() => createDerivationIndex(1.5)).toThrow(/Invalid derivation index/);
  });
});

describe('createProductAccountId', () => {
  it('produces a tuple of [identifier, index]', () => {
    const accountId = createProductAccountId('alice.dot', 2);
    expect(accountId[0]).toBe('alice.dot');
    expect(accountId[1]).toBe(2);
  });

  it('rejects an empty identifier', () => {
    expect(() => createProductAccountId('', 0)).toThrow(/cannot be empty/);
  });

  it('rejects an invalid derivation index', () => {
    expect(() => createProductAccountId('alice.dot', -3)).toThrow(/Invalid derivation index/);
  });
});

describe('getDefaultProductAccountId', () => {
  it('uses derivation index 0', () => {
    const accountId = getDefaultProductAccountId('bob.dot');
    expect(getAccountDerivationIndex(accountId)).toBe(0);
    expect(isDefaultAccount(accountId)).toBe(true);
  });
});

describe('accessors', () => {
  it('getAccountIdentifier returns the identifier', () => {
    const accountId = createProductAccountId('carol.dot', 1);
    expect(getAccountIdentifier(accountId)).toBe('carol.dot');
  });

  it('getAccountDerivationIndex returns the index', () => {
    const accountId = createProductAccountId('carol.dot', 4);
    expect(getAccountDerivationIndex(accountId)).toBe(4);
  });
});

describe('isDefaultAccount', () => {
  it('is true for index 0', () => {
    expect(isDefaultAccount(createProductAccountId('a.dot', 0))).toBe(true);
  });

  it('is false for non-zero index', () => {
    expect(isDefaultAccount(createProductAccountId('a.dot', 1))).toBe(false);
  });
});

describe('formatProductAccountId', () => {
  it('returns only the identifier for the default account', () => {
    expect(formatProductAccountId(createProductAccountId('alice.dot', 0))).toBe('alice.dot');
  });

  it('appends #index for non-default accounts', () => {
    expect(formatProductAccountId(createProductAccountId('alice.dot', 3))).toBe('alice.dot#3');
  });
});
