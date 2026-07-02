/**
 * Tests for CoinPayment (RFC 0017) and DIM credential validators.
 */

import { describe, it, expect } from 'vitest';
import {
  parseCoinPaymentPurseInfo,
  safeParseCoinPaymentPurseInfo,
  parseCoinPaymentCheque,
  safeParseCoinPaymentCheque,
  validateDIMCredential,
} from './validators';

describe('parseCoinPaymentPurseInfo', () => {
  it('parses a valid purse info object', () => {
    const info = parseCoinPaymentPurseInfo({ id: 1, name: 'Savings', balance: 1250 });
    expect(info.id).toBe(1);
    expect(info.name).toBe('Savings');
    expect(info.balance).toBe(1250);
  });

  it('throws on invalid data', () => {
    expect(() => parseCoinPaymentPurseInfo({ id: -1, name: 'X', balance: 0 })).toThrow();
  });
});

describe('safeParseCoinPaymentPurseInfo', () => {
  it('returns the parsed value when valid', () => {
    const info = safeParseCoinPaymentPurseInfo({ id: 0, name: 'Main', balance: 0 });
    expect(info).not.toBeNull();
    expect(info?.name).toBe('Main');
  });

  it('returns null when invalid', () => {
    expect(safeParseCoinPaymentPurseInfo({ id: 'nope' })).toBeNull();
    expect(safeParseCoinPaymentPurseInfo(null)).toBeNull();
  });
});

describe('parseCoinPaymentCheque', () => {
  it('parses a valid cheque', () => {
    const cheque = parseCoinPaymentCheque({
      from: 1,
      to: new Uint8Array(32),
      amount: 500,
      encryptedData: new Uint8Array([1, 2, 3]),
    });
    expect(cheque.from).toBe(1);
    expect(cheque.amount).toBe(500);
    expect(cheque.to).toHaveLength(32);
  });

  it('throws when the receivable is not 32 bytes', () => {
    expect(() =>
      parseCoinPaymentCheque({
        from: 1,
        to: new Uint8Array(8),
        amount: 500,
        encryptedData: new Uint8Array(0),
      })
    ).toThrow();
  });
});

describe('safeParseCoinPaymentCheque', () => {
  it('returns the parsed cheque when valid', () => {
    const cheque = safeParseCoinPaymentCheque({
      from: 0,
      to: new Uint8Array(32),
      amount: 1,
      encryptedData: new Uint8Array(0),
    });
    expect(cheque).not.toBeNull();
  });

  it('returns null when invalid', () => {
    expect(safeParseCoinPaymentCheque({ from: 'x' })).toBeNull();
  });
});

describe('validateDIMCredential', () => {
  it('accepts a dim- prefixed seed credential', () => {
    expect(validateDIMCredential('dim-alice-123')).toBe('dim-alice-123');
  });

  it('accepts a hex hash of 32-64 chars', () => {
    const hash = 'a'.repeat(64);
    expect(validateDIMCredential(hash)).toBe(hash);
  });

  it('rejects non-string input', () => {
    expect(validateDIMCredential(123)).toBeNull();
    expect(validateDIMCredential(null)).toBeNull();
  });

  it('rejects empty strings', () => {
    expect(validateDIMCredential('')).toBeNull();
  });

  it('rejects path-traversal characters', () => {
    expect(validateDIMCredential('dim-../etc')).toBeNull();
    expect(validateDIMCredential('dim-a/b')).toBeNull();
    expect(validateDIMCredential('dim-a\\b')).toBeNull();
  });

  it('rejects excessively long input', () => {
    expect(validateDIMCredential('dim-' + 'a'.repeat(260))).toBeNull();
  });

  it('rejects values that do not match the expected pattern', () => {
    expect(validateDIMCredential('not_a_credential!')).toBeNull();
    // hex too short
    expect(validateDIMCredential('abc')).toBeNull();
  });
});
