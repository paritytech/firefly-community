/**
 * Chain Client Wrapper
 *
 * Provides typed access to Polkadot chains via @polkadot-apps/chain-client.
 * Lazily initializes and caches the chain API.
 */

import {
  getChainAPI,
  type Environment,
  type PresetChains,
  type ChainClient,
} from '@polkadot-apps/chain-client';
import { createBulletinClient, createIndexManager, type IndexManager } from '@cocuyo/bulletin';

/** Cache entry with environment tracking - stores promise to prevent race conditions */
interface CacheEntry<T> {
  promise: Promise<T>;
  environment: Environment;
}

let apiCache: CacheEntry<ChainClient<PresetChains<Environment>>> | null = null;

/**
 * Get the current environment from configuration.
 * Defaults to 'paseo' for testnet development.
 */
function getEnvironment(): Environment {
  const env = process.env.NEXT_PUBLIC_CHAIN_ENVIRONMENT;
  if (env === 'polkadot' || env === 'kusama' || env === 'paseo') {
    return env;
  }
  return 'paseo';
}

/**
 * Get the typed chain API for the configured environment.
 *
 * Provides access to:
 * - assetHub: Asset Hub chain API (tokens, NFTs)
 * - bulletin: Bulletin Chain API (content storage)
 * - individuality: Individuality chain API (DIMs, personhood)
 *
 * @example
 * ```ts
 * const api = await getFireflyChainAPI();
 * const byteFee = await api.bulletin.query.TransactionStorage.ByteFee.getValue();
 * ```
 */
export async function getFireflyChainAPI(): Promise<ChainClient<PresetChains<Environment>>> {
  const env = getEnvironment();

  if (apiCache?.environment === env) {
    return apiCache.promise;
  }

  const promise = getChainAPI(env);
  apiCache = { promise, environment: env };

  return promise;
}

// Singleton index manager (uses @cocuyo/bulletin local storage)
let indexManagerInstance: IndexManager | null = null;

/**
 * Get the IndexManager for signal discovery.
 *
 * The IndexManager stores index records locally (localStorage in browser,
 * in-memory in SSR) to enable querying signals by topic without requiring
 * an off-chain indexer.
 *
 * Indexes are separate from content storage:
 * - Content (posts) → host preimage API (see lib/host/bulletin-storage) → Bulletin Chain
 * - Indexes → @cocuyo/bulletin → localStorage
 *
 * @example
 * ```ts
 * const indexManager = getIndexManager();
 * await indexManager.indexSignal({ cid, timestamp, author, topics });
 * const signals = await indexManager.getSignalsByTopic('politics', { limit: 10 });
 * ```
 */
export function getIndexManager(): IndexManager {
  if (!indexManagerInstance) {
    const localClient = createBulletinClient();
    indexManagerInstance = createIndexManager(localClient);
  }
  return indexManagerInstance;
}

// Re-export types for consumers
export type { Environment };
export type { IndexManager };
