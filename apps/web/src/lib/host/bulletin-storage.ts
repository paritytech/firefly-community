/**
 * Bulletin (content) storage via the host storage APIs.
 *
 * Mirrors the p2p-market reference so writes work the same way in the Polkadot
 * host:
 *
 * - **Write** goes through the host preimage API (`@novasamatech/host-api-wrapper`
 *   `preimageManager.submit`) — the host signs and submits the store extrinsic,
 *   so the app never submits over its own (light-client) connection, which
 *   times out. It is **fail-closed**: writes require the host container and there
 *   is no dev-signer fallback (that silent fallback previously masked chain-write
 *   failures as opaque timeouts).
 * - **Read** uses `@parity/product-sdk-cloud-storage` (`queryBytes`/`queryJson`,
 *   the host preimage lookup) with a development-only IPFS gateway fallback.
 *
 * CIDs are computed locally (Blake2b-256, raw CIDv1) via `@cocuyo/bulletin`,
 * which matches the host's preimage key derivation.
 */

import { preimageManager } from '@novasamatech/host-api-wrapper';
import {
  CloudStorageHostUnavailableError,
  queryBytes,
  queryJson,
} from '@parity/product-sdk-cloud-storage';
import { calculateCID } from '@cocuyo/bulletin';
import { resolveNetwork } from '@cocuyo/network-config';
import { createLogger } from '../logging';
import { isInContainer } from './detect';
import { requestBulletInAllowance, requestTransactionSubmit } from './permissions';

const logger = createLogger('BulletinStorage');

/** Timeout for the development-only IPFS gateway fallback. */
const GATEWAY_TIMEOUT_MS = 15_000;

function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/** Result of a host-storage upload. */
export interface HostUploadResult {
  readonly cid: string;
}

// The RFC-0010 BulletIn allowance + ChainSubmit permission are requested once
// per session before the first write. The host records them for the session.
let allowanceRequested = false;

async function ensureUploadAllowance(): Promise<void> {
  if (allowanceRequested) return;
  // Fail early on a denied allocation (matches p2p-market) rather than letting the preimage
  // submit fail opaquely later.
  const allocated = await requestBulletInAllowance();
  if (!allocated) {
    throw new Error(
      'Host denied the BulletIn storage allowance; the Bulletin write cannot proceed.'
    );
  }
  await requestTransactionSubmit();
  allowanceRequested = true;
}

/**
 * Upload raw bytes to the Bulletin Chain via the host preimage API.
 *
 * Fail-closed: throws when not running inside the host container. Writes must be
 * signed and submitted by the host — there is deliberately no local dev-signer
 * fallback.
 *
 * @param data - Raw bytes to store.
 * @returns The content CID (computed locally).
 */
export async function uploadBytesToHostStorage(data: Uint8Array): Promise<HostUploadResult> {
  if (!isInContainer()) {
    throw new Error(
      'Bulletin writes require the Polkadot host. Open this app inside Polkadot Desktop or Mobile.'
    );
  }

  await ensureUploadAllowance();

  const cid: string = calculateCID(data);
  await preimageManager.submit(data);

  logger.debug('Uploaded to Bulletin via host preimage', 'uploadBytesToHostStorage', { cid });
  return { cid };
}

/**
 * Fetch raw bytes from the Bulletin Chain by CID via the host preimage lookup.
 * Falls back to a direct IPFS gateway fetch only in development.
 *
 * @throws when the CID is empty, or when the host is unavailable in production.
 */
export async function fetchBytesFromHostStorage(cid: string): Promise<Uint8Array> {
  if (cid.trim().length === 0) {
    throw new Error('CID is required and must be a non-empty string');
  }

  try {
    return await queryBytes(cid);
  } catch (error) {
    if (!(error instanceof CloudStorageHostUnavailableError)) throw error;
    if (!isDevelopment()) {
      throw new Error(
        'Bulletin fetch failed: host preimage API unavailable and the gateway fallback is disabled in production.'
      );
    }
    logger.warn('DEV ONLY: using direct IPFS gateway fallback', 'fetchBytesFromHostStorage', {
      cid,
    });
    return fetchBytesFromGateway(cid);
  }
}

/**
 * Fetch and parse JSON from the Bulletin Chain by CID via the host preimage
 * lookup. Falls back to a direct IPFS gateway fetch only in development.
 *
 * @throws when the CID is empty, or when the host is unavailable in production.
 */
export async function fetchJsonFromHostStorage<T>(cid: string): Promise<T> {
  if (cid.trim().length === 0) {
    throw new Error('CID is required and must be a non-empty string');
  }

  try {
    return await queryJson<T>(cid);
  } catch (error) {
    if (!(error instanceof CloudStorageHostUnavailableError)) throw error;
    if (!isDevelopment()) {
      throw new Error(
        'Bulletin fetch failed: host preimage API unavailable and the gateway fallback is disabled in production.'
      );
    }
    logger.warn('DEV ONLY: using direct IPFS gateway fallback', 'fetchJsonFromHostStorage', {
      cid,
    });
    return fetchJsonFromGateway<T>(cid);
  }
}

function buildGatewayUrl(cid: string): string {
  const base = resolveNetwork(process.env).bulletin.ipfsGateway;
  return `${base}${cid}`;
}

async function fetchBytesFromGateway(cid: string): Promise<Uint8Array> {
  const response = await fetch(buildGatewayUrl(cid), {
    signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Gateway fetch failed: ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchJsonFromGateway<T>(cid: string): Promise<T> {
  const response = await fetch(buildGatewayUrl(cid), {
    signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Gateway fetch failed: ${response.status} ${response.statusText}`);
  }
  // Boundary parse: the caller declares the expected shape T (same contract as
  // queryJson<T> and the previous BulletinClient.fetchJson<T>).
  const body: unknown = await response.json();
  return body as T;
}
