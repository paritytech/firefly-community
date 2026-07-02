/**
 * BountyEscrow Contract Writes (Revive)
 *
 * Thin revive-based client for the BountyEscrow contract. ABI-encodes calls with
 * `ethers.Interface` over the BountyEscrow ABI and submits them through the real
 * `Revive.call` extrinsic via {@link sendContractTx}.
 *
 * This is the on-chain counterpart to the read-only `useBountyEscrow` hook (which
 * uses ethers + EVM JSON-RPC). Writes go through PAPI/Revive so the host signs the
 * Substrate extrinsic. FAILS CLOSED: a missing contract address or a failed
 * dispatch throws rather than reporting a fake success.
 */

import type { PolkadotSigner } from 'polkadot-api';
import { ethers } from 'ethers';
import { BOUNTY_ESCROW_ABI } from './evm/abis/BountyEscrow';
import { getContractAddress, type NetworkName } from './evm/config';
import { sendContractTx, type HexString, type TransactionResult } from './revive';
import { getAssetHubClient, nativeValueFromEvmAmount } from './asset-hub-provider';
import { createLogger } from '../logging';

const logger = createLogger('BountyEscrow');

/** Native-asset sentinel — `address(0)` means "fund with the native token". */
const NATIVE_ASSET = ethers.ZeroAddress;

/** Cached ABI interface (encoding is pure, so a single instance is reused). */
const bountyEscrowInterface = new ethers.Interface(BOUNTY_ESCROW_ABI);

export interface FundBountyParams {
  /** Caller's SS58 address (origin), used for the account-mapping dry-run. */
  readonly origin: string;
  /** Signer for the transaction (host product-account signer in-container). */
  readonly signer: PolkadotSigner;
  /**
   * Bounty id. A plain id string is hashed to bytes32 (keccak256); a value that
   * is already a 32-byte hex string is used as-is.
   */
  readonly bountyId: string;
  /** Funding amount in EVM/contract units (18 decimals for the native token). */
  readonly amount: bigint;
  /** Unix timestamp (seconds) after which the bounty can be reclaimed. */
  readonly expiresAt: number;
  /** Payment asset address; defaults to the native-token sentinel `address(0)`. */
  readonly paymentAsset?: string;
  /** Network to resolve the contract address from; defaults to the active one. */
  readonly network?: NetworkName;
}

/**
 * Derive the bytes32 bounty id. Already-hashed 32-byte hex ids pass through;
 * everything else is hashed with keccak256, matching the read-side hook.
 *
 * Exported so callers can record the exact on-chain bounty id (the same value
 * `fundBounty` submits) alongside the persisted campaign record.
 */
export function toBountyId(id: string): HexString {
  if (/^0x[0-9a-fA-F]{64}$/.test(id)) {
    return id as HexString;
  }
  return ethers.keccak256(ethers.toUtf8Bytes(id)) as HexString;
}

/**
 * Fund a bounty on-chain via Revive.
 *
 * ABI-encodes `fundBounty(bytes32,address,uint256,uint256)` and submits it as a
 * payable `Revive.call`, sending `amount` as the call value when funding with the
 * native token. Re-querying for confirmation is unnecessary — `fundBounty`
 * returns nothing.
 *
 * @throws if the contract is not deployed on the target network, or the dispatch
 *   fails / times out (fail-closed).
 */
export async function fundBounty(params: FundBountyParams): Promise<TransactionResult> {
  const {
    origin,
    signer,
    bountyId,
    amount,
    expiresAt,
    paymentAsset = NATIVE_ASSET,
    network,
  } = params;

  const contract = getContractAddress('bountyEscrow', network);
  if (contract === null) {
    throw new Error('BountyEscrow contract not deployed on this network');
  }

  const id = toBountyId(bountyId);
  // The ABI `amount_` arg is the contract-side `msg.value` comparison value, so
  // it stays in EVM 18-decimal units.
  const calldata = bountyEscrowInterface.encodeFunctionData('fundBounty', [
    id,
    paymentAsset,
    amount,
    BigInt(expiresAt),
  ]) as HexString;

  // The extrinsic `value` is the NATIVE balance (planck, 10 decimals), NOT the
  // 18-decimal EVM amount in the calldata. For native-asset funding, convert the
  // EVM amount to native planck via the chain's NativeToEthRatio (1e8 on Paseo);
  // for an ERC-20 payment asset the contract pulls tokens via allowance, so the
  // extrinsic carries no native value.
  let value = 0n;
  if (paymentAsset === NATIVE_ASSET) {
    const { nativeToEvmRatio } = await getAssetHubClient();
    value = nativeValueFromEvmAmount(amount, nativeToEvmRatio);
  }

  // Probe account-mapping with a side-effect-free VIEW (`paused()`), so a revert
  // of the payable `fundBounty` (e.g. duplicate id) is never misread as unmapped.
  const probeCalldata = bountyEscrowInterface.encodeFunctionData('paused', []) as HexString;

  logger.info('Funding bounty on-chain', 'fundBounty', {
    contract,
    bountyId: id,
    amount: amount.toString(),
    value: value.toString(),
    expiresAt,
  });

  return sendContractTx({
    contract: contract as HexString,
    calldata,
    probeCalldata,
    origin,
    signer,
    value,
  });
}
