/**
 * Coinage types for private payments.
 *
 * Coinage is Polkadot's native private payment system,
 * enabling anonymous transactions denominated in pUSD.
 *
 * Key concepts:
 * - Coins have denominations in powers of 2 ($0.01 to $163.84)
 * - Each coin is held by a single-use public key
 * - Coins have "age" that increments with transfers
 * - The "recycler" anonymizes coins through ring signatures
 */

import type { CoinPublicKey, DIMCredential } from './brands';

/**
 * Coin denomination exponent (0-14).
 * Actual value in cents = 1 * 2^exponent
 * Actual value in dollars = 0.01 * 2^exponent
 */
export type CoinExponent = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

/**
 * Coin denomination values in cents.
 */
export const COIN_VALUES_CENTS: Record<CoinExponent, number> = {
  0: 1, // $0.01
  1: 2, // $0.02
  2: 4, // $0.04
  3: 8, // $0.08
  4: 16, // $0.16
  5: 32, // $0.32
  6: 64, // $0.64
  7: 128, // $1.28
  8: 256, // $2.56
  9: 512, // $5.12
  10: 1024, // $10.24
  11: 2048, // $20.48
  12: 4096, // $40.96
  13: 8192, // $81.92
  14: 16384, // $163.84
} as const;

/**
 * Coinage configuration constants.
 */
export const COINAGE_CONFIG = {
  /** Minimum age before a coin can be recycled */
  minAgeForRecycling: 3,
  /** Maximum age before a coin MUST be recycled (cannot transfer) */
  maxAge: 10,
  /** Maximum coin exponent (14 = $163.84) */
  maxExponent: 14,
  /** Minimum coin exponent (0 = $0.01) */
  minExponent: 0,
} as const;

/**
 * A private coin held by a user.
 */
export interface Coin {
  /** Denomination exponent (value in cents = 2^exponent) */
  readonly exponent: CoinExponent;
  /** Transfer count (age) - increments with each transfer */
  readonly age: number;
  /** Public key holding this coin (single-use) */
  readonly owner: CoinPublicKey;
  /** Derivation index in user's keychain (e.g., //coin-42) */
  readonly derivationIndex: number;
}

/**
 * Get the value of a coin in cents.
 */
export function getCoinValueCents(exponent: CoinExponent): number {
  return COIN_VALUES_CENTS[exponent];
}

/**
 * Get the value of a coin in dollars.
 */
export function getCoinValueDollars(exponent: CoinExponent): number {
  return COIN_VALUES_CENTS[exponent] / 100;
}

/**
 * Format coin value for display.
 *
 * @example
 * formatCoinValue(0) // "$0.01"
 * formatCoinValue(7) // "$1.28"
 * formatCoinValue(14) // "$163.84"
 */
