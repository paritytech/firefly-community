/**
 * Host-Only DotNS Provider
 *
 * Provides DotNS alias resolution using only the Host API.
 * This module has NO chain dependencies and can be imported
 * without pulling in Polkadot chain client code.
 *
 * Usage:
 * ```ts
 * import { createHostAliasProvider, type HostAliasAdapter } from '@cocuyo/individuality/dotns/host';
 *
 * const adapter: HostAliasAdapter = {
 *   async getCurrentAlias() { ... },
 *   isHosted: () => isHosted(),
 * };
 *
 * const provider = createHostAliasProvider(adapter);
 * const result = await provider.getCurrentAlias();
 * ```
 *
 * @license GPL-3.0
 */

import type { CurrentAliasProvider, HostAliasAdapter, ResolverResult } from './types';

/** No-operation function for unsubscribe when adapter lacks subscription support */
function noop(): void {
  // Intentionally empty - no cleanup needed
}

// Re-export types for convenience
export type { CurrentAliasProvider, HostAliasAdapter, ResolverResult } from './types';
export type {
  ResolverError,
  DotNsEligibilityResult,
  EligibilityFailureReason,
  SourcePriority,
} from './types';

/**
 * Create a CurrentAliasProvider that uses only the Host API.
 *
 * This provider:
 * - Returns host_unavailable error if not in hosted mode
 * - Wraps adapter errors as network_error
 * - Uses adapter subscription if available
 * - Returns no-op unsubscribe if adapter lacks subscription support
 *
 * **Subscription behavior:** `subscribeCurrentAlias` only emits success
 * results. If the adapter encounters an error after subscription, callers
 * must re-invoke `getCurrentAlias()` to detect the failure.
 *
 * @param adapter - Host API adapter implemented by the consuming app
 * @returns CurrentAliasProvider that resolves aliases from Host
 */
export function createHostAliasProvider(adapter: HostAliasAdapter): CurrentAliasProvider {
  return {
    async getCurrentAlias(): Promise<ResolverResult<string | null>> {
      if (!adapter.isHosted()) {
        return {
          ok: false,
          error: { code: 'host_unavailable', message: 'Not in hosted mode' },
        };
      }

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
    },

    subscribeCurrentAlias(callback: (result: ResolverResult<string | null>) => void): () => void {
      // Emit current value immediately
      void this.getCurrentAlias().then(callback);

      // Use adapter subscription if available
      if (adapter.subscribeCurrentAlias !== undefined) {
        return adapter.subscribeCurrentAlias((alias) => {
          callback({
            ok: true,
            value: alias,
            source: 'host',
            fetchedAt: Date.now(),
          });
        });
      }

      // No subscription support - return no-op unsubscribe
      return noop;
    },
  };
}
