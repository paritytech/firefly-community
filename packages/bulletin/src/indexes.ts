/**
 * Index management for Bulletin Chain.
 *
 * Since Bulletin is content-addressed (no queries), we use index records
 * to enable discovery. Indexes are special records that aggregate CIDs.
 */

import type { ContentHash, DIMCredential } from '@cocuyo/types';
import type { BulletinClient } from './client';
import { createRecord } from './client';

/**
 * Entry in a signal index.
 */
export interface SignalIndexEntry {
  /** CID of the signal */
  readonly cid: ContentHash;
  /** When the signal was created */
  readonly timestamp: number;
  /** Author's credential hash */
  readonly author: DIMCredential;
  /** Topics for filtering */
  readonly topics: readonly string[];
  /** Location name if available */
  readonly location?: string;
}

/**
 * Index of signals by topic.
 */
export interface SignalIndex {
  /** The topic this index covers */
  readonly topic: string;
  /** Signal entries, newest first */
  readonly signals: readonly SignalIndexEntry[];
  /** When this index was last updated */
  readonly updatedAt: number;
}

/**
 * Entry in a collective index.
 */
export interface CollectiveIndexEntry {
  /** CID of the collective */
  readonly cid: ContentHash;
  /** Collective name */
  readonly name: string;
  /** Member count */
  readonly memberCount: number;
  /** Reputation score */
  readonly reputation: number;
  /** Topics covered */
  readonly topics: readonly string[];
}

/**
 * Global index of all collectives.
 */
export interface CollectiveIndex {
  /** All collectives */
  readonly collectives: readonly CollectiveIndexEntry[];
  /** When this index was last updated */
  readonly updatedAt: number;
}

/**
 * User-specific index (controlled by the user).
 */
export interface UserIndex {
  /** User's credential hash */
  readonly credential: DIMCredential;
  /** CIDs of user's signals */
  readonly signals: readonly ContentHash[];
  /** CIDs of user's corroborations */
  readonly corroborations: readonly ContentHash[];
  /** Collective IDs user belongs to */
  readonly collectives: readonly ContentHash[];
  /** Credentials user follows */
  readonly following: readonly DIMCredential[];
  /** When this index was last updated */
  readonly updatedAt: number;
}

/**
 * Index manager for F-Network data discovery.
 */
export interface IndexManager {
  /**
   * Get signals by topic.
   */
  getSignalsByTopic(
    topic: string,
    options?: { limit?: number; before?: number }
  ): Promise<readonly SignalIndexEntry[]>;

  /**
   * Get all collectives.
   */
  getCollectives(): Promise<readonly CollectiveIndexEntry[]>;

  /**
   * Get user's index.
   */
  getUserIndex(credential: DIMCredential): Promise<UserIndex | null>;

  /**
   * Add a signal to indexes.
   */
  indexSignal(entry: SignalIndexEntry): Promise<void>;

  /**
   * Add a collective to the index.
   */
  indexCollective(entry: CollectiveIndexEntry): Promise<void>;

  /**
   * Update user's index.
   */
  updateUserIndex(credential: DIMCredential, update: Partial<UserIndex>): Promise<void>;
}

/**
 * Create an index manager.
 */
export function createIndexManager(client: BulletinClient): IndexManager {
  // Index storage keys
  const SIGNAL_INDEX_PREFIX = 'index:signals:';
  const COLLECTIVE_INDEX_KEY = 'index:collectives';
  const USER_INDEX_PREFIX = 'index:user:';

  // In-memory caches
  const signalIndexCache = new Map<string, SignalIndex>();
  // Note: collectiveIndexCache not used yet, will be added when caching is implemented
  const userIndexCache = new Map<string, UserIndex>();

  return {
    async getSignalsByTopic(
      topic: string,
      options?: { limit?: number; before?: number }
    ): Promise<readonly SignalIndexEntry[]> {
      // Check cache
      let index = signalIndexCache.get(topic);

      if (!index) {
        // Try to load from storage
        const record = await client.read<SignalIndex>(`${SIGNAL_INDEX_PREFIX}${topic}`);
        if (record) {
          index = record.data;
          signalIndexCache.set(topic, index);
        }
      }

      if (!index) {
        return [];
      }

      let signals = index.signals;

      // Filter by before timestamp
      const beforeTs = options?.before;
      if (beforeTs !== undefined && beforeTs > 0) {
        signals = signals.filter((s) => s.timestamp < beforeTs);
      }

      // Apply limit
      const limit = options?.limit;
      if (limit !== undefined && limit > 0) {
        signals = signals.slice(0, limit);
      }

      return signals;
    },

    async getCollectives(): Promise<readonly CollectiveIndexEntry[]> {
      // Try to load from storage
      const record = await client.read<CollectiveIndex>(COLLECTIVE_INDEX_KEY);
      if (record) {
        return record.data.collectives;
      }
      return [];
    },

    async getUserIndex(credential: DIMCredential): Promise<UserIndex | null> {
      // Check cache
      const cached = userIndexCache.get(credential);
      if (cached) return cached;

      // Try to load from storage
      const record = await client.read<UserIndex>(`${USER_INDEX_PREFIX}${credential}`);
      if (record) {
        userIndexCache.set(credential, record.data);
        return record.data;
      }

      return null;
    },

    async indexSignal(entry: SignalIndexEntry): Promise<void> {
      // Update each topic index
      for (const topic of entry.topics) {
        const key = `${SIGNAL_INDEX_PREFIX}${topic}`;
        let index = signalIndexCache.get(topic);

        if (!index) {
          const record = await client.read<SignalIndex>(key);
          index = record?.data ?? {
            topic,
            signals: [],
            updatedAt: Date.now(),
          };
        }

        // Add new entry at the beginning (newest first)
        const updatedIndex: SignalIndex = {
          topic,
          signals: [entry, ...index.signals].slice(0, 1000), // Keep last 1000
          updatedAt: Date.now(),
        };

        // Save to storage
        await client.write(createRecord('index', updatedIndex));
        signalIndexCache.set(topic, updatedIndex);
      }
    },

    async indexCollective(entry: CollectiveIndexEntry): Promise<void> {
      // Load current index
      const record = await client.read<CollectiveIndex>(COLLECTIVE_INDEX_KEY);
      const current = record?.data ?? {
        collectives: [],
        updatedAt: Date.now(),
      };

      // Check if already exists (update) or new
      const existingIndex = current.collectives.findIndex((c) => c.cid === entry.cid);

      let collectives: readonly CollectiveIndexEntry[];
      if (existingIndex >= 0) {
        // Update existing
        collectives = [
          ...current.collectives.slice(0, existingIndex),
          entry,
          ...current.collectives.slice(existingIndex + 1),
        ];
      } else {
        // Add new
        collectives = [...current.collectives, entry];
      }

      const updatedIndex: CollectiveIndex = {
        collectives,
        updatedAt: Date.now(),
      };

      await client.write(createRecord('index', updatedIndex));
    },

    async updateUserIndex(credential: DIMCredential, update: Partial<UserIndex>): Promise<void> {
      const key = `${USER_INDEX_PREFIX}${credential}`;

      // Load current
      const record = await client.read<UserIndex>(key);
      const current = record?.data ?? {
        credential,
        signals: [],
        corroborations: [],
        collectives: [],
        following: [],
        updatedAt: Date.now(),
      };

      // Merge update
      const updated: UserIndex = {
        ...current,
        ...update,
        credential, // Ensure credential is always correct
        updatedAt: Date.now(),
      };

      await client.write(createRecord('index', updated));
      userIndexCache.set(credential, updated);
    },
  };
}
