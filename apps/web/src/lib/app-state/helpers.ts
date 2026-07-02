/**
 * Pure helpers for app-state domain hooks.
 *
 * These are framework-agnostic utilities extracted from AppStateProvider so the
 * domain hooks and the provider stay small. Behaviour is identical to the
 * original inline implementations.
 */

/** Generate a time-ordered, collision-resistant local id. */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Deterministically derive a human-readable pseudonym from a wallet address. */
export function generatePseudonym(address: string): string {
  const adjectives = ['Swift', 'Bright', 'Silent', 'Brave', 'Calm', 'Keen', 'Noble', 'Wise'];
  const nouns = ['Firefly', 'Phoenix', 'Falcon', 'Raven', 'Spark', 'Ember', 'Star', 'Light'];

  // Use address to deterministically pick words
  const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const adj = adjectives[hash % adjectives.length];
  const noun = nouns[(hash >> 4) % nouns.length];

  return `${adj}${noun}`;
}

/**
 * Convert a dollar funding amount to the smallest unit (6 decimals,
 * 1 pUSD = 1,000,000 units).
 *
 * Uses string parsing to avoid floating point multiplication errors —
 * e.g. `0.000001 * 1_000_000` can produce `0.9999999999999999` instead of `1`.
 */
export function fundingDollarsToUnits(fundingAmount: number): bigint {
  const amountStr = fundingAmount.toFixed(6);
  const [whole = '0', decimal = ''] = amountStr.split('.');
  const paddedDecimal = decimal.padEnd(6, '0').slice(0, 6);
  return BigInt(whole + paddedDecimal);
}
