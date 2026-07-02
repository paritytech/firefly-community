/**
 * Shared utilities for mock services.
 *
 * Provides common functionality to reduce code duplication:
 * - Wallet state management
 * - Pseudonym generation
 * - Pagination helpers
 * - Bulletin Chain upload with fallback
 */

import type { PolkadotSigner } from 'polkadot-api';
import type { PaginatedResult, Result, DIMCredential } from '@cocuyo/types';
import { ok, err, deriveCredentialFromString } from '@cocuyo/types';
import {
  uploadBytesToHostStorage,
  fetchBytesFromHostStorage,
  fetchJsonFromHostStorage,
} from '../host/bulletin-storage';
import { createLogger } from '../logging';

const logger = createLogger('MockServices');

// ============================================================
// Wallet State Management
// ============================================================

let connectedAddress: string | null = null;
let connectedSigner: PolkadotSigner | null = null;

/**
 * Set the connected wallet address.
 * Call this when wallet connects/disconnects.
 */
export function setConnectedWallet(address: string | null): void {
  connectedAddress = address;
  if (address === null) {
    connectedSigner = null;
  }
}

/**
 * Clear the connected wallet state.
 * Alias for setConnectedWallet(null) with clearer semantics.
 */
export function clearConnectedWallet(): void {
  connectedAddress = null;
  connectedSigner = null;
}

/**
 * Set the connected wallet signer.
 * Call this when wallet connects.
 */
export function setConnectedSigner(signer: PolkadotSigner | null): void {
  connectedSigner = signer;
}

/**
 * Get the currently connected wallet address.
 */
export function getConnectedWallet(): string | null {
  return connectedAddress;
}

/**
 * Get the currently connected wallet signer.
 */
export function getConnectedSigner(): PolkadotSigner | null {
  return connectedSigner;
}

/**
 * Check if a wallet is connected.
 */
export function isWalletConnected(): boolean {
  return connectedAddress !== null;
}

/**
 * Get a DIM credential for the connected wallet.
 *
 * Uses the canonical deriveCredentialFromString function to ensure
 * consistent credential derivation across the codebase.
 */
export function getConnectedCredential(): DIMCredential | null {
  if (connectedAddress === null) return null;
  return deriveCredentialFromString(connectedAddress);
}

/** Wallet address and derived DIM credential for the connected wallet. */
export interface ConnectedWallet {
  wallet: string;
  credential: DIMCredential;
}

/**
 * Guard that resolves the connected wallet and its derived DIM credential.
 *
 * Returns an error Result when no wallet is connected. The error message is
 * `Wallet not connected. Please connect ${action}.` — pass the action phrase
 * (e.g. `'to vote'`, `'your wallet to illuminate'`) so the message matches the
 * caller's context exactly.
 */
export function requireConnectedWallet(action: string): Result<ConnectedWallet, string> {
  const wallet = getConnectedWallet();
  const credential = getConnectedCredential();
  if (wallet === null || credential === null) {
    return err(`Wallet not connected. Please connect ${action}.`);
  }
  return ok({ wallet, credential });
}

// ============================================================
// ID Generation
// ============================================================

/**
 * Generate a unique ID of the form `${prefix}-${timestamp}-${random}`.
 *
 * @param prefix - Domain prefix (e.g. `'tx'`, `'gov-proposal'`).
 * @param randomLength - Number of random base-36 characters (default 7).
 */
