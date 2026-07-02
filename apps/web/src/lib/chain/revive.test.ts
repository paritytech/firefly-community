/**
 * Tests for the Revive contract helpers.
 *
 * These exercise the parts that are verifiable without a chain: address
 * validation, hex<->bytes conversion, and the fail-closed behavior of
 * `sendContractTx` / `callContract` against a mocked typed Asset Hub API.
 * They never hit a real chain.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the provider so the typed api is fully controlled by the test.
vi.mock('./asset-hub-provider', () => ({
  getAssetHubClient: vi.fn(),
}));

import {
  addressToH160,
  hexToBytes,
  bytesToHex,
  isValidH160,
  callContract,
  sendContractTx,
  REVIVE_WEIGHT_LIMIT,
  REVIVE_STORAGE_DEPOSIT_LIMIT,
  type HexString,
} from './revive';
import { getAssetHubClient } from './asset-hub-provider';

const mockGetClient = vi.mocked(getAssetHubClient);

const VALID_CONTRACT = '0xAA3Db3F2BD6E5D0c7C44e8BFc51Ba79A6d65773A' as HexString;
const SIGNER = { publicKey: new Uint8Array(32) } as never;
const CALLDATA = '0xdeadbeef' as HexString;

/** Build a mocked typed Asset Hub API with controllable Revive entry points. */
function buildApi(opts: {
  reviveCall?: ReturnType<typeof vi.fn>;
  signAndSubmit?: ReturnType<typeof vi.fn>;
  mapAccountWatch?: ReturnType<typeof vi.fn>;
}): {
  api: unknown;
  reviveCall: ReturnType<typeof vi.fn>;
  txCall: ReturnType<typeof vi.fn>;
  signAndSubmit: ReturnType<typeof vi.fn>;
} {
  // Default dry-run: account already mapped (success: true) so no map_account,
  // plus a non-zero weight/storage estimate so resolveGas consumes it.
  const reviveCall =
    opts.reviveCall ??
    vi.fn().mockResolvedValue({
      result: { success: true, value: { flags: 0, data: new Uint8Array([1, 2, 3]) } },
      weight_required: { ref_time: 111n, proof_size: 222n },
      storage_deposit: { type: 'Charge', value: 333n },
    });

  const signAndSubmit =
    opts.signAndSubmit ??
    vi.fn().mockResolvedValue({
      ok: true,
      txHash: '0xabc',
      block: { hash: '0xblock' },
    });

  const txCall = vi.fn(() => ({ signAndSubmit }));

  const mapAccountWatch =
    opts.mapAccountWatch ??
    vi.fn(() => ({
      subscribe: ({ next }: { next: (e: unknown) => void }) => {
        // Immediately report a successful mapping in a best block.
        queueMicrotask(() => next({ type: 'txBestBlocksState', found: true, ok: true }));
        return { unsubscribe: vi.fn() };
      },
    }));

  const api = {
    apis: { ReviveApi: { call: reviveCall } },
    tx: {
      Revive: {
        call: txCall,
        map_account: vi.fn(() => ({ signSubmitAndWatch: mapAccountWatch })),
      },
    },
  };

  return { api, reviveCall, txCall, signAndSubmit };
}

describe('addressToH160', () => {
  it('returns a checksummed 0x address for a valid input', () => {
    expect(addressToH160(VALID_CONTRACT.toLowerCase())).toBe(VALID_CONTRACT);
  });

  it('accepts an address without the 0x prefix and normalizes it', () => {
    const result = addressToH160(VALID_CONTRACT.slice(2));
    expect(result).toBe(VALID_CONTRACT);
  });

  it('throws on a malformed address', () => {
    expect(() => addressToH160('0x123')).toThrow('Invalid contract address');
    expect(() => addressToH160('not-an-address')).toThrow('Invalid contract address');
  });
});

describe('hex helpers', () => {
  it('round-trips hex <-> bytes', () => {
    const bytes = hexToBytes('0x010203ff');
    expect(Array.from(bytes)).toEqual([1, 2, 3, 255]);
    expect(bytesToHex(bytes)).toBe('0x010203ff');
  });

  it('validates H160 addresses', () => {
    expect(isValidH160(VALID_CONTRACT)).toBe(true);
    expect(isValidH160('0x123')).toBe(false);
    expect(isValidH160('not-hex')).toBe(false);
  });
});

