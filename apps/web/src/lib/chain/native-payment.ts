/**
 * Native PAS Payment
 *
 * Submits a REAL native-token (PAS, the Paseo Asset Hub native asset, 10 decimals)
 * balance transfer via PAPI. This is the first genuine signed-extrinsic submission
 * path in the app — every other "chain" path (Revive contracts, the pUSD payment
 * service) is a placeholder mock. See the `payments-are-all-simulated` note.
 *
 * The transfer is submitted through the host-routed Asset Hub client
 * (`getFireflyChainAPI().assetHub`), so inside the Triangle host the host signs
 * and submits via its own transport. It FAILS CLOSED: any submission error,
 * dispatch error, or timeout rejects rather than reporting a fake success.
 */

import type { PolkadotSigner } from 'polkadot-api';
import { getFireflyChainAPI } from './client';
import { createLogger } from '../logging';

const logger = createLogger('NativePayment');

/** Native PAS has 10 decimals (Asset Hub native asset). */
export const PAS_DECIMALS = 10;

/** pUSD amounts are tracked with 6 decimals; PAS native uses 10. */
const PUSD_DECIMALS = 6;

/**
 * Convert a pUSD-denominated amount (6-decimal planck) to native PAS planck
 * (10 decimals) at a 1:1 unit rate. This is the demo convention — paying the
 * same numeric amount in PAS rather than pUSD — not an FX conversion.
 */
export function pusdUnitsToPasPlanck(pusdUnits: bigint): bigint {
  return pusdUnits * 10n ** BigInt(PAS_DECIMALS - PUSD_DECIMALS);
}

/** Default time to wait for finalization before failing closed. */
const DEFAULT_TIMEOUT_MS = 60_000;

export interface NativeTransferParams {
  /** Recipient SS58 address. */
  readonly to: string;
  /** Amount in native PAS planck (10 decimals). Must be > 0. */
  readonly amountPlanck: bigint;
  /** Signer for the sending account (host product-account signer in-container). */
  readonly signer: PolkadotSigner;
  /** Override the finalization timeout (ms). */
  readonly timeoutMs?: number;
}

export interface NativeTransferResult {
  /** Finalized transaction hash. */
  readonly txHash: string;
  /** Hash of the block the transfer was finalized in. */
  readonly blockHash: string;
}

/**
 * Submit a native PAS transfer and resolve once it is finalized.
 *
 * @throws if the amount is non-positive, the dispatch fails, or finalization
 *   does not complete within the timeout. Never resolves on failure.
 */
export async function transferNativePAS(
  params: NativeTransferParams
): Promise<NativeTransferResult> {
  const { to, amountPlanck, signer, timeoutMs = DEFAULT_TIMEOUT_MS } = params;

  if (amountPlanck <= 0n) {
    throw new Error('Transfer amount must be greater than zero');
  }

  const api = await getFireflyChainAPI();

  // `transfer_keep_alive` keeps the sender above the existential deposit, matching
  // the safer default used across the Polkadot ecosystem.
  //
  // `dest` is the MultiAddress.Id variant written as a plain structural enum
  // value rather than via polkadot-api's `Enum()` helper. The app resolves
  // polkadot-api to 2.x while chain-client's typed API is built against 1.x, so
  // we keep only plain JS values (string, bigint) crossing that version boundary
  // and never pass a runtime object from a different polkadot-api major.
  const tx = api.assetHub.tx.Balances.transfer_keep_alive({
    dest: { type: 'Id', value: to },
    value: amountPlanck,
  });

  logger.info('Submitting native PAS transfer', 'transferNativePAS', {
    amountPlanck: amountPlanck.toString(),
  });

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Native PAS transfer timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([tx.signAndSubmit(signer), timeout]);

    if (!result.ok) {
      logger.error('Native PAS transfer dispatch failed', 'transferNativePAS', {
        dispatchError: result.dispatchError,
      });
      throw new Error('Native PAS transfer failed on chain');
    }

    return { txHash: result.txHash, blockHash: result.block.hash };
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Read an account's free native PAS balance (planck, 10 decimals).
 * Returns 0n if the account has no on-chain record.
 */
export async function getNativeBalance(address: string): Promise<bigint> {
  const api = await getFireflyChainAPI();
  const account = await api.assetHub.query.System.Account.getValue(address);
  return account.data.free;
}
