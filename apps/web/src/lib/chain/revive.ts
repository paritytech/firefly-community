/**
 * Revive EVM Contract Helpers
 *
 * Provides wrappers for calling Revive (pallet-revive / PolkaVM) EVM contracts
 * on Asset Hub. Revive is the EVM compatibility layer for Polkadot parachains.
 *
 * Key patterns (modeled on the proven p2p-market implementation):
 * - Read-only calls go through the `ReviveApi.call` runtime API (no transaction).
 * - State-changing calls submit a signed `Revive.call` extrinsic via the typed
 *   polkadot-api, ensuring the caller's account is mapped first.
 * - Gas is taken from a dry-run of the actual call (`ReviveApi.call` returns the
 *   required `weight_required` + `storage_deposit`); REVIVE_WEIGHT_LIMIT /
 *   REVIVE_STORAGE_DEPOSIT_LIMIT are the documented fail-closed fallback when the
 *   estimate is absent or zero.
 * - The extrinsic `value` is the NATIVE balance (planck, 10 decimals on Asset
 *   Hub), NOT the 18-decimal EVM amount embedded in the contract calldata.
 * - Contract return values are NOT available from the extrinsic; re-query via
 *   `ReviveApi.call` if an id is needed.
 * - All contract addresses are H160 (20-byte Ethereum-style) hex strings; the
 *   `dest` field of the typed `Revive.call` is a `SizedHex<20>` (hex string) and
 *   `data` is raw bytes (Uint8Array).
 *
 * The app and the generated descriptors are both polkadot-api 2.x (a clean
 * same-major boundary), so the typed `ReviveApi.call` / `Revive.call` access
 * resolves to concrete types — no `no-unsafe-*` ESLint suppressions are needed
 * here (unlike the older-papi boundary in p2p-market).
 */

import type { PolkadotSigner } from 'polkadot-api';
import { ethers } from 'ethers';
import { getAssetHubClient } from './asset-hub-provider';
import { ss58Encode } from '../utils/address';
import { createLogger } from '../logging';

const logger = createLogger('Revive');

// ============================================================
// Constants
// ============================================================

/**
 * Fallback gas weight limit for Revive contract calls. Used only when a dry-run
 * gas estimate is unavailable or zero (fail-closed). These are the proven
 * p2p-market Paseo values. The dry-run normally supplies the real weight.
 *
 * - ref_time: maximum computation time (picoseconds, 1e12 = 1 second)
 * - proof_size: maximum PoV size in bytes for parachain validation
 */
export const REVIVE_WEIGHT_LIMIT = {
  /** 50 billion picoseconds = 50ms of computation time */
  ref_time: BigInt('50000000000'),
  /** 1MB proof size — sufficient for multi-party escrow state proofs */
  proof_size: BigInt('1000000'),
} as const;

/**
 * Fallback storage deposit limit for Revive contract calls — the maximum
 * native-token amount (smallest unit) that can be deposited for new storage
 * created by the call. 10 billion = 1 PAS at 10 decimals. Used only when the
 * dry-run estimate is unavailable; the proven p2p-market Paseo fallback value.
 */
export const REVIVE_STORAGE_DEPOSIT_LIMIT = BigInt('10000000000');

/** The zero H160 address — treated as "not deployed". */
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Alice's SS58 address — always mapped on testnet, used as the origin for
 * read-only `ReviveApi.call` queries (which never modify state).
 */
const ALICE_SS58_ADDRESS = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

/** Max time to wait for a write transaction to finalize before failing closed. */
const SIGN_TIMEOUT_MS = 60_000;

// ============================================================
// Types
// ============================================================

export type HexString = `0x${string}`;

export interface CallContractParams {
  /** Contract address (H160) */
  contract: HexString;
  /** ABI-encoded function calldata */
  calldata: HexString;
  /** Value to send (in EVM/contract units) */
  value?: bigint;
}