export function generateId(prefix: string, randomLength = 7): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 2 + randomLength)}`;
}

// ============================================================
// Pseudonym Generation
// ============================================================

const ADJECTIVES = [
  'Swift',
  'Bright',
  'Silent',
  'Golden',
  'Crystal',
  'Shadow',
  'Thunder',
  'Cosmic',
  'Ember',
  'Frost',
  'Mystic',
  'Lunar',
  'Solar',
  'Wild',
  'Ancient',
];

const NOUNS = [
  'Firefly',
  'Phoenix',
  'Condor',
  'Jaguar',
  'Quetzal',
  'Orchid',
  'Ceiba',
  'Cacao',
  'Ocelot',
  'Toucan',
  'Macaw',
  'Iguana',
  'Tapir',
  'Manatee',
  'Harpy',
];

/**
 * Generate a consistent pseudonym from wallet address.
 * Uses first 8 hex characters to deterministically pick adjective + noun.
 */
export function generatePseudonym(address: string): string {
  const addrBytes = address.slice(2, 10);
  const adjIdx = parseInt(addrBytes.slice(0, 4), 16) % ADJECTIVES.length;
  const nounIdx = parseInt(addrBytes.slice(4, 8), 16) % NOUNS.length;

  return `${ADJECTIVES[adjIdx]} ${NOUNS[nounIdx]}`;
}

// ============================================================
// Pagination Helpers
// ============================================================

export interface PaginationParams {
  offset: number;
  limit: number;
}

/**
 * Apply pagination to an array of items.
 * Returns a PaginatedResult with items, total count, and hasMore flag.
 */
export function paginate<T>(items: T[], pagination: PaginationParams): PaginatedResult<T> {
  const total = items.length;
  const start = pagination.offset;
  const end = start + pagination.limit;
  const paginatedItems = items.slice(start, end);

  return {
    items: paginatedItems,
    total,
    hasMore: end < total,
  };
}

/**
 * Filter items by a string field matching a search term (case-insensitive).
 */
export function filterByString<T>(
  items: T[],
  getValue: (item: T) => string | undefined,
  searchTerm: string | undefined
): T[] {
  if (searchTerm === undefined) return items;
  const termLower = searchTerm.toLowerCase();
  return items.filter((item) => {
    const value = getValue(item);
    return value?.toLowerCase().includes(termLower) ?? false;
  });
}

/**
 * Filter items by topics array matching a search term (case-insensitive).
 */
export function filterByTopic<T>(
  items: T[],
  getTopics: (item: T) => readonly string[],
  topic: string | undefined
): T[] {
  if (topic === undefined) return items;
  const topicLower = topic.toLowerCase();
  return items.filter((item) => getTopics(item).some((t) => t.toLowerCase().includes(topicLower)));
}

// ============================================================
// Bulletin Chain Upload
// ============================================================

/** Track if we've requested transaction permission (avoids repeat prompts) */
export interface UploadResult {
  cid: string;
}

export interface PhotoUploadResult {
  cid: string;
  mimeType: string;
  size: number;
}

/**
 * Upload data to Bulletin Chain.
 * Returns the CID on success, or an error message on failure.
 * No silent fallback - callers should handle errors explicitly.
 */
export async function uploadToBulletin(data: unknown): Promise<Result<UploadResult, string>> {
  try {
    const jsonData = new TextEncoder().encode(JSON.stringify(data));
    // Host preimage write: the host signs and submits the store tx (see bulletin-storage).
    // Fail-closed — no dev-signer fallback over the app's own (light-client) connection.
    const result = await uploadBytesToHostStorage(jsonData);

    logger.debug('Uploaded to Bulletin Chain', 'uploadToBulletin', { cid: result.cid });
    return ok({ cid: result.cid });
  } catch (uploadError) {
    const message = uploadError instanceof Error ? uploadError.message : 'Bulletin upload failed';
    // Surfaced at error level (not swallowed): the failure is returned to the caller, so it must be
    // visible in production — a swallowed error only logs in dev and hid this from the host.
    logger.error('Bulletin upload failed', 'uploadToBulletin', uploadError);
    return err(message);
  }
}

/** Reason why fetchFromBulletin returned null */
export type FetchFailureReason = 'network_error' | 'not_found' | 'validation_failed';

/**
 * Fetch data from Bulletin Chain by CID with optional validation.
 * Returns null if fetch or validation fails.
 *
 * @param cid - Content identifier to fetch
 * @param validator - Optional function to validate/parse the fetched data
 * @param onError - Optional callback to receive the failure reason for debugging
 */
export async function fetchFromBulletin<T>(
  cid: string,
  validator?: (data: unknown) => T | null,
  onError?: (reason: FetchFailureReason, details?: unknown) => void
): Promise<T | null> {
  try {
    const data = await fetchJsonFromHostStorage<unknown>(cid);

    if (validator) {
      const validated = validator(data);
      if (validated === null) {
        logger.warn('Bulletin data validation failed', 'fetchFromBulletin', {
          cid,
          receivedKeys:
            data !== null && data !== undefined && typeof data === 'object'
              ? Object.keys(data)
              : typeof data,
        });
        onError?.('validation_failed', data);
        return null;
      }
      return validated;
    }

    return data as T;
  } catch (fetchError) {
    const isNotFound =
      fetchError instanceof Error &&
      (fetchError.message.includes('404') || fetchError.message.includes('not found'));
    const reason: FetchFailureReason = isNotFound ? 'not_found' : 'network_error';

    logger.swallowed('Bulletin fetch failed', 'fetchFromBulletin', fetchError, { cid, reason });
    onError?.(reason, fetchError);
    return null;
  }
}

/**
 * Upload a photo file to Bulletin Chain.
 * Returns the CID and metadata on success.
 */
export async function uploadPhotoToBulletin(
  file: File
): Promise<Result<PhotoUploadResult, string>> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    // Host preimage write (see uploadToBulletin / bulletin-storage).
    const result = await uploadBytesToHostStorage(bytes);

    logger.debug('Uploaded photo to Bulletin Chain', 'uploadPhotoToBulletin', {
      cid: result.cid,
      mimeType: file.type,
      size: file.size,
    });

    return ok({
      cid: result.cid,
      mimeType: file.type,
      size: file.size,
    });
  } catch (uploadError) {
    const message = uploadError instanceof Error ? uploadError.message : 'Photo upload failed';
    // Surfaced at error level (returned to the caller, not swallowed) — consistent with uploadToBulletin.
    logger.error('Photo upload failed', 'uploadPhotoToBulletin', uploadError);
    return err(message);
  }
}

/**
 * Fetch photo bytes from Bulletin Chain by CID.
 * Returns null if fetch fails.
 */
export async function fetchPhotoFromBulletin(cid: string): Promise<Uint8Array | null> {
  try {
    return await fetchBytesFromHostStorage(cid);
  } catch (fetchError) {
    logger.swallowed('Photo fetch failed', 'fetchPhotoFromBulletin', fetchError, { cid });
    return null;
  }
}

// ============================================================
// TTL Cache Utility
// ============================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * A Map-like cache with TTL (time-to-live) and maximum size.
 * Entries are automatically evicted when expired or when size exceeds max.
 */
export class TTLCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(options: { ttlMs: number; maxSize: number }) {
    this.ttlMs = options.ttlMs;
    this.maxSize = options.maxSize;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (entry === undefined) return undefined;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: K, value: V): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    // Clean expired entries first
    this.cleanExpired();
    return this.cache.size;
  }

  values(): V[] {
    this.cleanExpired();
    return Array.from(this.cache.values()).map((e) => e.value);
  }

  entries(): [K, V][] {
    this.cleanExpired();
    return Array.from(this.cache.entries()).map(([k, e]) => [k, e.value]);
  }

  private evictOldest(): void {
    // Remove expired entries first
    this.cleanExpired();

    // If still at capacity, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * A list-based cache with TTL and maximum size.
 * Useful for caching arrays of items (proposals, transactions, etc.)
 */
export class TTLListCache<T> {
  private items: Array<{ value: T; addedAt: number }> = [];
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(options: { ttlMs: number; maxSize: number }) {
    this.ttlMs = options.ttlMs;
    this.maxSize = options.maxSize;
  }

  push(item: T): void {
    this.cleanExpired();

    // Evict oldest if at capacity
    while (this.items.length >= this.maxSize) {
      this.items.shift();
    }

    this.items.push({ value: item, addedAt: Date.now() });
  }

  unshift(item: T): void {
    this.cleanExpired();

    // Evict oldest if at capacity
    while (this.items.length >= this.maxSize) {
      this.items.pop();
    }

    this.items.unshift({ value: item, addedAt: Date.now() });
  }

  getAll(): T[] {
    this.cleanExpired();
    return this.items.map((i) => i.value);
  }

  find(predicate: (item: T) => boolean): T | undefined {
    this.cleanExpired();
    const entry = this.items.find((i) => predicate(i.value));
    return entry?.value;
  }

  findIndex(predicate: (item: T) => boolean): number {
    this.cleanExpired();
    return this.items.findIndex((i) => predicate(i.value));
  }

  filter(predicate: (item: T) => boolean): T[] {
    this.cleanExpired();
    return this.items.filter((i) => predicate(i.value)).map((i) => i.value);
  }

  update(index: number, item: T): void {
    if (index >= 0 && index < this.items.length) {
      this.items[index] = { value: item, addedAt: Date.now() };
    }
  }

  remove(predicate: (item: T) => boolean): boolean {
    const index = this.findIndex(predicate);
    if (index !== -1) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }

  clear(): void {
    this.items = [];
  }

  get length(): number {
    this.cleanExpired();
    return this.items.length;
  }

  private cleanExpired(): void {
    const cutoff = Date.now() - this.ttlMs;
    this.items = this.items.filter((i) => i.addedAt > cutoff);
  }
}
