/**
 * Currency types for pUSD integration.
 *
 * pUSD is a Polkadot-native stablecoin used for all financial
 * operations within the Firefly Network. Amounts are stored as
 * bigint in the smallest unit (6 decimals, matching USDC convention).
 *
 * 1 pUSD = 1_000_000 units
 */

import type { PolkadotAddress } from './brands';

/**
 * pUSD asset configuration.
 */
export const PUSD = {
  /** Display symbol */
  symbol: 'pUSD',
  /** Decimal places (matches USDC convention) */
  decimals: 6,
  /** Asset Hub asset ID (to be configured when available) */
  assetId: 0, // TODO: Set actual asset ID when pUSD launches
  /** Chain where pUSD lives */
  chain: 'polkadot-asset-hub',
  /** Minimum transfer amount (to avoid dust) - 0.1 pUSD */
  minimumTransfer: 100_000n,
} as const;

/**
 * Branded type for pUSD amounts.
 * Ensures compile-time safety when handling currency.
 * Stored as bigint in smallest unit (6 decimals).
 */
export type PUSDAmount = bigint & { readonly __brand: 'PUSDAmount' };

/**
 * Create a validated pUSD amount from a bigint.
 * @throws If value is negative
 */
export function createPUSDAmount(value: bigint): PUSDAmount {
  if (value < 0n) {
    throw new Error('pUSD amount cannot be negative');
  }
  return value as PUSDAmount;
}

/**
 * Parse a human-readable string into pUSD amount.
 * Handles both integer and decimal inputs.
 *
 * @example
 * parsePUSD("100") // 100_000_000n ($100.00)
 * parsePUSD("100.50") // 100_500_000n ($100.50)
 * parsePUSD("0.01") // 10_000n ($0.01)
 *
 * @throws If input is not a valid positive number
 */
export function parsePUSD(amount: string): PUSDAmount {
  const trimmed = amount.trim();
  if (trimmed === '') {
    throw new Error('pUSD amount cannot be empty');
  }

  const parsed = parseFloat(trimmed);
  if (isNaN(parsed)) {
    throw new Error(`Invalid pUSD amount: "${amount}" is not a number`);
  }
  if (parsed < 0) {
    throw new Error(`Invalid pUSD amount: "${amount}" is negative`);
  }

  // Convert to smallest unit with proper rounding
  const multiplier = 10 ** PUSD.decimals;
  const units = Math.round(parsed * multiplier);

  return createPUSDAmount(BigInt(units));
}

/**
 * Parse cents (integer) into pUSD amount.
 * Useful when working with amounts already in cents.
 *
 * @example
 * parsePUSDCents(10050) // 100_500_000n ($100.50)
 */
export function parsePUSDCents(cents: number): PUSDAmount {
  if (!Number.isInteger(cents)) {
    throw new Error('Cents must be an integer');
  }
  if (cents < 0) {
    throw new Error('Cents cannot be negative');
  }
  // 1 cent = 10_000 units (since we have 6 decimals and cent is 2 decimals)
  return createPUSDAmount(BigInt(cents) * 10_000n);
}

/**
 * Convert pUSD amount to cents (for display calculations).
 */
export function toPUSDCents(amount: PUSDAmount): number {
  return Number(amount / 10_000n);
}

/**
 * Format pUSD amount for display.
 *
 * @example
 * formatPUSD(100_500_000n) // "100.50 pUSD"
 * formatPUSD(100_500_000n, { includeSymbol: false }) // "100.50"
 * formatPUSD(1_000_000_000_000n) // "1,000,000.00 pUSD"
 */
export function formatPUSD(
  amount: PUSDAmount,
  options?: {
    /** Include "pUSD" symbol (default: true) */
    includeSymbol?: boolean;
    /** Minimum fraction digits (default: 2) */
    minimumFractionDigits?: number;
    /** Maximum fraction digits (default: 6) */
    maximumFractionDigits?: number;
    /** Locale for number formatting (default: 'en-US') */
    locale?: string;
  }
): string {
  const {
    includeSymbol = true,
    minimumFractionDigits = 2,
    maximumFractionDigits = 6,
    locale = 'en-US',
  } = options ?? {};

  const value = Number(amount) / 10 ** PUSD.decimals;

  const formatted = value.toLocaleString(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  });

  return includeSymbol ? `${formatted} ${PUSD.symbol}` : formatted;
}

/**
 * Format pUSD amount in compact form for limited space.
 *
 * @example
 * formatPUSDCompact(1_500_000_000n) // "$1.5K"
 * formatPUSDCompact(2_500_000_000_000n) // "$2.5M"
 */
export function formatPUSDCompact(amount: PUSDAmount): string {
  const value = Number(amount) / 10 ** PUSD.decimals;

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Add two pUSD amounts safely.
 */
export function addPUSD(a: PUSDAmount, b: PUSDAmount): PUSDAmount {
  return createPUSDAmount(a + b);
}

/**
 * Subtract pUSD amounts safely.
 * @throws If result would be negative
 */
export function subtractPUSD(a: PUSDAmount, b: PUSDAmount): PUSDAmount {
  if (b > a) {
    throw new Error(
      `Subtraction would result in negative amount: ${formatPUSD(a)} - ${formatPUSD(b)}`
    );
  }
  return createPUSDAmount(a - b);
}

/**
 * Multiply pUSD amount by a factor.
 * Useful for percentage calculations.
 *
 * @example
 * multiplyPUSD(100_000_000n, 0.1) // 10_000_000n (10% of $100)
 */
export function multiplyPUSD(amount: PUSDAmount, factor: number): PUSDAmount {
  if (factor < 0) {
    throw new Error('Factor cannot be negative');
  }
  const result = BigInt(Math.round(Number(amount) * factor));
  return createPUSDAmount(result);
}

/**
 * Compare two pUSD amounts.
 * Returns -1 if a < b, 0 if a === b, 1 if a > b.
 */
export function comparePUSD(a: PUSDAmount, b: PUSDAmount): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Check if amount meets minimum transfer requirement.
 */
export function meetsMinimumTransfer(amount: PUSDAmount): boolean {
  return amount >= PUSD.minimumTransfer;
}

/**
 * A wallet balance in pUSD.
 */
export interface PUSDBalance {
  /** Wallet address */
  readonly address: PolkadotAddress;
  /** Available balance (can be spent) */
  readonly available: PUSDAmount;
  /** Locked/reserved balance (in escrow, staking, etc.) */
  readonly locked: PUSDAmount;
  /** Total balance (available + locked) */
  readonly total: PUSDAmount;
}

/**
 * Create a PUSDBalance, calculating total from available + locked.
 */
export function createPUSDBalance(
  address: PolkadotAddress,
  available: PUSDAmount,
  locked: PUSDAmount
): PUSDBalance {
  return {
    address,
    available,
    locked,
    total: addPUSD(available, locked),
  };
}

/**
 * Zero amount constant for comparisons and initialization.
 */
export const ZERO_PUSD = createPUSDAmount(0n);