export interface SendContractTxParams {
  /** Contract address (H160) */
  contract: HexString;
  /** ABI-encoded function calldata for the state-changing call. */
  calldata: HexString;
  /**
   * NATIVE value (planck, 10 decimals on Asset Hub) carried by the `Revive.call`
   * extrinsic. This is NOT the 18-decimal EVM amount embedded in `calldata`; the
   * caller must convert (see {@link nativeValueFromEvmAmount}). Defaults to 0.
   */
  value?: bigint;
  /**
   * Side-effect-free VIEW calldata used to probe whether the caller's account is
   * mapped. MUST be a `view`/`pure` call — reusing the mutating `calldata` here
   * misreads any legitimate revert (e.g. a duplicate id) as "unmapped" and fires
   * a spurious `map_account`. When omitted, falls back to `calldata` (legacy).
   */
  probeCalldata?: HexString;
  /**
   * Caller's SS58 address (origin), used for the mapping dry-run. When omitted,
   * it is derived from the signer's public key.
   */
  origin?: string;
  /** Signer for the transaction */
  signer: PolkadotSigner;
}

export interface TransactionResult {
  /** Transaction hash */
  txHash: HexString;
  /** Block hash where transaction was included */
  blockHash: HexString;
  /** Whether the transaction succeeded */
  success: boolean;
}

// ============================================================
// Address Helpers
// ============================================================

/**
 * Validate and normalize an Ethereum (H160) address to a checksummed hex string.
 *
 * The typed `Revive.call` `dest` field is a `SizedHex<20>` (a hex string), so we
 * return the validated `0x`-prefixed string rather than raw bytes. Validation
 * uses `ethers.getAddress`, which rejects malformed addresses and bad checksums.
 *
 * @param address Ethereum address (with or without 0x prefix)
 * @returns Checksummed `0x`-prefixed 20-byte address
 * @throws Error if the address format is invalid
 */
export function addressToH160(address: string): HexString {
  let validated: string;
  try {
    validated = ethers.getAddress(address);
  } catch {
    throw new Error(`Invalid contract address: ${address}`);
  }
  // `getAddress` guarantees a 0x-prefixed 40-hex-char string here.
  return validated as HexString;
}

// ============================================================
// Read Operations (ReviveApi.call runtime API)
// ============================================================

/**
 * Call a contract function (read-only, no state changes).
 *
 * This is the Revive equivalent of `eth_call`: it executes the contract code via
 * the `ReviveApi.call` runtime API and returns the ABI-encoded result without
 * submitting a transaction. Origin is Alice (always mapped on testnet).
 *
 * @param params Call parameters
 * @returns ABI-encoded return data
 * @throws if the contract is not deployed or the call reverts
 */
export async function callContract(params: CallContractParams): Promise<Uint8Array> {
  const { contract, calldata, value = 0n } = params;
  assertDeployed(contract);

  const { api } = await getAssetHubClient();

  logger.debug('Calling contract (read)', 'callContract', {
    contract,
    calldataLength: calldata.length,
    value: value.toString(),
  });

  const result = await api.apis.ReviveApi.call(
    ALICE_SS58_ADDRESS,
    addressToH160(contract),
    value,
    undefined,
    undefined,
    hexToBytes(calldata)
  );

  if (!result.result.success) {
    throw new Error(`Contract call failed: ${JSON.stringify(result.result.value)}`);
  }

  const data: Uint8Array = result.result.value.data;
  logger.debug('Contract call successful', 'callContract', {
    contract,
    returnLength: data.length,
  });
  return data;
}

// ============================================================
// Account Mapping
// ============================================================

/**
 * Map a Substrate account to its derived EVM address. Must be done before a
 * contract interaction from an unmapped account, otherwise `Revive.call`
 * dispatches an error. Resolves once the mapping is found in a best block,
 * failing closed on a dispatch error.
 */
