import { describe, it, expect } from 'vitest';
import {
  COIN_VALUES_CENTS,
  COINAGE_CONFIG,
  getCoinValueCents,
  getCoinValueDollars,
  formatCoinValue,
  canTransfer,
  canRecycle,
  mustRecycle,
  decomposeAmountCents,
  totalCoinValueCents,
  validateSplit,
  createEmptyCoinWallet,
  calculateHoldingsSummary,
  type Coin,
  type CoinExponent,
} from './coinage';
import { createCoinPublicKey } from './brands';

describe('COIN_VALUES_CENTS', () => {
  it('has correct value for exponent 0', () => {
    expect(COIN_VALUES_CENTS[0]).toBe(1); // $0.01
  });

  it('has correct value for exponent 7', () => {
    expect(COIN_VALUES_CENTS[7]).toBe(128); // $1.28
  });

  it('has correct value for exponent 14', () => {
    expect(COIN_VALUES_CENTS[14]).toBe(16384); // $163.84
  });

  it('doubles with each exponent', () => {
    for (let i = 1; i <= 14; i++) {
      expect(COIN_VALUES_CENTS[i as CoinExponent]).toBe(
        COIN_VALUES_CENTS[(i - 1) as CoinExponent] * 2
      );
    }
  });
});

describe('getCoinValueCents', () => {
  it('returns value in cents', () => {
    expect(getCoinValueCents(0)).toBe(1);
    expect(getCoinValueCents(7)).toBe(128);
    expect(getCoinValueCents(14)).toBe(16384);
  });
});

describe('getCoinValueDollars', () => {
  it('returns value in dollars', () => {
    expect(getCoinValueDollars(0)).toBe(0.01);
    expect(getCoinValueDollars(7)).toBe(1.28);
    expect(getCoinValueDollars(14)).toBe(163.84);
  });
});

describe('formatCoinValue', () => {
  it('formats small denominations', () => {
    expect(formatCoinValue(0)).toBe('$0.01');
    expect(formatCoinValue(1)).toBe('$0.02');
  });

  it('formats medium denominations', () => {
    expect(formatCoinValue(7)).toBe('$1.28');
    expect(formatCoinValue(10)).toBe('$10.24');
  });

  it('formats large denominations', () => {
    expect(formatCoinValue(14)).toBe('$163.84');
  });
});

describe('canTransfer', () => {
  const makeCoin = (age: number): Coin => ({
    exponent: 7,
    age,
    owner: createCoinPublicKey('test-key'),
    derivationIndex: 0,
  });

  it('returns true for age 0', () => {
    expect(canTransfer(makeCoin(0))).toBe(true);
  });

  it('returns true for age below max', () => {
    expect(canTransfer(makeCoin(COINAGE_CONFIG.maxAge - 1))).toBe(true);
  });

  it('returns false for age at max', () => {
    expect(canTransfer(makeCoin(COINAGE_CONFIG.maxAge))).toBe(false);
  });

  it('returns false for age above max', () => {
    expect(canTransfer(makeCoin(COINAGE_CONFIG.maxAge + 1))).toBe(false);
  });
});

describe('canRecycle', () => {
  const makeCoin = (age: number): Coin => ({
    exponent: 7,
    age,
    owner: createCoinPublicKey('test-key'),
    derivationIndex: 0,
  });

  it('returns false for age 0', () => {
    expect(canRecycle(makeCoin(0))).toBe(false);
  });

  it('returns false for age below minimum', () => {
    expect(canRecycle(makeCoin(COINAGE_CONFIG.minAgeForRecycling - 1))).toBe(false);
  });

  it('returns true for age at minimum', () => {
    expect(canRecycle(makeCoin(COINAGE_CONFIG.minAgeForRecycling))).toBe(true);
  });

  it('returns true for age above minimum', () => {
    expect(canRecycle(makeCoin(COINAGE_CONFIG.minAgeForRecycling + 1))).toBe(true);
  });
});

describe('mustRecycle', () => {
  const makeCoin = (age: number): Coin => ({
    exponent: 7,
    age,
    owner: createCoinPublicKey('test-key'),
    derivationIndex: 0,
  });

  it('returns false for age below max', () => {
    expect(mustRecycle(makeCoin(COINAGE_CONFIG.maxAge - 1))).toBe(false);
  });

  it('returns true for age at max', () => {
    expect(mustRecycle(makeCoin(COINAGE_CONFIG.maxAge))).toBe(true);
  });

  it('returns true for age above max', () => {
    expect(mustRecycle(makeCoin(COINAGE_CONFIG.maxAge + 1))).toBe(true);
  });
});

