// ============================================================
// Shared ABI Utilities
// ============================================================

/**
 * Normalize call data to a 0x-prefixed hex string.
 *
 * Strings are assumed to already be hex and returned unchanged; byte arrays are
 * encoded to lowercase, zero-padded hex.
 */
export function toHex(data: string | Uint8Array): string {
  if (typeof data === 'string') return data;
  return `0x${Array.from(data)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;
}