export async function mapAccount(signer: PolkadotSigner): Promise<void> {
  const { api } = await getAssetHubClient();
  const call = api.tx.Revive.map_account();

  return await new Promise<void>((resolve, reject) => {
    let subscription: { unsubscribe: () => void } | null = null;

    subscription = call
      .signSubmitAndWatch(signer, { mortality: { mortal: true, period: 2048 } })
      .subscribe({
        next: (event: { type: string; found?: boolean; ok?: boolean; dispatchError?: unknown }) => {
          if (event.type === 'txBestBlocksState' && event.found === true) {
            subscription?.unsubscribe();
            if (event.ok === false) {
              const dispatchErr = 'dispatchError' in event ? event.dispatchError : 'Unknown';
              reject(new Error(`map_account failed: ${JSON.stringify(dispatchErr)}`));
              return;
            }
            resolve();
          }
        },
        error: (err: Error) => {
          subscription?.unsubscribe();
          reject(err);
        },
      });
  });
}

/**
 * Ensure the caller's account is mapped to its EVM address. Dry-runs a cheap
 * read (`ReviveApi.call` with the caller as origin); if it does not succeed the
 * account is unmapped, so we submit `map_account`.
 */
async function ensureMapped(
  origin: string,
  signer: PolkadotSigner,
  contract: HexString,
  probeCalldata: HexString
): Promise<void> {
  const { api } = await getAssetHubClient();

  const dryRun = await api.apis.ReviveApi.call(
    origin,
    addressToH160(contract),
    0n,
    undefined,
    undefined,
    hexToBytes(probeCalldata)
  );

  if (!dryRun.result.success) {
    logger.info('Caller not mapped; submitting map_account', 'ensureMapped', { origin });
    await mapAccount(signer);
  }
}

// ============================================================
// Write Operations (Revive.call extrinsic)
// ============================================================

/** A Revive weight (matches the runtime `Weight` struct). */
interface ReviveWeight {
  readonly ref_time: bigint;
  readonly proof_size: bigint;
}

/** Gas inputs to `Revive.call`, resolved from a dry-run or the fallbacks. */
interface ResolvedGas {
  readonly weightLimit: ReviveWeight;
  readonly storageDepositLimit: bigint;
}

/**
 * Dry-run the ACTUAL call via `ReviveApi.call` and consume the returned
 * `weight_required` (weight) and `storage_deposit` (the `Charge` amount) as the
 * extrinsic's gas limits. Falls back to the proven hardcoded constants when the
 * estimate is missing or zero (fail-closed). The probe is read-only.
 */
async function resolveGas(
  origin: string,
  contract: HexString,
  value: bigint,
  calldata: HexString
): Promise<ResolvedGas> {
  const fallback: ResolvedGas = {
    weightLimit: REVIVE_WEIGHT_LIMIT,
    storageDepositLimit: REVIVE_STORAGE_DEPOSIT_LIMIT,
  };

  try {
    const { api } = await getAssetHubClient();
    const dryRun = await api.apis.ReviveApi.call(
      origin,
      addressToH160(contract),
      value,
      undefined,
      undefined,
      hexToBytes(calldata)
    );

    // weight_required is the weight the call actually needs; storage_deposit is
    // an enum ({ type: 'Charge' | 'Refund', value: bigint }) — only a Charge
    // implies a positive limit, a Refund means no new storage is paid for.
    const { ref_time: refTime, proof_size: proofSize } = dryRun.weight_required;
    const deposit = dryRun.storage_deposit;
    const depositCharge = deposit.type === 'Charge' ? deposit.value : 0n;

    // Fall back if the estimate is absent or zero (fail-closed).
    if (refTime <= 0n || proofSize <= 0n) {
      logger.warn('Dry-run weight estimate empty; using fallback gas', 'resolveGas', {
        contract,
        refTime: refTime.toString(),
        proofSize: proofSize.toString(),
      });
      return fallback;
    }

    return {
      weightLimit: { ref_time: refTime, proof_size: proofSize },
      // A zero/refund deposit still needs a non-zero limit headroom for any
      // storage the on-chain execution decides to create, so fall back when the
      // estimate yields nothing.
      storageDepositLimit: depositCharge > 0n ? depositCharge : REVIVE_STORAGE_DEPOSIT_LIMIT,
    };
  } catch (error) {
    logger.warn('Gas dry-run failed; using fallback gas', 'resolveGas', { contract, error });
    return fallback;
  }
}

