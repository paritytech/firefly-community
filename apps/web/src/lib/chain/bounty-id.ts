/**
 * Deterministic bounty id derivation.
 *
 * The on-chain bounty id MUST be deterministic — derived from stable funding
 * inputs, never `Date.now()`. A deterministic id is reproducible and therefore
 * recoverable: the same funding intent always yields the same on-chain bounty
 * id, so the persisted campaign can reference the exact on-chain bounty and an
 * orphaned on-chain transfer can be reconciled against it.
 *
 * NOTE: real orphan-reconciliation needs persistence beyond in-memory app state
 * (e.g. an on-chain / indexer lookup) and is out of scope here; this module only
 * guarantees the id is deterministic so it can be recorded with the campaign.
 */

/**
 * Build a deterministic bounty id string from stable funding inputs.
 *
 * @param claimId Target claim id, or null for a general (claim-less) campaign.
 * @param funder Funder's SS58 address.
 * @param evmAmount Funding amount in EVM 18-decimal units.
 * @param expiresAt Unix expiry (seconds).
 * @returns A stable id string (hashed to bytes32 downstream via `toBountyId`).
 */
export function deterministicBountyId(
  claimId: string | null,
  funder: string,
  evmAmount: bigint,
  expiresAt: number
): string {
  return `bounty-${claimId ?? 'general'}-${funder}-${evmAmount.toString()}-${expiresAt}`;
}
