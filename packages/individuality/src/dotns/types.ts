/**
 * DotNS Resolver Abstraction Types
 *
 * Capability-based interfaces for DotNS name resolution with:
 * - Explicit source policy (Host vs Chain priority)
 * - Separate entrypoints (host-only vs full chain access)
 * - Proper error semantics (absence vs failure)
 *
 * @license GPL-3.0
 */

import type { PolkadotAddress } from '@cocuyo/types';
import type { RegistrationRecord } from '../types';

// ============================================================================
// Result Types (Explicit Source & Errors)
// ============================================================================

/**
 * Result wrapper with provenance metadata.
 * Distinguishes absence (value: null) from failure (ok: false).
 */
export type ResolverResult<T> =
  | { ok: true; value: T; source: 'host' | 'chain'; fetchedAt: number }
  | { ok: false; error: ResolverError };

/**
 * Error types for resolver operations.
 * Each error code indicates a specific failure mode.
 */
export type ResolverError =
  | { code: 'host_unavailable'; message: string }
  | { code: 'chain_unavailable'; message: string }
  | { code: 'network_error'; message: string }
  | { code: 'invalid_input'; message: string; field: string }
  | { code: 'unsupported'; message: string };

/**
 * Eligibility result with specific failure reasons.
 * Used for registration eligibility checks.
 */
export type DotNsEligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: EligibilityFailureReason; message?: string };

/**
 * Specific reasons why registration is not eligible.
 */
export type EligibilityFailureReason =
  | 'invalid_alias'
  | 'alias_taken'
  | 'account_has_alias'
  | 'gateway_unavailable'
  | 'network_error';

// ============================================================================
// Capability-Based Interfaces
// ============================================================================

/**
 * Provides the current user's DotNS alias.
 * Implemented by host adapter or chain queries.
 */
export interface CurrentAliasProvider {
  /**
   * Get the current user's primary DotNS alias.
   * @returns Alias string, null if no alias, or error result
   */
  getCurrentAlias(): Promise<ResolverResult<string | null>>;

  /**
   * Subscribe to current alias changes.
   * Callback is invoked immediately with current value, then on changes.
   * @returns Unsubscribe function
   */
  subscribeCurrentAlias(callback: (result: ResolverResult<string | null>) => void): () => void;
}

/**
 * Directory lookups for any alias/account.
 * Always uses chain queries (Host API doesn't expose this).
 */
export interface DotNsDirectory {
  /**
   * Resolve an alias to its registration record.
   * Normalizes input before lookup.
   */
  resolveAlias(alias: string): Promise<ResolverResult<RegistrationRecord | null>>;

  /**
   * Get the alias registered by an account.
   */
  getAccountAlias(account: PolkadotAddress): Promise<ResolverResult<string | null>>;

  /**
   * Get the owner of a lite label.
   */
  getLiteLabelOwner(label: string): Promise<ResolverResult<PolkadotAddress | null>>;
}

/**
 * Registration eligibility checks.
 * Always uses chain queries.
 */
export interface DotNsRegistrationPolicy {
  /**
   * Check if an account can register a full-person name.
   * Returns detailed eligibility result with failure reason.
   */
  canRegister(account: PolkadotAddress, alias: string): Promise<DotNsEligibilityResult>;
}

// ============================================================================
// Host Adapter Interface
// ============================================================================

/**
 * Minimal adapter for Host API integration.
 * Implemented by consuming apps (P2P-Market, etc.)
 * @cocuyo/individuality does NOT depend on @novasamatech/host-api-wrapper
 */
export interface HostAliasAdapter {
  /** Get current user's primary alias from Host */
  getCurrentAlias(): Promise<string | null>;

  /** Subscribe to alias changes (optional - no polling if absent) */
  subscribeCurrentAlias?(callback: (alias: string | null) => void): () => void;

  /** Whether currently in hosted mode */
  isHosted(): boolean;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Source priority for alias resolution.
 * Controls which source is tried first and whether fallback is used.
 */
export type SourcePriority = 'host-first' | 'chain-first' | 'host-only' | 'chain-only';

// ============================================================================
// Re-exports from types.ts for convenience
// ============================================================================

export type { RegistrationRecord, PolkadotAddress };
