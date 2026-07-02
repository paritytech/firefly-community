/**
 * Product Account types for ProductAccountId-based signing.
 *
 * ProductAccountId is a tuple of [DotNsIdentifier, DerivationIndex] that
 * identifies a specific account in the host's hierarchical key derivation.
 *
 * This enables host SSO signing flows without exposing private keys to products.
 */

import type { DotNsIdentifier } from './identity';
import { createDotNsIdentifier } from './identity';

// ============================================================================
// Branded Types
// ============================================================================

/** Derivation index for account hierarchy */
export type DerivationIndex = number & { readonly __brand: 'DerivationIndex' };

/**
 * Create a validated DerivationIndex.
 * @param value - The derivation index (non-negative integer)
 * @throws Error if index is invalid
 */
export function createDerivationIndex(value: number): DerivationIndex {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid derivation index: ${value}. Must be non-negative integer`);
  }
  return value as DerivationIndex;
}

// ============================================================================
// ProductAccountId
// ============================================================================

/**
 * ProductAccountId tuple: [dotNsIdentifier, derivationIndex]
 *
 * Identifies a specific account for signing operations in the host's
 * hierarchical key derivation scheme.
 *
 * - derivationIndex 0 = default account
 * - derivationIndex 1+ = additional derived accounts
 */
export type ProductAccountId = readonly [DotNsIdentifier, DerivationIndex];

/**
 * Create a ProductAccountId from identifier and index.
 * @param identifier - DotNS identifier string
 * @param derivationIndex - Account derivation index
 */
export function createProductAccountId(
  identifier: string,
  derivationIndex: number
): ProductAccountId {
  return [createDotNsIdentifier(identifier), createDerivationIndex(derivationIndex)] as const;
}

/**
 * Get the default ProductAccountId (derivation index 0).
 * @param identifier - DotNS identifier string
 */
export function getDefaultProductAccountId(identifier: string): ProductAccountId {
  return createProductAccountId(identifier, 0);
}

/**
 * Get the DotNS identifier from a ProductAccountId.
 */
export function getAccountIdentifier(accountId: ProductAccountId): DotNsIdentifier {
  return accountId[0];
}

/**
 * Get the derivation index from a ProductAccountId.
 */
export function getAccountDerivationIndex(accountId: ProductAccountId): DerivationIndex {
  return accountId[1];
}

/**
 * Check if a ProductAccountId is the default account (index 0).
 */
export function isDefaultAccount(accountId: ProductAccountId): boolean {
  return accountId[1] === 0;
}

/**
 * Format a ProductAccountId for display.
 * Returns "{identifier}#{index}" or just "{identifier}" for default account.
 */
export function formatProductAccountId(accountId: ProductAccountId): string {
  const [identifier, index] = accountId;
  if (index === 0) {
    return identifier;
  }
  return `${identifier}#${index}`;
}

// ============================================================================
// Signing Types
// ============================================================================

/** JSON payload for signing (matches polkadot-js SignerPayloadJSON) */
export interface SignerPayloadJSON {
  readonly address: string;
  readonly blockHash: string;
  readonly blockNumber: string;
  readonly era: string;
  readonly genesisHash: string;
  readonly method: string;
  readonly nonce: string;
  readonly signedExtensions: readonly string[];
  readonly specVersion: string;
  readonly tip: string;
  readonly transactionVersion: string;
  readonly version: number;
}

/** Result of a signing operation */
export type SigningResult =
  | { readonly ok: true; readonly signature: Uint8Array }
  | { readonly ok: false; readonly error: string };
