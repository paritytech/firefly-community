/**
 * SS58 -> H160 derivation in contract clients.
 *
 * Regression test for the three revive contract clients (AllianceGovernance,
 * CrowdstackingPool, OutletRegistry) that previously threw on any SS58 address
 * ("SS58 to H160 derivation is not yet implemented"). They now use the shared
 * `toH160` from `@/lib/utils/address`, which derives a deterministic H160 from
 * an SS58 account and passes through valid Ethereum (H160) addresses unchanged.
 *
 * These tests never hit the chain: `callContract` is mocked so we only exercise
 * the address-handling path (encode the calldata for the derived H160).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPolkadotAddress } from '@cocuyo/types';
import { toH160 } from '@/lib/utils/address';

// Capture the calldata that the client builds so we can assert the derived
// H160 is what actually gets encoded, without ever touching the network.
// `vi.hoisted` is required because `vi.mock` is hoisted above normal `const`s.
const { callContract } = vi.hoisted(() => ({
  callContract: vi.fn<(args: unknown) => Promise<string>>(),
}));
vi.mock('../revive', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../revive')>();
  return {
    ...actual,
    callContract,
  };
});

import { CrowdstackingPoolClient } from './crowdstacking-pool';
import { AllianceGovernanceClient } from './alliance-governance';

// Alice — a well-known native (sr25519) Substrate account.
const ALICE_SS58 = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
// A valid Ethereum-style H160 (should pass through unchanged).
const SAMPLE_H160 = '0x1234567890123456789012345678901234567890';

const POOL_ADDRESS = '0x00000000000000000000000000000000000000aa';
const TOKEN_ADDRESS = '0x00000000000000000000000000000000000000bb';
const GOV_ADDRESS = '0x00000000000000000000000000000000000000cc';

const isHex20 = (value: string): boolean => /^0x[0-9a-fA-F]{40}$/.test(value);

/** Return the lowercased calldata of the Nth recorded callContract invocation. */
const calldataOf = (index: number): string => {
  const call = callContract.mock.calls[index];
  if (call === undefined) {
    throw new Error(`callContract was not invoked ${index + 1} time(s)`);
  }
  const arg = call[0] as { calldata: string };
  return arg.calldata.toLowerCase();
};

describe('SS58 -> H160 derivation (shared toH160)', () => {
  it('derives a 20-byte 0x H160 from an SS58 address', () => {
    const derived = toH160(ALICE_SS58);
    expect(isHex20(derived)).toBe(true);
  });

  it('is deterministic across calls for the same SS58 address', () => {
    expect(toH160(ALICE_SS58)).toBe(toH160(ALICE_SS58));
  });

  it('passes a valid H160 through unchanged', () => {
    expect(toH160(SAMPLE_H160)).toBe(SAMPLE_H160);
  });
});

describe('contract clients accept SS58 addresses without throwing', () => {
  beforeEach(() => {
    callContract.mockReset();
    // 32-byte zero word — a valid ABI return for the uint/bool/struct reads below.
    callContract.mockResolvedValue(`0x${'00'.repeat(32)}`);
  });

  describe('CrowdstackingPoolClient.getPosition', () => {
    it('does not throw for an SS58 address and queries the derived H160', async () => {
      const client = new CrowdstackingPoolClient({
        poolAddress: POOL_ADDRESS,
        tokenAddress: TOKEN_ADDRESS,
      });

      await expect(client.getPosition(createPolkadotAddress(ALICE_SS58))).resolves.not.toThrow();

      // The calldata must embed the deterministically derived H160.
      const derived = toH160(ALICE_SS58).slice(2).toLowerCase();
      expect(callContract).toHaveBeenCalledTimes(1);
      expect(calldataOf(0)).toContain(derived);
    });

    it('passes a valid H160 through unchanged', async () => {
      const client = new CrowdstackingPoolClient({
        poolAddress: POOL_ADDRESS,
        tokenAddress: TOKEN_ADDRESS,
      });

      await client.getPosition(createPolkadotAddress(SAMPLE_H160));

      expect(calldataOf(0)).toContain(SAMPLE_H160.slice(2).toLowerCase());
    });
  });

  describe('AllianceGovernanceClient.hasVoted', () => {
    it('does not throw for an SS58 address and queries the derived H160', async () => {
      const client = new AllianceGovernanceClient({ governanceAddress: GOV_ADDRESS });

      await expect(
        client.hasVoted('proposal-1', createPolkadotAddress(ALICE_SS58))
      ).resolves.not.toThrow();

      const derived = toH160(ALICE_SS58).slice(2).toLowerCase();
      expect(calldataOf(0)).toContain(derived);
    });
  });
});
