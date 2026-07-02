/**
 * Tests for CoinPayment helpers (RFC 0017).
 */

import { describe, it, expect } from 'vitest';
import {
  MAIN_PURSE,
  MAX_PURSES,
  createCoinPaymentPurseId,
  createCoinPaymentBalance,
  createCoinPaymentReceivable,
  formatCoinPaymentBalance,
  parseCoinPaymentBalance,
  isMainPurse,
  type CoinPaymentBalance,
} from './coin-payment';

describe('constants', () => {
  it('MAIN_PURSE is u32::MAX', () => {
    expect(MAIN_PURSE).toBe(0xffffffff);
  });

  it('MAX_PURSES is 16', () => {
    expect(MAX_PURSES).toBe(16);
  });
});

describe('createCoinPaymentPurseId', () => {
  it('accepts values within the u32 range', () => {
    expect(createCoinPaymentPurseId(0)).toBe(0);
    expect(createCoinPaymentPurseId(0xffffffff)).toBe(0xffffffff);
  });

  it('rejects negative values', () => {
    expect(() => createCoinPaymentPurseId(-1)).toThrow(/Invalid purse ID/);
  });

  it('rejects values above u32::MAX', () => {
    expect(() => createCoinPaymentPurseId(0x100000000)).toThrow(/Invalid purse ID/);
  });

  it('rejects non-integers', () => {
    expect(() => createCoinPaymentPurseId(1.5)).toThrow(/Invalid purse ID/);
  });
});

describe('createCoinPaymentBalance', () => {
  it('accepts a valid cent amount', () => {
    expect(createCoinPaymentBalance(1250)).toBe(1250);
  });

  it('rejects negative balances', () => {
    expect(() => createCoinPaymentBalance(-1)).toThrow(/Invalid balance/);
  });

  it('rejects amounts above u32::MAX', () => {
    expect(() => createCoinPaymentBalance(0x100000000)).toThrow(/Invalid balance/);
  });
});

describe('createCoinPaymentReceivable', () => {
  it('accepts a 32-byte array', () => {
    const bytes = new Uint8Array(32);
    expect(createCoinPaymentReceivable(bytes)).toBe(bytes);
  });

  it('rejects arrays that are not 32 bytes', () => {
    expect(() => createCoinPaymentReceivable(new Uint8Array(16))).toThrow(/must be 32 bytes/);
  });
});

describe('formatCoinPaymentBalance', () => {
  it('formats cents as a dollar string', () => {
    expect(formatCoinPaymentBalance(1250 as CoinPaymentBalance)).toBe('$12.50');
  });

  it('formats zero', () => {
    expect(formatCoinPaymentBalance(0 as CoinPaymentBalance)).toBe('$0.00');
  });
});

describe('parseCoinPaymentBalance', () => {
  it('parses a dollar string with leading $', () => {
    expect(parseCoinPaymentBalance('$12.50')).toBe(1250);
  });

  it('parses a bare numeric string', () => {
    expect(parseCoinPaymentBalance('7.25')).toBe(725);
  });

  it('rounds to the nearest cent', () => {
    // 1.239 dollars = 123.9 cents, rounds up to 124
    expect(parseCoinPaymentBalance('1.239')).toBe(124);
  });

  it('rejects non-numeric input', () => {
    expect(() => parseCoinPaymentBalance('abc')).toThrow(/Invalid dollar amount/);
  });

  it('rejects negative amounts', () => {
    expect(() => parseCoinPaymentBalance('-5')).toThrow(/Invalid dollar amount/);
  });
});

describe('isMainPurse', () => {
  it('is true for MAIN_PURSE', () => {
    expect(isMainPurse(MAIN_PURSE)).toBe(true);
  });

  it('is false for other purse IDs', () => {
    expect(isMainPurse(createCoinPaymentPurseId(0))).toBe(false);
  });
});