describe('decomposeAmountCents', () => {
  it('decomposes $1.00 (100 cents)', () => {
    const result = decomposeAmountCents(100);
    // 100 = 64 + 32 + 4 = 2^6 + 2^5 + 2^2
    expect(result).toEqual([6, 5, 2]);
    expect(result.reduce<number>((sum, exp) => sum + COIN_VALUES_CENTS[exp], 0)).toBe(100);
  });

  it('decomposes $8.00 (800 cents)', () => {
    const result = decomposeAmountCents(800);
    // 800 = 512 + 256 + 32 = 2^9 + 2^8 + 2^5
    expect(result).toEqual([9, 8, 5]);
    expect(result.reduce<number>((sum, exp) => sum + COIN_VALUES_CENTS[exp], 0)).toBe(800);
  });

  it('decomposes $0.01 (1 cent)', () => {
    const result = decomposeAmountCents(1);
    expect(result).toEqual([0]);
  });

  it('decomposes $163.84 (16384 cents)', () => {
    const result = decomposeAmountCents(16384);
    expect(result).toEqual([14]);
  });

  it('decomposes $163.85 (16385 cents)', () => {
    const result = decomposeAmountCents(16385);
    expect(result).toEqual([14, 0]); // $163.84 + $0.01
  });

  it('decomposes zero', () => {
    const result = decomposeAmountCents(0);
    expect(result).toEqual([]);
  });

  it('throws on negative amount', () => {
    expect(() => decomposeAmountCents(-100)).toThrow('cannot be negative');
  });

  it('throws on non-integer', () => {
    expect(() => decomposeAmountCents(1.5)).toThrow('must be an integer');
  });
});

describe('totalCoinValueCents', () => {
  const makeCoin = (exponent: CoinExponent): Coin => ({
    exponent,
    age: 0,
    owner: createCoinPublicKey('test-key'),
    derivationIndex: 0,
  });

  it('calculates total for multiple coins', () => {
    const coins = [makeCoin(7), makeCoin(6), makeCoin(0)]; // $1.28 + $0.64 + $0.01
    expect(totalCoinValueCents(coins)).toBe(193); // 128 + 64 + 1
  });

  it('returns 0 for empty array', () => {
    expect(totalCoinValueCents([])).toBe(0);
  });
});

describe('validateSplit', () => {
  it('returns null for valid split', () => {
    // Split $2.56 (exp 8) into $1.28 (exp 7) + $1.28 (exp 7)
    expect(validateSplit(8, [7, 7])).toBeNull();
  });

  it('returns null for complex valid split', () => {
    // Split $2.56 (exp 8) into $1.28 + $0.64 + $0.32 + $0.32
    expect(validateSplit(8, [7, 6, 5, 5])).toBeNull();
  });

  it('returns error for mismatched values', () => {
    // Try to split $2.56 into $1.28 + $0.64 (missing $0.64)
    const error = validateSplit(8, [7, 6]);
    expect(error).toContain('does not match');
  });

  it('returns error for single output', () => {
    const error = validateSplit(8, [8]);
    expect(error).toContain('at least 2 coins');
  });
});

describe('createEmptyCoinWallet', () => {
  it('creates empty wallet', () => {
    const wallet = createEmptyCoinWallet();
    expect(wallet.totalBalanceCents).toBe(0);
    expect(wallet.coins).toEqual([]);
    expect(wallet.nextDerivationIndex).toBe(0);
    expect(wallet.pendingIncoming).toEqual([]);
  });
});

describe('calculateHoldingsSummary', () => {
  const makeCoin = (exponent: CoinExponent, age: number): Coin => ({
    exponent,
    age,
    owner: createCoinPublicKey(`key-${exponent}-${age}`),
    derivationIndex: 0,
  });

  it('calculates summary for multiple coins', () => {
    const coins = [
      makeCoin(7, 2), // $1.28, age 2
      makeCoin(6, 5), // $0.64, age 5
      makeCoin(0, 0), // $0.01, age 0
    ];

    const summary = calculateHoldingsSummary(coins);

    expect(summary.totalCents).toBe(193); // 128 + 64 + 1
    expect(summary.byDenomination[7]).toBe(1);
    expect(summary.byDenomination[6]).toBe(1);
    expect(summary.byDenomination[0]).toBe(1);
    expect(summary.byDenomination[14]).toBe(0);
    expect(summary.averageAge).toBeCloseTo(7 / 3);
  });

  it('counts coins needing recycling', () => {
    const coins = [
      makeCoin(7, COINAGE_CONFIG.maxAge), // Must recycle
      makeCoin(6, COINAGE_CONFIG.maxAge + 1), // Must recycle
      makeCoin(5, COINAGE_CONFIG.minAgeForRecycling - 1), // Soon
      makeCoin(4, 0), // Fresh
    ];

    const summary = calculateHoldingsSummary(coins);

    expect(summary.mustRecycle).toBe(2);
    expect(summary.needsRecyclingSoon).toBe(1);
  });

  it('handles empty array', () => {
    const summary = calculateHoldingsSummary([]);

    expect(summary.totalCents).toBe(0);
    expect(summary.averageAge).toBe(0);
    expect(summary.mustRecycle).toBe(0);
    expect(summary.needsRecyclingSoon).toBe(0);
  });
});
