/**
 * Canonical credential derivation.
 *
 * This module provides the SINGLE source of truth for deriving DIM credentials
 * from Polkadot addresses. All credential derivation MUST go through this module
 * to ensure consistency across the codebase.
 *
 * Design decisions:
 * - Uses deterministic derivation: same address always produces same credential
 * - Format: `dim-{address}` preserves original address for debugging
 * - No hashing: addresses are already unique identifiers
 * - SS58 addresses are case-sensitive (base58), so case is preserved
 */

import type { DIMCredential, PolkadotAddress } from './brands';
import { createDIMCredential } from './brands';

/**
 * Derive a DIM credential from a Polkadot address.
 *
 * This is the CANONICAL function for credential derivation. All other code
 * should use this function rather than constructing credentials directly.
 *
 * The credential format is `dim-{address}`, which:
 * - Preserves the original address for debugging
 * - Is deterministic (same address always produces same credential)
 * - Works with both SS58 and hex (0x-prefixed) addresses
 *
 * @param address - Full account address (SS58 or hex with 0x prefix)
 * @returns DIM credential branded type
 *
 * @example
 * ```typescript
 * const credential = deriveCredential(createPolkadotAddress('5GrwvaEF...'));
 * // Returns: 'dim-5GrwvaEF...' as DIMCredential
 * ```
 */
export function deriveCredential(address: PolkadotAddress): DIMCredential {
  // Use address directly - it's already unique, no hashing needed
  // Preserve original case for SS58 compatibility
  return createDIMCredential(`dim-${address}`);
}

/**
 * Derive a DIM credential from a raw address string.
 *
 * Use this when you have a raw string address (e.g., from wallet connection).
 * Prefer deriveCredential() when you already have a typed PolkadotAddress.
 *
 * @param address - Raw address string (SS58 or hex with 0x prefix)
 * @returns DIM credential branded type
 */
export function deriveCredentialFromString(address: string): DIMCredential {
  return createDIMCredential(`dim-${address}`);
}

/**
 * Extract the original address from a DIM credential.
 *
 * Useful for reverse lookup (credential → address) in debugging
 * or when you need to recover the original address.
 *
 * @param credential - DIM credential to extract address from
 * @returns Original address string, or null if credential format is invalid
 */
export function extractAddressFromCredential(credential: DIMCredential): string | null {
  if (!credential.startsWith('dim-')) {
    return null;
  }
  return credential.slice(4); // Remove 'dim-' prefix
}

/**
 * Check if a credential was derived from a specific address.
 *
 * @param credential - DIM credential to check
 * @param address - Address to compare against
 * @returns true if the credential was derived from this address
 */
export function credentialMatchesAddress(credential: DIMCredential, address: string): boolean {
  return credential === `dim-${address}`;
}
