import { describe, it, expect } from 'vitest';
import {
  PUSD,
  createPUSDAmount,
  parsePUSD,
  parsePUSDCents,
  toPUSDCents,
  formatPUSD,
  formatPUSDCompact,
  addPUSD,
  subtractPUSD,
  multiplyPUSD,
  comparePUSD,
  meetsMinimumTransfer,
  createPUSDBalance,
  ZERO_PUSD,
} from './currency';
import { createPolkadotAddress } from './brands';

describe('PUSD Configuration', () => {
  it('has correct symbol', () => {
    expect(PUSD.symbol).toBe('pUSD');
  });

  it('has 6 decimal places', () => {
    expect(PUSD.decimals).toBe(6);
  });

  it('has minimum transfer of 0.1 pUSD', () => {
    expect(PUSD.minimumTransfer).toBe(100_000n);
  });
});

describe('createPUSDAmount', () => {
  it('creates amount from positive bigint', () => {
    const amount = createPUSDAmount(100_000_000n);
    expect(amount).toBe(100_000_000n);
  });

  it('creates zero amount', () => {
    const amount = createPUSDAmount(0n);
    expect(amount).toBe(0n);
  });

  it('throws on negative amount', () => {
    expect(() => createPUSDAmount(-1n)).toThrow('cannot be negative');
  });
});

describe('parsePUSD', () => {
  it('parses whole numbers', () => {
    expect(parsePUSD('100')).toBe(100_000_000n);
  });

  it('parses decimals', () => {
    expect(parsePUSD('100.50')).toBe(100_500_000n);
  });

  it('parses small amounts', () => {
    expect(parsePUSD('0.01')).toBe(10_000n);
  });

  it('parses very small amounts', () => {
    expect(parsePUSD('0.000001')).toBe(1n);
  });

  it('handles leading/trailing whitespace', () => {
    expect(parsePUSD('  100  ')).toBe(100_000_000n);
  });

  it('throws on negative amounts', () => {
    expect(() => parsePUSD('-100')).toThrow('negative');
  });

  it('throws on invalid strings', () => {
    expect(() => parsePUSD('abc')).toThrow('not a number');
  });

  it('throws on empty string', () => {
    expect(() => parsePUSD('')).toThrow('cannot be empty');
  });
});

describe('parsePUSDCents', () => {
  it('parses cents to pUSD units', () => {
    // 100 cents = $1.00 = 1_000_000 units
    expect(parsePUSDCents(100)).toBe(1_000_000n);
  });

  it('parses large cent amounts', () => {
    // 10050 cents = $100.50 = 100_500_000 units
    expect(parsePUSDCents(10050)).toBe(100_500_000n);
  });

  it('throws on non-integer', () => {
    expect(() => parsePUSDCents(1.5)).toThrow('must be an integer');
  });

  it('throws on negative', () => {
    expect(() => parsePUSDCents(-100)).toThrow('cannot be negative');
  });
});

describe('toPUSDCents', () => {
  it('converts units to cents', () => {
    const amount = createPUSDAmount(100_500_000n); // $100.50
    expect(toPUSDCents(amount)).toBe(10050);
  });

  it('rounds down partial cents', () => {
    const amount = createPUSDAmount(10_001n); // $0.010001
    expect(toPUSDCents(amount)).toBe(1);
  });
});

describe('formatPUSD', () => {
  it('formats with symbol by default', () => {
    const amount = createPUSDAmount(100_500_000n);
    expect(formatPUSD(amount)).toBe('100.50 pUSD');
  });

  it('formats without symbol when requested', () => {
    const amount = createPUSDAmount(100_500_000n);
    expect(formatPUSD(amount, { includeSymbol: false })).toBe('100.50');
  });

  it('formats large amounts with commas', () => {
    const amount = createPUSDAmount(1_000_000_000_000n); // $1,000,000
    expect(formatPUSD(amount)).toBe('1,000,000.00 pUSD');
  });

  it('formats zero', () => {
    expect(formatPUSD(ZERO_PUSD)).toBe('0.00 pUSD');
  });

  it('respects minimum fraction digits', () => {
    const amount = createPUSDAmount(100_000_000n);
    expect(formatPUSD(amount, { minimumFractionDigits: 0 })).toBe('100 pUSD');
  });
});

