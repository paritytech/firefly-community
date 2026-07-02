/**
 * @cocuyo/individuality/dotns
 *
 * DotNS Resolver Abstraction - Full exports
 *
 * Provides capability-based interfaces for DotNS name resolution with:
 * - Explicit source policy (Host vs Chain priority)
 * - Separate entrypoints (host-only vs full chain access)
 * - Proper error semantics (absence vs failure)
 *
 * Usage:
 * ```ts
 * // Full chain access (Cocuyo)
 * import {
 *   createDotNsDirectory,
 *   createCurrentAliasProvider,
 * } from '@cocuyo/individuality/dotns';
 *
 * // Host-only access (P2P-Market)
 * import { createHostAliasProvider } from '@cocuyo/individuality/dotns/host';
 * ```
 *
 * @license GPL-3.0
 */

// Types
export type {
  // Result types
  ResolverResult,
  ResolverError,
  DotNsEligibilityResult,
  EligibilityFailureReason,

  // Capability interfaces
  CurrentAliasProvider,
  DotNsDirectory,
  DotNsRegistrationPolicy,

  // Host adapter
  HostAliasAdapter,

  // Configuration
  SourcePriority,

  // Re-exports
  RegistrationRecord,
  PolkadotAddress,
} from './types';

// Host-only provider (no chain deps)
export { createHostAliasProvider } from './host';

// Chain directory (requires chain API)
export { createDotNsDirectory } from './directory';
export type { DotNsGatewayApi } from './directory';

// Composed provider (supports both)
export { createCurrentAliasProvider } from './current-alias';
export type { CurrentAliasOptions } from './current-alias';