describe('callContract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws for an undeployed (zero) contract without touching the chain', async () => {
    const { api, reviveCall } = buildApi({});
    mockGetClient.mockResolvedValue({ api } as never);

    await expect(
      callContract({
        contract: '0x0000000000000000000000000000000000000000' as HexString,
        calldata: CALLDATA,
      })
    ).rejects.toThrow('Contract not deployed');
    expect(reviveCall).not.toHaveBeenCalled();
  });

  it('returns the decoded data on a successful read', async () => {
    const { api } = buildApi({});
    mockGetClient.mockResolvedValue({ api } as never);

    const data = await callContract({ contract: VALID_CONTRACT, calldata: CALLDATA });
    expect(Array.from(data)).toEqual([1, 2, 3]);
  });

  it('throws when the read reverts (success: false)', async () => {
    const reviveCall = vi.fn().mockResolvedValue({
      result: { success: false, value: { type: 'Revert' } },
    });
    const { api } = buildApi({ reviveCall });
    mockGetClient.mockResolvedValue({ api } as never);

    await expect(callContract({ contract: VALID_CONTRACT, calldata: CALLDATA })).rejects.toThrow(
      'Contract call failed'
    );
  });
});

describe('sendContractTx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws for an undeployed (zero) contract (fail-closed)', async () => {
    const { api, signAndSubmit } = buildApi({});
    mockGetClient.mockResolvedValue({ api } as never);

    await expect(
      sendContractTx({
        contract: '0x0000000000000000000000000000000000000000' as HexString,
        calldata: CALLDATA,
        signer: SIGNER,
        origin: 'origin',
      })
    ).rejects.toThrow('Contract not deployed');
    expect(signAndSubmit).not.toHaveBeenCalled();
  });

  it('consumes the dry-run gas estimate and passes the native value through', async () => {
    const { api, txCall, signAndSubmit } = buildApi({});
    mockGetClient.mockResolvedValue({ api } as never);

    const result = await sendContractTx({
      contract: VALID_CONTRACT,
      calldata: CALLDATA,
      signer: SIGNER,
      origin: 'origin-ss58',
      // The extrinsic `value` is the NATIVE planck amount (not a 1e8-scaled EVM
      // value). The caller passes planck; sendContractTx forwards it verbatim.
      value: 7n,
    });

    expect(signAndSubmit).toHaveBeenCalledTimes(1);
    const callArg = txCall.mock.calls[0]?.[0] as {
      dest: string;
      value: bigint;
      weight_limit: { ref_time: bigint; proof_size: bigint };
      storage_deposit_limit: bigint;
      data: Uint8Array;
    };
    expect(callArg.dest).toBe(VALID_CONTRACT);
    // Native planck value is forwarded as-is — NOT scaled by 1e8.
    expect(callArg.value).toBe(7n);
    // Weight + storage come from the dry-run estimate, not the constants.
    expect(callArg.weight_limit).toEqual({ ref_time: 111n, proof_size: 222n });
    expect(callArg.storage_deposit_limit).toBe(333n);
    expect(Array.from(callArg.data)).toEqual([0xde, 0xad, 0xbe, 0xef]);
    expect(result).toEqual({ txHash: '0xabc', blockHash: '0xblock', success: true });
  });

  it('falls back to the hardcoded gas constants when the dry-run estimate is empty', async () => {
    // success (mapped) but a zero/empty weight estimate → fall back to constants.
    const reviveCall = vi.fn().mockResolvedValue({
      result: { success: true, value: { flags: 0, data: new Uint8Array([1]) } },
      weight_required: { ref_time: 0n, proof_size: 0n },
      storage_deposit: { type: 'Refund', value: 0n },
    });
    const { api, txCall } = buildApi({ reviveCall });
    mockGetClient.mockResolvedValue({ api } as never);

    await sendContractTx({
      contract: VALID_CONTRACT,
      calldata: CALLDATA,
      signer: SIGNER,
      origin: 'origin-ss58',
    });

    const callArg = txCall.mock.calls[0]?.[0] as {
      weight_limit: typeof REVIVE_WEIGHT_LIMIT;
      storage_deposit_limit: bigint;
    };
    expect(callArg.weight_limit).toBe(REVIVE_WEIGHT_LIMIT);
    expect(callArg.storage_deposit_limit).toBe(REVIVE_STORAGE_DEPOSIT_LIMIT);
  });

  it('probes mapping with the dedicated VIEW calldata, not the mutating calldata', async () => {
    const PROBE = '0xabcdef01' as HexString;
    const reviveCall = vi.fn().mockResolvedValue({
      result: { success: true, value: { flags: 0, data: new Uint8Array([1]) } },
      weight_required: { ref_time: 1n, proof_size: 1n },
      storage_deposit: { type: 'Charge', value: 1n },
    });
    const { api } = buildApi({ reviveCall });
    mockGetClient.mockResolvedValue({ api } as never);

    await sendContractTx({
      contract: VALID_CONTRACT,
      calldata: CALLDATA,
      probeCalldata: PROBE,
      signer: SIGNER,
      origin: 'origin-ss58',
    });

    // First ReviveApi.call is the mapping probe — its input_data MUST be the VIEW
    // probe calldata, never the mutating calldata.
    const probeArgs = reviveCall.mock.calls[0];
    expect(Array.from(probeArgs?.[5] as Uint8Array)).toEqual([0xab, 0xcd, 0xef, 0x01]);
    // The gas dry-run (second call) uses the real mutating calldata.
    const gasArgs = reviveCall.mock.calls[1];
    expect(Array.from(gasArgs?.[5] as Uint8Array)).toEqual([0xde, 0xad, 0xbe, 0xef]);
  });

  it('does NOT map the account when the real call reverts but the view probe succeeds', async () => {
    // The VIEW probe succeeds (account IS mapped); the gas dry-run of the real
    // call reverts. A revert of the real call must NOT trigger map_account.
    const reviveCall = vi
      .fn()
      // 1st call: mapping probe (view) → success → account is mapped.
      .mockResolvedValueOnce({
        result: { success: true, value: { flags: 0, data: new Uint8Array([1]) } },
      })
      // 2nd call: gas dry-run of the real (reverting) call → success: false.
      .mockResolvedValueOnce({
        result: { success: false, value: { type: 'Revert' } },
      });
    const mapWatch = vi.fn(() => ({
      subscribe: ({ next }: { next: (e: unknown) => void }) => {
        queueMicrotask(() => next({ type: 'txBestBlocksState', found: true, ok: true }));
        return { unsubscribe: vi.fn() };
      },
    }));
    const { api } = buildApi({ reviveCall, mapAccountWatch: mapWatch });
    mockGetClient.mockResolvedValue({ api } as never);

    await sendContractTx({
      contract: VALID_CONTRACT,
      calldata: CALLDATA,
      probeCalldata: '0xabcdef01' as HexString,
      signer: SIGNER,
      origin: 'origin-ss58',
    });

    // The reverting real call did not masquerade as "unmapped".
    expect(mapWatch).not.toHaveBeenCalled();
  });

  it('maps the account first when the dry-run reports it is unmapped', async () => {
    // First ReviveApi.call (the mapping probe) fails → triggers map_account.
    const reviveCall = vi.fn().mockResolvedValue({
      result: { success: false, value: { type: 'Unmapped' } },
    });
    const mapWatch = vi.fn(() => ({
      subscribe: ({ next }: { next: (e: unknown) => void }) => {
        queueMicrotask(() => next({ type: 'txBestBlocksState', found: true, ok: true }));
        return { unsubscribe: vi.fn() };
      },
    }));
    const { api } = buildApi({ reviveCall, mapAccountWatch: mapWatch });
    mockGetClient.mockResolvedValue({ api } as never);

    const result = await sendContractTx({
      contract: VALID_CONTRACT,
      calldata: CALLDATA,
      signer: SIGNER,
      origin: 'origin-ss58',
    });

    expect(mapWatch).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });

  it('fails closed when the dispatch reports an error', async () => {
    const signAndSubmit = vi.fn().mockResolvedValue({
      ok: false,
      dispatchError: { type: 'Module' },
      txHash: '0xdead',
      block: { hash: '0xblock' },
    });
    const { api } = buildApi({ signAndSubmit });
    mockGetClient.mockResolvedValue({ api } as never);

    await expect(
      sendContractTx({
        contract: VALID_CONTRACT,
        calldata: CALLDATA,
        signer: SIGNER,
        origin: 'origin-ss58',
      })
    ).rejects.toThrow('Transaction failed');
  });

  it('fails closed when finalization exceeds the timeout', async () => {
    vi.useFakeTimers();
    const signAndSubmit = vi.fn().mockReturnValue(new Promise(() => undefined)); // never resolves
    const { api } = buildApi({ signAndSubmit });
    mockGetClient.mockResolvedValue({ api } as never);

    const promise = sendContractTx({
      contract: VALID_CONTRACT,
      calldata: CALLDATA,
      signer: SIGNER,
      origin: 'origin-ss58',
    });
    const assertion = expect(promise).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
  });
});
