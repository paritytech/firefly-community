/**
 * Upload to Bulletin Chain.
 *
 * CID calculation works immediately. Actual chain upload requires
 * Triangle host environment with signed transactions.
 */

import type { ContentHash } from '@cocuyo/types';
import { calculateCID } from './cid';
import { IPFS_GATEWAYS, type BulletinEnvironment } from './client';

export interface UploadResult {
  cid: ContentHash;
  gatewayUrl: string | undefined;
}

export interface UploadOptions {
  environment?: BulletinEnvironment;
}

/**
 * Calculate CID for bytes (no chain interaction).
 * Use this to get content addresses before actual upload.
 */
export function prepareBulletinUpload(data: Uint8Array, options: UploadOptions = {}): UploadResult {
  const cid = calculateCID(data);
  const gateway = options.environment === 'PREVIEWNET' ? IPFS_GATEWAYS.PREVIEWNET : undefined;

  return {
    cid,
    gatewayUrl: gateway ? `${gateway}${cid}` : undefined,
  };
}

/**
 * Calculate CID for JSON data (no chain interaction).
 */
export function prepareBulletinJSONUpload(
  data: unknown,
  options: UploadOptions = {}
): UploadResult {
  const json = JSON.stringify(data);
  return prepareBulletinUpload(new TextEncoder().encode(json), options);
}

/**
 * Upload bytes to Bulletin Chain.
 *
 * NOTE: Full chain upload requires:
 * 1. Running in Triangle host
 * 2. User signed in with account
 * 3. Bulletin authorization set up
 *
 * For now, this calculates CID only. Use dotns CLI for actual uploads:
 * `dotns bulletin upload ./dist --parallel -m "$DOTNS_MNEMONIC"`
 */
export function uploadToBulletin(
  data: Uint8Array,
  options: UploadOptions = {}
): Promise<UploadResult> {
  // CID calculation works immediately
  // TODO: Chain upload via TransactionStorage.store when signer available
  return Promise.resolve(prepareBulletinUpload(data, options));
}

/**
 * Upload JSON to Bulletin Chain.
 */
export function uploadJSONToBulletin(
  data: unknown,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const json = JSON.stringify(data);
  return uploadToBulletin(new TextEncoder().encode(json), options);
}
