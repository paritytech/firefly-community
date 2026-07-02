/**
 * Storage Adapter Module
 *
 * Provides a unified async storage API that works both in Triangle host
 * (using hostLocalStorage) and standalone (using browser localStorage).
 */

import { hostLocalStorage } from '@novasamatech/host-api-wrapper';
import { isInContainer } from './detect';
import { createLogger } from '../logging';

const logger = createLogger('HostStorage');

/**
 * Prefix for all storage keys to avoid collisions.
 */
const STORAGE_PREFIX = 'cocuyo:';

/**
 * Read a value from storage.
 *
 * @param key - Storage key (will be prefixed)
 * @returns The parsed value or null if not found
 */
export async function read<T>(key: string): Promise<T | null> {
  const prefixedKey = STORAGE_PREFIX + key;

  try {
    if (isInContainer()) {
      const value: unknown = await hostLocalStorage.readJSON(prefixedKey);
      if (value === undefined || value === null) {
        return null;
      }
      return value as T;
    } else {
      const value = localStorage.getItem(prefixedKey);
      if (value === null || value === '') {
        return null;
      }
      return JSON.parse(value) as T;
    }
  } catch (readError) {
    logger.swallowed('Storage read failed', 'read', readError, { key });
    return null;
  }
}

/**
 * Write a value to storage.
 *
 * @param key - Storage key (will be prefixed)
 * @param value - Value to store (will be JSON stringified)
 */
export async function write(key: string, value: unknown): Promise<void> {
  const prefixedKey = STORAGE_PREFIX + key;

  try {
    if (isInContainer()) {
      await hostLocalStorage.writeJSON(prefixedKey, value);
    } else {
      localStorage.setItem(prefixedKey, JSON.stringify(value));
    }
  } catch (writeError) {
    logger.swallowed('Storage write failed', 'write', writeError, { key });
  }
}

/**
 * Clear a specific key from storage.
 *
 * @param key - Storage key (will be prefixed)
 */
export async function clear(key: string): Promise<void> {
  const prefixedKey = STORAGE_PREFIX + key;

  try {
    if (isInContainer()) {
      await hostLocalStorage.clear(prefixedKey);
    } else {
      localStorage.removeItem(prefixedKey);
    }
  } catch (clearError) {
    logger.swallowed('Storage clear failed', 'clear', clearError, { key });
  }
}

/**
 * Storage module for organized access.
 */
export const storage = {
  read,
  write,
  clear,
} as const;
