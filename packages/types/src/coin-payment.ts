/**
 * CoinPayment types for RFC 0017 dotUSD purse management.
 *
 * Design Decision: CoinPaymentBalance uses number (u32 cents) rather than
 * bigint (PUSDAmount) because:
 * 1. Matches truapi RFC 0017 wire format exactly (u32)
 * 2. Denominated in dotUSD cents (exponent 2, e.g., 1250 = $12.50)
 * 3. Max value 0xFFFFFFFF cents = ~$42.9M (sufficient for user-facing purses)
 * 4. PUSDAmount is smallest units for on-chain precision; CoinPayment is UI-facing
 */

// ============================================================================
// Branded Types
// ============================================================================

/** Purse identifier (u32) */
export type CoinPaymentPurseId = number & { readonly __brand: 'CoinPaymentPurseId' };

/** Balance in dotUSD cents (u32) */
export type CoinPaymentBalance = number & { readonly __brand: 'CoinPaymentBalance' };

/** Receivable address (32 bytes) */
export type CoinPaymentReceivable = Uint8Array & { readonly __brand: 'CoinPaymentReceivable' };

// ============================================================================
// Constants
// ============================================================================

/** Main purse ID (u32::MAX) */
export const MAIN_PURSE: CoinPaymentPurseId = 0xffffffff as CoinPaymentPurseId;

/** Maximum number of purses a user can have */
export const MAX_PURSES = 16;

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a validated CoinPaymentPurseId.
 * @param id - The purse ID (0 to 0xFFFFFFFF)
 * @throws Error if ID is invalid
 */
export function createCoinPaymentPurseId(id: number): CoinPaymentPurseId {
  if (!Number.isInteger(id) || id < 0 || id > 0xffffffff) {
    throw new Error(`Invalid purse ID: ${id}. Must be integer 0-4294967295`);
  }
  return id as CoinPaymentPurseId;
}

/**
 * Create a validated CoinPaymentBalance.
 * @param cents - Balance in cents (0 to 0xFFFFFFFF)
 * @throws Error if balance is invalid
 */
export function createCoinPaymentBalance(cents: number): CoinPaymentBalance {
  if (!Number.isInteger(cents) || cents < 0 || cents > 0xffffffff) {
    throw new Error(`Invalid balance: ${cents}. Must be integer 0-4294967295`);
  }
  return cents as CoinPaymentBalance;
}

/**
 * Create a validated CoinPaymentReceivable.
 * @param bytes - 32-byte receivable address
 * @throws Error if bytes are invalid
 */
export function createCoinPaymentReceivable(bytes: Uint8Array): CoinPaymentReceivable {
  if (bytes.length !== 32) {
    throw new Error(`Receivable must be 32 bytes, got ${bytes.length}`);
  }
  return bytes as CoinPaymentReceivable;
}

// ============================================================================
// Interfaces
// ============================================================================

/** Information about a payment purse */
export interface CoinPaymentPurseInfo {
  /** Unique purse identifier */
  readonly id: CoinPaymentPurseId;
  /** User-assigned name for the purse */
  readonly name: string;
  /** Current balance in cents */
  readonly balance: CoinPaymentBalance;
}

/** A cheque for transferring funds */
export interface CoinPaymentCheque {
  /** Source purse ID */
  readonly from: CoinPaymentPurseId;
  /** Destination receivable address */
  readonly to: CoinPaymentReceivable;
  /** Amount in cents */
  readonly amount: CoinPaymentBalance;
  /** Encrypted payload data */
  readonly encryptedData: Uint8Array;
}

/** Reference to a completed clearing transaction */
export interface CoinPaymentClearingReference {
  /** Transaction hash on chain */
  readonly txHash: string;
  /** Block number where transaction was included */
  readonly blockNumber: number;
  /** Unix timestamp in milliseconds */
  readonly timestamp: number;
}

// ============================================================================
// Status Types
// ============================================================================

/** Status for streaming payment operations */
export type CoinPaymentStatus =
  | { readonly type: 'clearing' }
  | { readonly type: 'failed'; readonly error: CoinPaymentError }
  | { readonly type: 'done'; readonly reference: CoinPaymentClearingReference };

// ============================================================================
// Error Types (matches truapi RFC 0017)
// ============================================================================

/** Error types for CoinPayment operations */
export type CoinPaymentError =
  | {
      readonly type: 'BalanceLow';
      readonly available: CoinPaymentBalance;
      readonly required: CoinPaymentBalance;
    }
  | { readonly type: 'Denied'; readonly reason: string }
  | { readonly type: 'BadCoins' }
  | { readonly type: 'SnipedCoins' }
  | { readonly type: 'PurseNotFound'; readonly purseId: CoinPaymentPurseId }
  | { readonly type: 'ReceivableNotFound' }
  | { readonly type: 'UnsupportedChannel' }
  | { readonly type: 'UserAgentCapabilityUnavailable' }
  | { readonly type: 'Internal'; readonly message: string };

// ============================================================================
// Listen Types
// ============================================================================

/** Payment channel type */
export type CoinPaymentChannel = 'standard' | 'custom';

/** Item received from payment listener */
export interface CoinPaymentListenItem {
  /** Channel the payment came through */
  readonly channel: CoinPaymentChannel;
  /** The received cheque (if available) */
  readonly cheque?: CoinPaymentCheque;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format a CoinPaymentBalance as a dollar string.
 * @param cents - Balance in cents
 * @returns Formatted string (e.g., "$12.50")
 */
export function formatCoinPaymentBalance(cents: CoinPaymentBalance): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

/**
 * Parse a dollar amount string to CoinPaymentBalance.
 * @param dollarString - String like "$12.50" or "12.50"
 * @returns Balance in cents
 * @throws Error if parsing fails
 */
export function parseCoinPaymentBalance(dollarString: string): CoinPaymentBalance {
  const cleaned = dollarString.replace(/^\$/, '').trim();
  const dollars = parseFloat(cleaned);
  if (isNaN(dollars) || dollars < 0) {
    throw new Error(`Invalid dollar amount: ${dollarString}`);
  }
  const cents = Math.round(dollars * 100);
  return createCoinPaymentBalance(cents);
}

/**
 * Check if a purse ID is the main purse.
 * @param id - Purse ID to check
 */
export function isMainPurse(id: CoinPaymentPurseId): boolean {
  return id === MAIN_PURSE;
}
