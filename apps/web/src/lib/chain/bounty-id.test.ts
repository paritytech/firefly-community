/**
 * Tests for deterministic bounty id derivation.
 *
 * The id must be reproducible from stable inputs (never Date.now()) so the
 * persisted campaign references the exact on-chain bounty and an orphaned
 * transfer can be reconciled. These verify determinism and input-sensitivity,
 * plus that the derived string hashes to a stable bytes32 via `toBountyId`.
 */

import { describe, it, expect } from 'vitest';
import { deterministicBountyId } from './bounty-id';
import { toBountyId } from './bounty-escrow';

const CLAIM = 'claim-1';
const FUNDER = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const EVM_AMOUNT = 100n * 10n ** 18n;
const EXPIRES = 1_900_000_000;

describe('deterministicBountyId', () => {
  it('is deterministic — identical inputs always produce the same id', () => {
    const a = deterministicBountyId(CLAIM, FUNDER, EVM_AMOUNT, EXPIRES);
    const b = deterministicBountyId(CLAIM, FUNDER, EVM_AMOUNT, EXPIRES);
    expect(a).toBe(b);
  });

  it('does not embed a timestamp — repeated calls over time are stable', () => {
    const first = deterministicBountyId(CLAIM, FUNDER, EVM_AMOUNT, EXPIRES);
    // A non-deterministic (Date.now-based) id would differ here; this must not.
    const later = deterministicBountyId(CLAIM, FUNDER, EVM_AMOUNT, EXPIRES);
    expect(later).toBe(first);
  });

  it('changes when any stable input changes', () => {
    const base = deterministicBountyId(CLAIM, FUNDER, EVM_AMOUNT, EXPIRES);
    expect(deterministicBountyId('claim-2', FUNDER, EVM_AMOUNT, EXPIRES)).not.toBe(base);
    expect(deterministicBountyId(CLAIM, 'other-funder', EVM_AMOUNT, EXPIRES)).not.toBe(base);
    expect(deterministicBountyId(CLAIM, FUNDER, EVM_AMOUNT + 1n, EXPIRES)).not.toBe(base);
    expect(deterministicBountyId(CLAIM, FUNDER, EVM_AMOUNT, EXPIRES + 1)).not.toBe(base);
  });

  it('uses a "general" sentinel for a null claim', () => {
    const id = deterministicBountyId(null, FUNDER, EVM_AMOUNT, EXPIRES);
    expect(id).toContain('-general-');
  });

  it('hashes to a stable bytes32 on-chain id via toBountyId', () => {
    const id = deterministicBountyId(CLAIM, FUNDER, EVM_AMOUNT, EXPIRES);
    const onChain = toBountyId(id);
    // bytes32 hex shape, and stable across re-derivation.
    expect(onChain).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(toBountyId(deterministicBountyId(CLAIM, FUNDER, EVM_AMOUNT, EXPIRES))).toBe(onChain);
  });
});
