/**
 * Tests for IndividualityClient.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  IndividualityClient,
  generateAttestationMessage,
  buildAttestCallArgs,
  type PeopleLiteTxApi,
} from './client';
import type { PeopleLiteApi } from './people-lite';
import { MSG_PREFIX, type AttestationParams } from './types';
import { createPolkadotAddress } from '@cocuyo/types';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockApi(overrides?: Partial<PeopleLiteApi['query']['PeopleLite']>): PeopleLiteApi {
  return {
    query: {
      PeopleLite: {
        LitePeople: {
          getValue: vi.fn().mockResolvedValue(undefined),
        },
        AliasToAccount: {
          getValue: vi.fn().mockResolvedValue(undefined),
        },
        AccountToAlias: {
          getValue: vi.fn().mockResolvedValue(undefined),
        },
        AttestationAllowance: {
          getValue: vi.fn().mockResolvedValue(0),
        },
        LitePeopleCollectionCreated: {
          getValue: vi.fn().mockResolvedValue(true),
        },
        ...overrides,
      },
    },
  };
}

const testAddress = createPolkadotAddress('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');

// ============================================================================
// Tests
// ============================================================================

describe('IndividualityClient', () => {
  let api: PeopleLiteApi;
  let client: IndividualityClient;

  beforeEach(() => {
    api = createMockApi();
    client = new IndividualityClient(api);
  });

  afterEach(() => {
    client.destroy();
  });

  describe('getLitePerson', () => {
    it('returns null for unregistered account', async () => {
      const result = await client.getLitePerson(testAddress);
      expect(result).toBeNull();
    });

    it('returns LitePersonInfo for registered account', async () => {
      const mockInfo = {
        ring_vrf_key: new Uint8Array(32).fill(1),
        method: {
          type: 'UniqueDevice' as const,
          value: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
        },
      };

      api = createMockApi({
        LitePeople: {
          getValue: vi.fn().mockResolvedValue(mockInfo),
        },
      });
      client = new IndividualityClient(api);

      const result = await client.getLitePerson(testAddress);

      expect(result).not.toBeNull();
      expect(result?.method.type).toBe('UniqueDevice');
      expect(result?.ringVrfKey).toMatch(/^0x[0-9a-f]+$/);
    });
  });

  describe('getAttestationStatus', () => {
    it('returns not_registered for unregistered account', async () => {
      const status = await client.getAttestationStatus(testAddress);
      expect(status.status).toBe('not_registered');
    });

    it('returns registered with info for registered account', async () => {
      const mockInfo = {
        ring_vrf_key: new Uint8Array(32).fill(1),
        method: {
          type: 'UniqueDevice' as const,
          value: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
        },
      };

      api = createMockApi({
        LitePeople: {
          getValue: vi.fn().mockResolvedValue(mockInfo),
        },
      });
      client = new IndividualityClient(api);

      const status = await client.getAttestationStatus(testAddress);

      expect(status.status).toBe('registered');
      if (status.status === 'registered') {
        expect(status.info.method.type).toBe('UniqueDevice');
      }
    });
  });

  describe('canBeAttested', () => {
    it('returns eligible for unregistered account', async () => {
      const result = await client.canBeAttested(testAddress);
      expect(result.eligible).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('returns ineligible for already registered account', async () => {
      const mockInfo = {
        ring_vrf_key: new Uint8Array(32).fill(1),
        method: {
          type: 'UniqueDevice' as const,
          value: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
        },
      };

      api = createMockApi({
        LitePeople: {
          getValue: vi.fn().mockResolvedValue(mockInfo),
        },
      });
      client = new IndividualityClient(api);

      const result = await client.canBeAttested(testAddress);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('already registered');
    });

    it('returns ineligible if collection not created', async () => {
      api = createMockApi({
        LitePeopleCollectionCreated: {
          getValue: vi.fn().mockResolvedValue(false),
        },
      });
      client = new IndividualityClient(api);

      const result = await client.canBeAttested(testAddress);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('not yet initialized');
    });
  });

  describe('getAttestationAllowance', () => {
    it('returns zero allowance by default', async () => {
      const result = await client.getAttestationAllowance(testAddress);
      expect(result.verifier).toBe(testAddress);
      expect(result.remaining).toBe(0);
    });

    it('returns allowance for verifier with quota', async () => {
      api = createMockApi({
        AttestationAllowance: {
          getValue: vi.fn().mockResolvedValue(10),
        },
      });
      client = new IndividualityClient(api);

      const result = await client.getAttestationAllowance(testAddress);

      expect(result.remaining).toBe(10);
    });
  });

  describe('isLitePerson', () => {
    it('returns false for unregistered account', async () => {
      const result = await client.isLitePerson(testAddress);
      expect(result).toBe(false);
    });

    it('returns true for registered account', async () => {
      const mockInfo = {
        ring_vrf_key: new Uint8Array(32).fill(1),
        method: {
          type: 'UniqueDevice' as const,
          value: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
        },
      };

      api = createMockApi({
        LitePeople: {
          getValue: vi.fn().mockResolvedValue(mockInfo),
        },
      });
      client = new IndividualityClient(api);

      const result = await client.isLitePerson(testAddress);

      expect(result).toBe(true);
    });
  });

  describe('subscribeLitePerson', () => {
    it('calls callback immediately with current state', async () => {
      const callback = vi.fn();

      const unsubscribe = client.subscribeLitePerson(testAddress, callback, 1000);

      // Wait for the async poll to complete (give it time to resolve)
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callback).toHaveBeenCalledWith(null);
      unsubscribe();
    });

    it('returns unsubscribe function that stops polling', async () => {
      const callback = vi.fn();

      const unsubscribe = client.subscribeLitePerson(testAddress, callback, 100);

      // Wait for initial poll
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(callback).toHaveBeenCalled();
      const initialCallCount = callback.mock.calls.length;

      // Unsubscribe
      unsubscribe();

      // Wait to confirm no more calls happen
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should not have received more calls after unsubscribe
      expect(callback).toHaveBeenCalledTimes(initialCallCount);
    });

    it('only notifies when value changes', async () => {
      const callback = vi.fn();

      // Mock to return same value on subsequent calls
      const getValue = vi.fn().mockImplementation(() => {
        return Promise.resolve(undefined);
      });

      api = createMockApi({
        LitePeople: { getValue },
      });
      client = new IndividualityClient(api);

      // Use short polling interval
      const unsubscribe = client.subscribeLitePerson(testAddress, callback, 50);

      // Wait for initial poll and at least one more cycle
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Callback should only be called once (initial), not on subsequent polls
      // because the value hasn't changed
      expect(callback).toHaveBeenCalledTimes(1);
      unsubscribe();
    });
  });

  describe('generateAttestationMessage', () => {
    // Alice (5Grwva...) decodes to this well-known 32-byte AccountId32 public key.
    const ALICE_ACCOUNT_ID = new Uint8Array([
      0xd4, 0x35, 0x93, 0xc7, 0x15, 0xfd, 0xd3, 0x1c, 0x61, 0x14, 0x1a, 0xbd, 0x04, 0xa9, 0x9f,
      0xd6, 0x82, 0x2c, 0x85, 0x58, 0x85, 0x4c, 0xcd, 0xe3, 0x9a, 0x56, 0x84, 0xe7, 0xa5, 0x6d,
      0xa2, 0x7d,
    ]);

    it('produces the exact prefix + 32 + 32 byte layout', () => {
      const ringVrfKey = new Uint8Array(32).fill(0xab);

      const message = client.generateAttestationMessage(testAddress, ringVrfKey);

      // Length is MSG_PREFIX (30) + AccountId32 (32) + ring_vrf_key (32) = 94.
      expect(message.length).toBe(MSG_PREFIX.length + 32 + 32);
    });

    it('starts with MSG_PREFIX', () => {
      const ringVrfKey = new Uint8Array(32).fill(0xab);

      const message = generateAttestationMessage(testAddress, ringVrfKey);

      expect(message.slice(0, MSG_PREFIX.length)).toEqual(MSG_PREFIX);
    });

    it('SCALE-encodes the candidate as its 32-byte AccountId (known SS58 -> known bytes)', () => {
      const ringVrfKey = new Uint8Array(32).fill(0xab);

      const message = generateAttestationMessage(testAddress, ringVrfKey);

      // The 32 bytes after the prefix must be Alice's raw public key, NOT the
      // UTF-8 bytes of the SS58 string (the previous, unverifiable behavior).
      expect(message.slice(MSG_PREFIX.length, MSG_PREFIX.length + 32)).toEqual(ALICE_ACCOUNT_ID);
    });

    it('includes ringVrfKey at end of message', () => {
      const ringVrfKey = new Uint8Array(32).fill(0xab);

      const message = generateAttestationMessage(testAddress, ringVrfKey);

      expect(message.slice(-32)).toEqual(ringVrfKey);
    });

    it('rejects a ring VRF key that is not 32 bytes', () => {
      expect(() => generateAttestationMessage(testAddress, new Uint8Array(16))).toThrow(
        /ring_vrf_key must be 32 bytes/
      );
    });
  });

  describe('buildAttestCallArgs', () => {
    const params: AttestationParams = {
      candidate: testAddress,
      candidateSignature: new Uint8Array(64).fill(0x11),
      ringVrfKey: new Uint8Array(32).fill(0x22),
      proofOfOwnership: new Uint8Array(96).fill(0x33),
    };
    // Tag wrapped bytes so the test can assert exactly which buffer was wrapped.
    const wrap = (b: Uint8Array): { tag: 'fixed'; bytes: Uint8Array } => ({
      tag: 'fixed',
      bytes: b,
    });

    it('wraps the candidate signature as an Sr25519 MultiSignature', () => {
      const args = buildAttestCallArgs(params, wrap);
      expect(args.candidate).toBe(testAddress);
      expect(args.candidate_signature.type).toBe('Sr25519');
      expect(args.candidate_signature.value).toEqual({
        tag: 'fixed',
        bytes: params.candidateSignature,
      });
    });

    it('wraps ring_vrf_key and proof_of_ownership via the supplied wrapper', () => {
      const args = buildAttestCallArgs(params, wrap);
      expect(args.ring_vrf_key).toEqual({ tag: 'fixed', bytes: params.ringVrfKey });
      expect(args.proof_of_ownership).toEqual({ tag: 'fixed', bytes: params.proofOfOwnership });
    });

    it('omits consumer_registration when no consumer params are provided', () => {
      const args = buildAttestCallArgs(params, wrap);
      expect(args.consumer_registration).toBeUndefined();
    });

    it('includes consumer_registration when consumer params are provided', () => {
      const args = buildAttestCallArgs(params, wrap, {
        signature: new Uint8Array(64).fill(0x44),
        account: testAddress,
        identifierKey: new Uint8Array(65).fill(0x55),
        username: 'alice.42',
      });
      expect(args.consumer_registration).toBeDefined();
      expect(args.consumer_registration?.account).toBe(testAddress);
      expect(args.consumer_registration?.username).toBe('alice.42');
      expect(args.consumer_registration?.reserved_username).toBeUndefined();
    });
  });

  describe('submitAttestation', () => {
    const params: AttestationParams = {
      candidate: testAddress,
      candidateSignature: new Uint8Array(64).fill(0x11),
      ringVrfKey: new Uint8Array(32).fill(0x22),
      proofOfOwnership: new Uint8Array(96).fill(0x33),
    };
    const wrap = (b: Uint8Array): Uint8Array => b;
    const signer = { id: 'verifier-signer' };

    function makeTxApi(
      signAndSubmit: ReturnType<typeof vi.fn>,
      attestSpy?: ReturnType<typeof vi.fn>
    ): PeopleLiteTxApi {
      const attest = attestSpy ?? vi.fn();
      attest.mockReturnValue({ signAndSubmit });
      return { tx: { PeopleLite: { attest } } };
    }

    it('calls PeopleLite.attest with the structural args and forwards the signer', async () => {
      const signAndSubmit = vi
        .fn()
        .mockResolvedValue({ ok: true, txHash: '0xtx', block: { hash: '0xblock' } });
      const attest = vi.fn();
      const api = makeTxApi(signAndSubmit, attest);
      const args = buildAttestCallArgs(params, wrap);

      const result = await client.submitAttestation(api, args, signer);

      expect(attest).toHaveBeenCalledWith(args);
      expect(signAndSubmit).toHaveBeenCalledWith(signer);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ txHash: '0xtx', blockHash: '0xblock' });
      }
    });

    it('fails closed on an on-chain dispatch error (no fabricated success)', async () => {
      const signAndSubmit = vi.fn().mockResolvedValue({
        ok: false,
        txHash: '0xtx',
        block: { hash: '0xblock' },
        dispatchError: {},
      });
      const api = makeTxApi(signAndSubmit);
      const args = buildAttestCallArgs(params, wrap);

      const result = await client.submitAttestation(api, args, signer);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/failed on chain/);
      }
    });

    it('fails closed when submission throws', async () => {
      const signAndSubmit = vi.fn().mockRejectedValue(new Error('transport down'));
      const api = makeTxApi(signAndSubmit);
      const args = buildAttestCallArgs(params, wrap);

      const result = await client.submitAttestation(api, args, signer);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('transport down');
      }
    });
  });

  describe('destroy', () => {
    it('cleans up all subscriptions', async () => {
      vi.useFakeTimers();

      const callback1 = vi.fn();
      const callback2 = vi.fn();

      client.subscribeLitePerson(testAddress, callback1, 1000);
      client.subscribeLitePerson(
        createPolkadotAddress('5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'),
        callback2,
        1000
      );

      client.destroy();

      // Advance timers significantly
      await vi.advanceTimersByTimeAsync(10000);

      // Should not have received callbacks after destroy
      // (only initial calls before destroy)
      expect(callback1.mock.calls.length).toBeLessThanOrEqual(1);
      expect(callback2.mock.calls.length).toBeLessThanOrEqual(1);

      vi.useRealTimers();
    });
  });
});
