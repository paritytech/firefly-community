/**
 * CID (Content Identifier) calculation for Bulletin Chain
 *
 * Uses Blake2b-256 hash to generate CIDv1 content identifiers.
 * This is the same algorithm used by Bulletin Chain for content addressing.
 */

import { blake2b } from '@noble/hashes/blake2';
import { CID } from 'multiformats/cid';
import * as raw from 'multiformats/codecs/raw';
import type { MultihashDigest } from 'multiformats/hashes/interface';
import type { ContentHash } from '@cocuyo/types';
import { createContentHash } from '@cocuyo/types';

// Blake2b-256 multicodec identifier
const BLAKE2B_256_CODE = 0xb220;

/**
 * Encode a number as a varint (variable-length integer)
 */
function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = [];
  let num = value;
  while (num >= 0x80) {
    bytes.push((num & 0x7f) | 0x80);
    num >>= 7;
  }
  bytes.push(num & 0x7f);
  return new Uint8Array(bytes);
}

/**
 * Calculate CID (Content Identifier) for file bytes using Blake2b-256 hash.
 *
 * @param fileBytes - The file content as Uint8Array
 * @returns ContentHash (CIDv1 string wrapped in branded type)
 */
export function calculateCID(fileBytes: Uint8Array): ContentHash {
  // Hash with Blake2b-256 (32 bytes = 256 bits)
  const hash = blake2b(fileBytes, { dkLen: 32 });

  // Build multihash: <varint code><varint length><hash bytes>
  const codeBytes = encodeVarint(BLAKE2B_256_CODE);
  const lengthBytes = encodeVarint(hash.length);

  const multihashBytes = new Uint8Array(codeBytes.length + lengthBytes.length + hash.length);
  multihashBytes.set(codeBytes, 0);
  multihashBytes.set(lengthBytes, codeBytes.length);
  multihashBytes.set(hash, codeBytes.length + lengthBytes.length);

  // Create MultihashDigest for CID creation
  const digest: MultihashDigest = {
    code: BLAKE2B_256_CODE,
    size: hash.length,
    bytes: multihashBytes,
    digest: hash,
  };

  // Create CIDv1 with raw codec
  const cid = CID.createV1(raw.code, digest);
  return createContentHash(cid.toString());
}

/**
 * Calculate CID from a string (UTF-8 encoded).
 *
 * @param content - String content to hash
 * @returns ContentHash (CIDv1 string)
 */
export function calculateCIDFromString(content: string): ContentHash {
  const encoder = new TextEncoder();
  return calculateCID(encoder.encode(content));
}

/**
 * Calculate CID from JSON data.
 * The JSON is stringified deterministically before hashing.
 *
 * @param data - Any JSON-serializable data
 * @returns ContentHash (CIDv1 string)
 */
export function calculateCIDFromJSON(data: unknown): ContentHash {
  return calculateCIDFromString(JSON.stringify(data));
}

/**
 * Validate a CID string format.
 *
 * @param cidString - String to validate as CID
 * @returns true if valid CID format
 */
export function isValidCID(cidString: string): boolean {
  try {
    CID.parse(cidString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse a CID string into its components.
 *
 * @param cidString - CID string to parse
 * @returns Parsed CID object or null if invalid
 */
export function parseCID(cidString: string): CID | null {
  try {
    return CID.parse(cidString);
  } catch {
    return null;
  }
}
