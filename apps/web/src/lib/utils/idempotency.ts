/**
 * Idempotency Key Utilities
 *
 * Generates unique idempotency keys for operations that should not be duplicated
 * on retry. Pattern from t3rminal: (identity, timestamp, content_hash).
 *
 * Use cases:
 * - Signal/Post creation (illuminate)
 * - Corroboration submission
 * - Bounty claims
 * - Payment transfers
 *
 * NOTE: This module is client-only. All state is guarded by typeof window check.
 */

import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';

/**
 * Stable JSON stringify with deterministic key ordering.
 * Ensures the same object always produces the same string regardless
 * of property insertion order.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }

  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Convert content to a deterministic string for hashing.
 */
function contentToString(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  return stableStringify(content);
}

/**
 * Generate an idempotency key for a create operation.
 *
 * The key is deterministic based on:
 * - Identity (credential hash, wallet address, etc.)
 * - Content hash (SHA-256 of the content)
 *
 * Timestamp is NOT included in the hash to allow retries of the same content
 * within a reasonable window. The key uniquely identifies "this user creating
 * this exact content".
 *
 * Note: Uses stable JSON serialization to ensure consistent hashing regardless
 * of object property ordering.
 *
 * @param identity - User identifier (credential hash, wallet address)
 * @param content - Content to hash (will be JSON stringified if object)
 * @returns Idempotency key as hex string prefixed with "idem_"
 */
export function generateIdempotencyKey(identity: string, content: unknown): string {
  const contentString = contentToString(content);
  const combined = `${identity}::${contentString}`;
  const hash = sha256(new TextEncoder().encode(combined));
  return `idem_${bytesToHex(hash)}`;
}

// ============================================================================
// Operation Tracking (Client-Side Only)
// ============================================================================

type OperationStatus = 'pending' | 'completed' | 'failed';
interface OperationEntry {
  timestamp: number;
  status: OperationStatus;
}

/** Client-side operation tracking. Null on server. */
let recentOperations: Map<string, OperationEntry> | null = null;

/** Interval handle for cleanup */
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

/** Max age for operation tracking (10 minutes) */
const OPERATION_MAX_AGE_MS = 10 * 60 * 1000;

/** Cleanup interval (1 minute) */
const CLEANUP_INTERVAL_MS = 60 * 1000;

/**
 * Get the operations map, initializing if on client.
 * Returns null on server to prevent state leakage between requests.
 */
function getOperationsMap(): Map<string, OperationEntry> | null {
  if (typeof window === 'undefined') {
    return null;
  }
  recentOperations ??= new Map();
  return recentOperations;
}

/**
 * Start the cleanup interval if not already running.
 */
function ensureCleanupInterval(): void {
  if (cleanupIntervalId !== null || typeof window === 'undefined') {
    return;
  }

  cleanupIntervalId = setInterval(() => {
    const ops = getOperationsMap();
    if (ops === null) return;
    const now = Date.now();
    for (const [key, value] of ops) {
      if (now - value.timestamp > OPERATION_MAX_AGE_MS) {
        ops.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Result of attempting to start an operation.
 */
export type TryStartResult =
  | { started: true }
  | { started: false; reason: 'in_flight' | 'recently_completed' | 'server_side' };

/**
 * Atomically try to mark an operation as starting.
 *
 * This is atomic - it checks and sets in one operation to prevent race conditions.
 * Returns a result indicating whether the operation was started or why it wasn't.
 *
 * @param key - Idempotency key
 * @returns Result indicating success or failure reason
 */
export function tryStartOperation(key: string): TryStartResult {
  const ops = getOperationsMap();
  if (ops === null) {
    return { started: false, reason: 'server_side' };
  }

  const existing = ops.get(key);
  if (existing?.status === 'pending') {
    return { started: false, reason: 'in_flight' };
  }
  if (existing?.status === 'completed') {
    return { started: false, reason: 'recently_completed' };
  }

  // Atomic: set immediately after check
  ensureCleanupInterval();
  ops.set(key, { timestamp: Date.now(), status: 'pending' });
  return { started: true };
}

/**
 * Mark an operation as completed.
 *
 * @param key - Idempotency key
 */
export function markOperationCompleted(key: string): void {
  const ops = getOperationsMap();
  if (ops === null) return;
  ops.set(key, { timestamp: Date.now(), status: 'completed' });
}

/**
 * Mark an operation as failed.
 *
 * @param key - Idempotency key
 */
export function markOperationFailed(key: string): void {
  const ops = getOperationsMap();
  if (ops === null) return;
  ops.set(key, { timestamp: Date.now(), status: 'failed' });
}
