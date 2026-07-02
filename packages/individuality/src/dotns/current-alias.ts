/**
 * Composed Current Alias Provider
 *
 * Provides flexible alias resolution with configurable source priority.
 * Supports Host-first with chain fallback, chain-only, host-only modes.
 *
 * Usage:
 * ```ts
 * import { createCurrentAliasProvider } from '@cocuyo/individuality/dotns';
 *
 * // Host-first with chain fallback
 * const provider = createCurrentAliasProvider({
 *   hostAdapter,
 *   chainApi,
 *   currentAccount: () => connectedAccount,
 *   priority: 'host-first',
 * });
 *
 * const result = await provider.getCurrentAlias();
 * if (result.ok) {
 *   console.log(`Alias: ${result.value}, Source: ${result.source}`);
 * }
 * ```
 *
 * @license GPL-3.0
 */

import type { PolkadotAddress } from '@cocuyo/types';
import type {
  CurrentAliasProvider,
  HostAliasAdapter,
  ResolverResult,
  SourcePriority,
} from './types';
import type { DotNsGatewayApi } from '../dotns-gateway';
import * as gateway from '../dotns-gateway';

/** No-operation function for unsubscribe when no subscription is available */
function noop(): void {
  // Intentionally empty - no cleanup needed
}

/**
 * Configuration options for the composed alias provider.
 */
export interface CurrentAliasOptions {
  /** Host API adapter (required for host-first or host-only modes) */
  hostAdapter?: HostAliasAdapter;

  /** Chain API (required for chain-first or chain-only modes) */
  chainApi?: DotNsGatewayApi;

  /** Function to get the current connected account (required for chain queries) */
  currentAccount?: () => PolkadotAddress | null;

  /** Source priority (default: 'host-first') */
  priority?: SourcePriority;
}

/**
 * Try to get alias from Host API.
 */
async function tryHost(adapter: HostAliasAdapter): Promise<ResolverResult<string | null>> {
  try {
    const alias = await adapter.getCurrentAlias();
    return {
      ok: true,
      value: alias,
      source: 'host',
      fetchedAt: Date.now(),
    };
  } catch (e) {
    return {
      ok: false,
      error: {
        code: 'network_error',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }
}

/**
 * Try to get alias from chain query.
 */
async function tryChain(
  api: DotNsGatewayApi,
  account: PolkadotAddress
): Promise<ResolverResult<string | null>> {
  try {
    const alias = await gateway.getAccountAlias(api, account);
    return {
      ok: true,
      value: alias,
      source: 'chain',
      fetchedAt: Date.now(),
    };
  } catch (e) {
    return {
      ok: false,
      error: {
        code: 'chain_unavailable',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }
}

/**
 * Check if host adapter is available and in hosted mode.
 */
function isHostAvailable(adapter: HostAliasAdapter | undefined): adapter is HostAliasAdapter {
  return adapter?.isHosted() === true;
}

/**
 * Check if chain API and account are available.
 */
function getChainAccount(
  api: DotNsGatewayApi | undefined,
  getCurrentAccount: (() => PolkadotAddress | null) | undefined
): PolkadotAddress | null {
  if (api === undefined || getCurrentAccount === undefined) {
    return null;
  }
  return getCurrentAccount();
}

/**
 * Create a CurrentAliasProvider with configurable source priority.
 *
 * Source priority modes:
 * - 'host-first': Try Host API first, fall back to chain on failure
 * - 'chain-first': Try chain first, fall back to Host on failure
 * - 'host-only': Only use Host API, no fallback
 * - 'chain-only': Only use chain, no fallback
 *
 * **Fallback semantics:** Fallback only occurs on *error*, not on absence.
 * If host returns `null` (user has no alias), that result is returned
 * immediately without querying chain. This is intentional: the primary
 * source is authoritative for "no alias" answers.
 *
 * **Subscription behavior:** `subscribeCurrentAlias` only emits success
 * results from the adapter. If the underlying source encounters an error
 * after subscription, callers must re-invoke `getCurrentAlias()` to
 * detect the failure. This matches typical reactive subscription patterns
 * where errors terminate or require explicit recovery.
 *
 * @param options - Configuration options
 * @returns CurrentAliasProvider with configured behavior
 */
export function createCurrentAliasProvider(options: CurrentAliasOptions): CurrentAliasProvider {
  const priority = options.priority ?? 'host-first';

  async function getCurrentAlias(): Promise<ResolverResult<string | null>> {
    switch (priority) {
      case 'host-only': {
        if (isHostAvailable(options.hostAdapter)) {
          return tryHost(options.hostAdapter);
        }
        return {
          ok: false,
          error: { code: 'host_unavailable', message: 'Not in hosted mode' },
        };
      }

      case 'chain-only': {
        const account = getChainAccount(options.chainApi, options.currentAccount);
        if (account !== null && options.chainApi !== undefined) {
          return tryChain(options.chainApi, account);
        }
        return {
          ok: false,
          error: {
            code: 'chain_unavailable',
            message:
              account === null
                ? 'No account connected for chain query'
                : 'Chain API not configured',
          },
        };
      }

      case 'host-first': {
        // Try host first
        if (isHostAvailable(options.hostAdapter)) {
          const result = await tryHost(options.hostAdapter);
          if (result.ok) {
            return result;
          }
          // Host failed, try chain fallback
        }

        // Fallback to chain
        const account = getChainAccount(options.chainApi, options.currentAccount);
        if (account !== null && options.chainApi !== undefined) {
          return tryChain(options.chainApi, account);
        }

        return {
          ok: false,
          error: { code: 'unsupported', message: 'No alias source configured' },
        };
      }

      case 'chain-first': {
        // Try chain first
        const account = getChainAccount(options.chainApi, options.currentAccount);
        if (account !== null && options.chainApi !== undefined) {
          const result = await tryChain(options.chainApi, account);
          if (result.ok) {
            return result;
          }
          // Chain failed, try host fallback
        }

        // Fallback to host
        if (isHostAvailable(options.hostAdapter)) {
          return tryHost(options.hostAdapter);
        }

        return {
          ok: false,
          error: { code: 'chain_unavailable', message: 'Chain query failed and no host fallback' },
        };
      }
    }
  }

  function subscribeCurrentAlias(
    callback: (result: ResolverResult<string | null>) => void
  ): () => void {
    // Emit current value immediately
    void getCurrentAlias().then(callback);

    // Use adapter subscription if available and host mode is relevant
    const useHostSubscription = priority === 'host-first' || priority === 'host-only';
    const adapter = options.hostAdapter;

    if (useHostSubscription && adapter?.subscribeCurrentAlias !== undefined) {
      return adapter.subscribeCurrentAlias((alias) => {
        callback({
          ok: true,
          value: alias,
          source: 'host',
          fetchedAt: Date.now(),
        });
      });
    }

    // No subscription support for chain-only or when adapter lacks subscription
    return noop;
  }

  return {
    getCurrentAlias,
    subscribeCurrentAlias,
  };
}
