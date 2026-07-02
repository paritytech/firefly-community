/**
 * Bulletin Chain Client — Content-addressed storage for F-Network.
 */

import type { ContentHash } from '@cocuyo/types';
import { calculateCIDFromJSON } from './cid';

// --- Types ---

export type RecordType =
  | 'signal'
  | 'profile'
  | 'collective'
  | 'verification'
  | 'corroboration'
  | 'chain'
  | 'index';

export interface BulletinRecord<T = unknown> {
  readonly type: RecordType;
  readonly data: T;
  readonly version: number;
  readonly timestamp: number;
}

export interface ReadOptions {
  useCache?: boolean;
  maxCacheAge?: number;
}

export interface WriteOptions {
  pin?: boolean;
}

export interface BulletinClient {
  read<T>(cid: ContentHash | string, options?: ReadOptions): Promise<BulletinRecord<T> | null>;
  write<T>(record: BulletinRecord<T>, options?: WriteOptions): Promise<ContentHash>;
  exists(cid: ContentHash | string): Promise<boolean>;
}

// --- Chain Configuration ---

export const BULLETIN_ENDPOINTS = {
  PREVIEWNET: 'wss://previewnet.substrate.dev/bulletin',
  PASEO: 'wss://paseo-bulletin-next-rpc.polkadot.io',
  LOCAL: 'ws://localhost:9944',
} as const;

export const IPFS_GATEWAYS = {
  PREVIEWNET: 'https://previewnet.substrate.dev/ipfs/',
} as const;

export type BulletinEnvironment = keyof typeof BULLETIN_ENDPOINTS;

// --- Client Factory ---

export interface ClientOptions {
  environment?: BulletinEnvironment;
  inMemory?: boolean;
}

/**
 * Create a Bulletin Chain client.
 * Uses local storage for development, chain connection in Triangle host.
 */
export function createBulletinClient(options: ClientOptions = {}): BulletinClient {
  const { inMemory = false } = options;

  // For now, always use local client (chain integration in next phase)
  return createLocalClient(inMemory);
}

// --- Local Client (Development) ---

function createLocalClient(inMemory: boolean): BulletinClient {
  const store = new Map<string, string>();
  const PREFIX = 'bulletin:';

  const storage = {
    get: (key: string): string | null => {
      if (inMemory || typeof localStorage === 'undefined') {
        return store.get(key) ?? null;
      }
      return localStorage.getItem(key);
    },
    set: (key: string, value: string): void => {
      if (inMemory || typeof localStorage === 'undefined') {
        store.set(key, value);
      } else {
        localStorage.setItem(key, value);
      }
    },
  };

  return {
    read<T>(cid: ContentHash | string, options?: ReadOptions): Promise<BulletinRecord<T> | null> {
      const data = storage.get(`${PREFIX}${cid}`);
      if (data === null) return Promise.resolve(null);

      try {
        const { record, cachedAt } = JSON.parse(data) as {
          record: BulletinRecord<T>;
          cachedAt: number;
        };

        const maxAge = options?.maxCacheAge;
        if (maxAge !== undefined && maxAge > 0 && Date.now() - cachedAt > maxAge) {
          return Promise.resolve(null);
        }

        return Promise.resolve(record);
      } catch {
        return Promise.resolve(null);
      }
    },

    write<T>(record: BulletinRecord<T>): Promise<ContentHash> {
      const cid = calculateCIDFromJSON(record);
      storage.set(`${PREFIX}${cid}`, JSON.stringify({ record, cachedAt: Date.now() }));
      return Promise.resolve(cid);
    },

    exists(cid: ContentHash | string): Promise<boolean> {
      return Promise.resolve(storage.get(`${PREFIX}${cid}`) !== null);
    },
  };
}

// --- Helpers ---

export function createRecord<T>(type: RecordType, data: T, version = 1): BulletinRecord<T> {
  return { type, data, version, timestamp: Date.now() };
}
