/**
 * Tests for the AllianceGovernance revive client.
 *
 * Focus on the honest-data posture for the live chain path:
 * - mapContractProposal (via getProposal) returns aggregate-only vote data
 *   (voteTally) and an EMPTY per-voter `votes` list — no fabricated zero-address
 *   voters — and leaves payload/title/timeline as honest-unknown.
 * - createProposal verifies the candidate id's on-chain proposer matches the
 *   caller and FAILS CLOSED on mismatch rather than returning a racy id.
 *
 * `callContract` / `sendContractTx` are mocked so nothing touches a chain.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { allianceGovernanceInterface } from '../abi/alliance-governance';
import { deriveH160 } from '@/lib/utils/address';

vi.mock('../revive', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../revive')>();
  return { ...actual, callContract: vi.fn(), sendContractTx: vi.fn() };
});

vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>();
  return {
    ...actual,
    requireContractAddress: vi.fn(() => '0xAA3Db3F2BD6E5D0c7C44e8BFc51Ba79A6d65773A'),
  };
});

import { callContract, sendContractTx } from '../revive';
import { AllianceGovernanceClient } from './alliance-governance';

const mockCall = vi.mocked(callContract);
const mockSend = vi.mocked(sendContractTx);

const GOV = '0xAA3Db3F2BD6E5D0c7C44e8BFc51Ba79A6d65773A';
const SIGNER = { publicKey: new Uint8Array(32) } as never;
const CALLER_H160 = deriveH160(new Uint8Array(32));

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Encode a getProposal tuple result. */
function encodeProposal(opts: {
  id: bigint;
  proposer: string;
  forVotes?: bigint;
  againstVotes?: bigint;
  abstainVotes?: bigint;
  executed?: boolean;
  cancelled?: boolean;
}): Uint8Array {
  const tuple = [
    opts.id,
    opts.proposer,
    3, // ParameterChange
    '0x', // payload
    0n, // snapshotBlock
    0n, // startBlock
    0n, // endBlock
    opts.forVotes ?? 0n,
    opts.againstVotes ?? 0n,
    opts.abstainVotes ?? 0n,
    opts.executed ?? false,
    opts.cancelled ?? false,
  ];
  return hexToBytes(allianceGovernanceInterface.encodeFunctionResult('getProposal', [tuple]));
}

function encodeCount(count: bigint): Uint8Array {
  return hexToBytes(allianceGovernanceInterface.encodeFunctionResult('proposalCount', [count]));
}

function makeClient(): AllianceGovernanceClient {
  return new AllianceGovernanceClient({ governanceAddress: GOV });
}

describe('AllianceGovernanceClient.getProposal (aggregate-only mapping)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns voteTally aggregates and an EMPTY votes list (no fabricated voters)', async () => {
    mockCall.mockResolvedValue(
      encodeProposal({
        id: 1n,
        proposer: '0x1111111111111111111111111111111111111111',
        forVotes: 80n,
        againstVotes: 20n,
        abstainVotes: 5n,
      })
    );

    const proposal = await makeClient().getProposal('proposal-1');
    expect(proposal).not.toBeNull();
    // No synthetic per-voter ballots.
    expect(proposal?.votes).toHaveLength(0);
    // Real aggregate counts carried honestly.
    expect(proposal?.voteTally).toEqual({ approve: 80, reject: 20, abstain: 5 });
    // Honest-unknown fields, not fabricated.
    expect(proposal?.payload).toBeUndefined();
    expect(proposal?.description).toBe('');
    expect(proposal?.createdAt).toBe(0);
    expect(proposal?.expiresAt).toBe(0);
    expect(proposal?.finalizedAt).toBeUndefined();
  });
});

describe('AllianceGovernanceClient.createProposal (id verification / fail-closed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ txHash: '0xabc', blockHash: '0xblock', success: true });
  });

  it('returns the derived id when the on-chain proposer matches the caller', async () => {
    mockCall.mockImplementation(({ calldata }) => {
      const fn = allianceGovernanceInterface.parseTransaction({ data: calldata })?.name;
      if (fn === 'proposalCount') return Promise.resolve(encodeCount(7n));
      if (fn === 'getProposal')
        return Promise.resolve(encodeProposal({ id: 7n, proposer: CALLER_H160 }));
      throw new Error(`unexpected call: ${fn ?? 'unknown'}`);
    });

    const result = await makeClient().createProposal('parameter-change', '0x', 'desc', SIGNER);
    expect(result.proposalId).toBe('proposal-7');
    expect(result.txHash).toBe('0xabc');
  });

  it('FAILS CLOSED when the candidate id was created by a different account', async () => {
    mockCall.mockImplementation(({ calldata }) => {
      const fn = allianceGovernanceInterface.parseTransaction({ data: calldata })?.name;
      if (fn === 'proposalCount') return Promise.resolve(encodeCount(7n));
      if (fn === 'getProposal')
        return Promise.resolve(
          encodeProposal({ id: 7n, proposer: '0x9999999999999999999999999999999999999999' })
        );
      throw new Error(`unexpected call: ${fn ?? 'unknown'}`);
    });

    await expect(
      makeClient().createProposal('parameter-change', '0x', 'desc', SIGNER)
    ).rejects.toThrow(/could not be confirmed/i);
    // The tx was still submitted; only the unconfirmed id is refused.
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('FAILS CLOSED when no proposal exists at the candidate id', async () => {
    mockCall.mockImplementation(({ calldata }) => {
      const fn = allianceGovernanceInterface.parseTransaction({ data: calldata })?.name;
      if (fn === 'proposalCount') return Promise.resolve(encodeCount(7n));
      if (fn === 'getProposal')
        return Promise.resolve(encodeProposal({ id: 0n, proposer: CALLER_H160 }));
      throw new Error(`unexpected call: ${fn ?? 'unknown'}`);
    });

    await expect(
      makeClient().createProposal('parameter-change', '0x', 'desc', SIGNER)
    ).rejects.toThrow(/could not confirm/i);
  });
});