export function formatCoinValue(exponent: CoinExponent): string {
  const cents = COIN_VALUES_CENTS[exponent];
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Check if a coin can be transferred (not at max age).
 */
export function canTransfer(coin: Coin): boolean {
  return coin.age < COINAGE_CONFIG.maxAge;
}

/**
 * Check if a coin can be recycled (meets minimum age).
 */
export function canRecycle(coin: Coin): boolean {
  return coin.age >= COINAGE_CONFIG.minAgeForRecycling;
}

/**
 * Check if a coin MUST be recycled (at max age, cannot transfer).
 */
export function mustRecycle(coin: Coin): boolean {
  return coin.age >= COINAGE_CONFIG.maxAge;
}

/**
 * Decompose an amount (in cents) into coin denominations.
 * Uses greedy algorithm (largest denominations first).
 *
 * @example
 * decomposeAmountCents(800) // [9, 8, 5] for $5.12 + $2.56 + $0.32 = $8.00
 * decomposeAmountCents(100) // [6, 5, 2] for $0.64 + $0.32 + $0.04 = $1.00
 *
 * @throws If amount cannot be exactly represented with coin denominations
 */
export function decomposeAmountCents(cents: number): CoinExponent[] {
  if (cents < 0) {
    throw new Error('Amount cannot be negative');
  }
  if (!Number.isInteger(cents)) {
    throw new Error('Amount must be an integer (cents)');
  }

  const result: CoinExponent[] = [];
  let remaining = cents;

  // Start from largest denomination (exponent 14)
  for (let exp = 14; exp >= 0; exp--) {
    const value = COIN_VALUES_CENTS[exp as CoinExponent];
    while (remaining >= value) {
      result.push(exp as CoinExponent);
      remaining -= value;
    }
  }

  if (remaining > 0) {
    throw new Error(
      `Cannot exactly represent ${cents} cents with coin denominations. ` +
        `Remaining: ${remaining} cents. Coins must be multiples of $0.01.`
    );
  }

  return result;
}

/**
 * Calculate total value of coins in cents.
 */
export function totalCoinValueCents(coins: readonly Coin[]): number {
  return coins.reduce((sum, coin) => sum + COIN_VALUES_CENTS[coin.exponent], 0);
}

/**
 * Validate a split operation.
 * The sum of output denominations must equal the input coin value.
 *
 * @returns null if valid, error message if invalid
 */
export function validateSplit(
  inputExponent: CoinExponent,
  outputExponents: readonly CoinExponent[]
): string | null {
  const inputValue = COIN_VALUES_CENTS[inputExponent];
  const outputValue = outputExponents.reduce<number>((sum, exp) => sum + COIN_VALUES_CENTS[exp], 0);

  if (outputValue !== inputValue) {
    return `Split invalid: input value ${inputValue} cents does not match output value ${outputValue} cents`;
  }

  if (outputExponents.length < 2) {
    return 'Split must produce at least 2 coins';
  }

  return null;
}

/**
 * User's private coin wallet state.
 */
export interface CoinWallet {
  /** Total balance in cents */
  readonly totalBalanceCents: number;
  /** Individual coins owned */
  readonly coins: readonly Coin[];
  /** Next derivation index to use for new coins */
  readonly nextDerivationIndex: number;
  /** Pending incoming transfers (keys received, not yet claimed) */
  readonly pendingIncoming: readonly PendingTransfer[];
}

/**
 * Create an empty coin wallet.
 */
export function createEmptyCoinWallet(): CoinWallet {
  return {
    totalBalanceCents: 0,
    coins: [],
    nextDerivationIndex: 0,
    pendingIncoming: [],
  };
}

/**
 * A pending incoming transfer (keys received off-chain, not yet claimed on-chain).
 */
export interface PendingTransfer {
  /** Unique ID for this pending transfer */
  readonly id: string;
  /** Sender's pseudonym (for display) */
  readonly senderPseudonym: string;
  /** Number of coins to claim */
  readonly coinCount: number;
  /** Total value in cents */
  readonly totalValueCents: number;
  /** When keys were received */
  readonly receivedAt: number;
  /** Expiration timestamp (sender can reclaim after this) */
  readonly expiresAt: number;
}

/**
 * A package of keys to share for a transfer (off-chain).
 * The sender creates this and sends to recipient via secure channel.
 */
export interface TransferPackage {
  /** Private keys for each coin being transferred */
  readonly keys: readonly string[];
  /** Expected denominations (for verification) */
  readonly exponents: readonly CoinExponent[];
  /** Total value in cents */
  readonly totalValueCents: number;
  /** When this package expires (sender can reclaim after) */
  readonly expiresAt: number;
  /** Sender's pseudonym (optional, for display) */
  readonly senderPseudonym?: string;
}

/**
 * Recycler voucher for claiming coins.
 * Received when loading coins/pUSD into the recycler.
 */
export interface RecyclerVoucher {
  /** Recycler value exponent (which recycler this is for) */
  readonly recyclerExponent: CoinExponent;
  /** Ring index within the recycler */
  readonly ringIndex: number;
  /** Alias in the ring (proof of membership) */
  readonly alias: Uint8Array;
  /** When this voucher was created */
  readonly createdAt: number;
}

/**
 * Recycler claim token types.
 * Used to claim coins from the recycler (the expensive operation).
 */
export type RecyclerClaimToken =
  | {
      readonly type: 'free_person';
      readonly ringIndex: number;
      readonly counter: number;
      readonly period: number;
      readonly proof: Uint8Array;
    }
  | {
      readonly type: 'free_lite_person';
      readonly ringIndex: number;
      readonly counter: number;
      readonly period: number;
      readonly proof: Uint8Array;
    }
  | {
      readonly type: 'paid';
      readonly paidRingIndex: number;
      readonly proof: Uint8Array;
      readonly expiresAt: number;
    };

/**
 * Free claim token allocation for a DIM-verified user.
 */
export interface ClaimTokenAllocation {
  /** User's DIM credential */
  readonly credential: DIMCredential;
  /** Current period (e.g., week number) */
  readonly period: number;
  /** Tokens available this period */
  readonly available: number;
  /** Tokens used this period */
  readonly used: number;
  /** When the period resets */
  readonly periodEndsAt: number;
}

/**
 * Summary of coin holdings by denomination.
 * Useful for display and analysis.
 */
export interface CoinHoldingsSummary {
  /** Total value in cents */
  readonly totalCents: number;
  /** Count by denomination */
  readonly byDenomination: Record<CoinExponent, number>;
  /** Average coin age */
  readonly averageAge: number;
  /** Coins needing recycling soon (age >= minAge - 2) */
  readonly needsRecyclingSoon: number;
  /** Coins that must be recycled (at max age) */
  readonly mustRecycle: number;
}

/**
 * Calculate holdings summary from a list of coins.
 */
export function calculateHoldingsSummary(coins: readonly Coin[]): CoinHoldingsSummary {
  const byDenomination: Record<CoinExponent, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
    9: 0,
    10: 0,
    11: 0,
    12: 0,
    13: 0,
    14: 0,
  };

  let totalCents = 0;
  let totalAge = 0;
  let needsRecyclingSoon = 0;
  let mustRecycleCount = 0;

  for (const coin of coins) {
    byDenomination[coin.exponent]++;
    totalCents += COIN_VALUES_CENTS[coin.exponent];
    totalAge += coin.age;

    if (mustRecycle(coin)) {
      mustRecycleCount++;
    } else if (coin.age >= COINAGE_CONFIG.minAgeForRecycling - 2) {
      needsRecyclingSoon++;
    }
  }

  return {
    totalCents,
    byDenomination,
    averageAge: coins.length > 0 ? totalAge / coins.length : 0,
    needsRecyclingSoon,
    mustRecycle: mustRecycleCount,
  };
}
