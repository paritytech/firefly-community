/**
 * Tests for the BountyEscrow revive client.
 *
 * Verifies the ABI calldata encoding (selector + args) and that fundBounty
 * forwards the right contract/value to sendContractTx, plus the not-deployed
 * fail-closed guard. sendContractTx and the contract-address resolver are mocked
 * so nothing touches a chain.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ethers } from 'ethers';
import { BOUNTY_ESCROW_ABI } from './evm/abis/BountyEscrow';

vi.mock('./revive', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./revive')>();
  return { ...actual, sendContractTx: vi.fn() };
});

vi.mock('./evm/config', () => ({
  getContractAddress: vi.fn(),
}));

// Mock the provider so fundBounty reads a controlled NativeToEthRatio without a
// chain connection. 1e8 is the Paseo value (18 EVM decimals − 10 native = 8).
// The literal is inlined because vi.mock factories are hoisted above top-level
// consts and cannot reference them.
vi.mock('./asset-hub-provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./asset-hub-provider')>();
  return {
    ...actual,
    getAssetHubClient: vi.fn().mockResolvedValue({ nativeToEvmRatio: 100_000_000n }),
  };
});

/** Paseo NativeToEthRatio, mirrored for assertions (see the mock above). */
const NATIVE_TO_EVM_RATIO = 100_000_000n;

import { fundBounty } from './bounty-escrow';
import { sendContractTx } from './revive';
import { getContractAddress } from './evm/config';

const mockSend = vi.mocked(sendContractTx);
const mockGetAddress = vi.mocked(getContractAddress);

const CONTRACT = '0xAA3Db3F2BD6E5D0c7C44e8BFc51Ba79A6d65773A';
const SIGNER = { publicKey: new Uint8Array(32) } as never;
const ORIGIN = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const iface = new ethers.Interface(BOUNTY_ESCROW_ABI);

describe('fundBounty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAddress.mockReturnValue(CONTRACT);
    mockSend.mockResolvedValue({ txHash: '0xabc', blockHash: '0xblock', success: true });
  });

  it('throws (fail-closed) when the contract is not deployed', async () => {
    mockGetAddress.mockReturnValue(null);
    await expect(
      fundBounty({ origin: ORIGIN, signer: SIGNER, bountyId: 'b1', amount: 5n, expiresAt: 1000 })
    ).rejects.toThrow('not deployed');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('encodes EVM amount in calldata but forwards NATIVE planck as the extrinsic value', async () => {
    // 100 PAS expressed in EVM 18-decimal units.
    const evmAmount = 100n * 10n ** 18n;
    await fundBounty({
      origin: ORIGIN,
      signer: SIGNER,
      bountyId: 'campaign-42',
      amount: evmAmount,
      expiresAt: 2_000,
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const params = mockSend.mock.calls[0]?.[0];
    if (params === undefined) throw new Error('sendContractTx not called');

    // Selector matches the fundBounty(bytes32,address,uint256,uint256) signature.
    const expectedSelector = iface.getFunction('fundBounty')?.selector;
    expect(params.calldata.slice(0, 10)).toBe(expectedSelector);

    // Decoding the calldata recovers the exact args we passed. The ABI `amount_`
    // arg stays in EVM 18-decimal units (the contract's msg.value comparison).
    const decoded = iface.decodeFunctionData('fundBounty', params.calldata);
    expect(decoded[0]).toBe(ethers.keccak256(ethers.toUtf8Bytes('campaign-42')));
    expect(decoded[1]).toBe(ethers.ZeroAddress);
    expect(decoded[2]).toBe(evmAmount);
    expect(decoded[3]).toBe(2_000n);

    expect(params.contract).toBe(CONTRACT);
    expect(params.origin).toBe(ORIGIN);

    // The extrinsic `value` is the NATIVE planck amount (10 decimals), i.e. the
    // EVM amount divided by NativeToEthRatio (1e8) — NOT the 1e8-scaled EVM value.
    expect(params.value).toBe(evmAmount / NATIVE_TO_EVM_RATIO); // = 100 * 1e10 planck
    expect(params.value).toBe(100n * 10n ** 10n);
    expect(params.value).not.toBe(evmAmount);

    // The mapping probe uses the side-effect-free `paused()` VIEW calldata, never
    // the payable fundBounty calldata.
    const expectedProbe = iface.encodeFunctionData('paused', []);
    expect(params.probeCalldata).toBe(expectedProbe);
  });

  it('uses an already-hashed bytes32 id as-is', async () => {
    const id = `0x${'ab'.repeat(32)}`;
    await fundBounty({
      origin: ORIGIN,
      signer: SIGNER,
      bountyId: id,
      amount: 1n,
      expiresAt: 1,
    });
    const params = mockSend.mock.calls[0]?.[0];
    if (params === undefined) throw new Error('sendContractTx not called');
    const decoded = iface.decodeFunctionData('fundBounty', params.calldata);
    expect((decoded[0] as string).toLowerCase()).toBe(id);
  });

  it('sends 0 value when funding with a non-native (ERC-20) asset', async () => {
    const erc20 = '0x1111111111111111111111111111111111111111';
    await fundBounty({
      origin: ORIGIN,
      signer: SIGNER,
      bountyId: 'b',
      amount: 9n,
      expiresAt: 1,
      paymentAsset: erc20,
    });
    const params = mockSend.mock.calls[0]?.[0];
    if (params === undefined) throw new Error('sendContractTx not called');
    expect(params.value).toBe(0n);
    const decoded = iface.decodeFunctionData('fundBounty', params.calldata);
    expect((decoded[1] as string).toLowerCase()).toBe(erc20);
  });

  it('propagates the sendContractTx result', async () => {
    const result = await fundBounty({
      origin: ORIGIN,
      signer: SIGNER,
      bountyId: 'b',
      amount: 1n,
      expiresAt: 1,
    });
    expect(result).toEqual({ txHash: '0xabc', blockHash: '0xblock', success: true });
  });
});