describe('formatPUSDCompact', () => {
  it('formats millions', () => {
    const amount = createPUSDAmount(2_500_000_000_000n); // $2.5M
    expect(formatPUSDCompact(amount)).toBe('$2.5M');
  });

  it('formats thousands', () => {
    const amount = createPUSDAmount(1_500_000_000n); // $1.5K
    expect(formatPUSDCompact(amount)).toBe('$1.5K');
  });

  it('formats small amounts normally', () => {
    const amount = createPUSDAmount(100_500_000n); // $100.50
    expect(formatPUSDCompact(amount)).toBe('$100.50');
  });
});

describe('addPUSD', () => {
  it('adds two amounts', () => {
    const a = createPUSDAmount(100_000_000n);
    const b = createPUSDAmount(50_000_000n);
    expect(addPUSD(a, b)).toBe(150_000_000n);
  });

  it('adds zero', () => {
    const a = createPUSDAmount(100_000_000n);
    expect(addPUSD(a, ZERO_PUSD)).toBe(100_000_000n);
  });
});

describe('subtractPUSD', () => {
  it('subtracts smaller from larger', () => {
    const a = createPUSDAmount(100_000_000n);
    const b = createPUSDAmount(30_000_000n);
    expect(subtractPUSD(a, b)).toBe(70_000_000n);
  });

  it('subtracts equal amounts to zero', () => {
    const a = createPUSDAmount(100_000_000n);
    expect(subtractPUSD(a, a)).toBe(0n);
  });

  it('throws on negative result', () => {
    const a = createPUSDAmount(30_000_000n);
    const b = createPUSDAmount(100_000_000n);
    expect(() => subtractPUSD(a, b)).toThrow('negative');
  });
});

describe('multiplyPUSD', () => {
  it('multiplies by factor', () => {
    const amount = createPUSDAmount(100_000_000n); // $100
    expect(multiplyPUSD(amount, 0.1)).toBe(10_000_000n); // $10
  });

  it('multiplies by 1', () => {
    const amount = createPUSDAmount(100_000_000n);
    expect(multiplyPUSD(amount, 1)).toBe(100_000_000n);
  });

  it('multiplies by 0', () => {
    const amount = createPUSDAmount(100_000_000n);
    expect(multiplyPUSD(amount, 0)).toBe(0n);
  });

  it('throws on negative factor', () => {
    const amount = createPUSDAmount(100_000_000n);
    expect(() => multiplyPUSD(amount, -0.5)).toThrow('cannot be negative');
  });
});

describe('comparePUSD', () => {
  it('returns -1 when a < b', () => {
    const a = createPUSDAmount(50_000_000n);
    const b = createPUSDAmount(100_000_000n);
    expect(comparePUSD(a, b)).toBe(-1);
  });

  it('returns 0 when a === b', () => {
    const a = createPUSDAmount(100_000_000n);
    const b = createPUSDAmount(100_000_000n);
    expect(comparePUSD(a, b)).toBe(0);
  });

  it('returns 1 when a > b', () => {
    const a = createPUSDAmount(100_000_000n);
    const b = createPUSDAmount(50_000_000n);
    expect(comparePUSD(a, b)).toBe(1);
  });
});

describe('meetsMinimumTransfer', () => {
  it('returns true for amounts at minimum', () => {
    const amount = createPUSDAmount(PUSD.minimumTransfer);
    expect(meetsMinimumTransfer(amount)).toBe(true);
  });

  it('returns true for amounts above minimum', () => {
    const amount = createPUSDAmount(1_000_000n); // $1
    expect(meetsMinimumTransfer(amount)).toBe(true);
  });

  it('returns false for amounts below minimum', () => {
    const amount = createPUSDAmount(10_000n); // $0.01
    expect(meetsMinimumTransfer(amount)).toBe(false);
  });
});

describe('createPUSDBalance', () => {
  it('creates balance with correct total', () => {
    const address = createPolkadotAddress('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
    const available = createPUSDAmount(100_000_000n);
    const locked = createPUSDAmount(50_000_000n);

    const balance = createPUSDBalance(address, available, locked);

    expect(balance.address).toBe(address);
    expect(balance.available).toBe(100_000_000n);
    expect(balance.locked).toBe(50_000_000n);
    expect(balance.total).toBe(150_000_000n);
  });
});

describe('ZERO_PUSD', () => {
  it('is zero', () => {
    expect(ZERO_PUSD).toBe(0n);
  });

  it('can be used in comparisons', () => {
    const amount = createPUSDAmount(100_000_000n);
    expect(comparePUSD(amount, ZERO_PUSD)).toBe(1);
    expect(comparePUSD(ZERO_PUSD, amount)).toBe(-1);
  });
});