/**
 * Send a state-changing transaction to a contract.
 *
 * Submits a signed `Revive.call` extrinsic that modifies contract state. The
 * caller's account is mapped first if needed. FAILS CLOSED: any dispatch error
 * or a finalization timeout rejects rather than reporting a fake success.
 *
 * Gas is taken from a dry-run of the actual call (`weight_required` /
 * `storage_deposit`), with REVIVE_WEIGHT_LIMIT / REVIVE_STORAGE_DEPOSIT_LIMIT as
 * the fail-closed fallback. The extrinsic `value` is the NATIVE planck amount,
 * not the EVM-18-decimal amount inside `calldata`. Contract return values are
 * not available from the extrinsic — re-query with {@link callContract} if you
 * need a returned id.
 *
 * @param params Transaction parameters
 * @returns Transaction result with hash, block hash, and success status
 * @throws if the contract is not deployed, the dispatch fails, or it times out
 */
export async function sendContractTx(params: SendContractTxParams): Promise<TransactionResult> {
  const { contract, calldata, signer, value = 0n } = params;
  assertDeployed(contract);

  // Derive the origin SS58 from the signer when not supplied, so the mapping
  // dry-run always has a real caller address.
  const origin = params.origin ?? ss58Encode(signer.publicKey);

  const { api } = await getAssetHubClient();

  logger.info('Sending contract transaction', 'sendContractTx', {
    contract,
    calldataLength: calldata.length,
    value: value.toString(),
  });

  // Ensure the caller is mapped. Probe with a side-effect-free VIEW call — never
  // the mutating calldata, whose legitimate reverts would be misread as unmapped.
  const probeCalldata = params.probeCalldata ?? calldata;
  await ensureMapped(origin, signer, contract, probeCalldata);

  // Estimate gas from a dry-run of the real call; fall back to the constants.
  const { weightLimit, storageDepositLimit } = await resolveGas(origin, contract, value, calldata);

  const tx = api.tx.Revive.call({
    dest: addressToH160(contract),
    value,
    weight_limit: weightLimit,
    storage_deposit_limit: storageDepositLimit,
    data: hexToBytes(calldata),
  });

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error('Transaction signing timed out. Please try again.'));
    }, SIGN_TIMEOUT_MS);
  });

  try {
    const result: {
      ok?: boolean;
      dispatchError?: unknown;
      txHash: string;
      block: { hash: string };
    } = await Promise.race([
      tx.signAndSubmit(signer, { mortality: { mortal: true, period: 2048 } }),
      timeout,
    ]);

    if (result.dispatchError !== undefined && result.dispatchError !== null) {
      logger.error('Contract transaction dispatch failed', 'sendContractTx', {
        contract,
        dispatchError: result.dispatchError,
      });
      throw new Error(`Transaction failed: ${JSON.stringify(result.dispatchError)}`);
    }

    logger.info('Contract transaction finalized', 'sendContractTx', {
      contract,
      txHash: result.txHash,
    });

    return {
      txHash: asHex(result.txHash),
      blockHash: asHex(result.block.hash),
      success: true,
    };
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Throw if a contract address is unset or the zero address (fail-closed).
 */
function assertDeployed(contract: string): void {
  if (contract === '' || contract.toLowerCase() === ZERO_ADDRESS) {
    throw new Error('Contract not deployed');
  }
}

/**
 * Normalize a chain-returned hash string to the local `0x`-prefixed HexString.
 * polkadot-api returns hashes already 0x-prefixed; prefix defensively otherwise.
 */
function asHex(value: string): HexString {
  return (value.startsWith('0x') ? value : `0x${value}`) as HexString;
}

/**
 * Convert a hex string to Uint8Array.
 */
export function hexToBytes(hex: HexString): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string.
 */
export function bytesToHex(bytes: Uint8Array): HexString {
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Validate an H160 address.
 */
export function isValidH160(address: string): address is HexString {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
