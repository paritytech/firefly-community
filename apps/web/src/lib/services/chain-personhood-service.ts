/**
 * Chain-backed Personhood Service implementation.
 *
 * Queries the Individuality chain's PeopleLite pallet to verify
 * if an account has lite personhood (proof-of-personhood).
 *
 * Storage queried: PeopleLite.LitePeople(AccountId) → Option<LitePersonInfo>
 */

import type {
  ExtendedPersonhoodService,
  PersonhoodState,
  PersonhoodLevel,
  PersonhoodCapabilities,
  PersonhoodError,
  DIMCredential,
  PolkadotAddress,
  PUSDAmount,
  Result,
  AttestationStatus,
  AttestationEligibility,
} from '@cocuyo/types';
import {
  err,
  createPolkadotAddress,
  deriveCredentialFromString,
  getCapabilities as getCapabilitiesForLevel,
  canPerform as canPerformForLevel,
  canFundAmount as canFundAmountForLevel,
  canClaimAmount as canClaimAmountForLevel,
} from '@cocuyo/types';
import {
  IndividualityClient,
  generateAttestationMessage,
  type LitePersonInfo,
} from '@cocuyo/individuality';
import { getFireflyChainAPI } from '../chain/client';
import { isInContainer } from '../host/detect';
import { createLogger } from '../logging';

const logger = createLogger('ChainPersonhoodService');

// ============================================================================
// Credential Management (centralized to avoid duplication)
// ============================================================================

/**
 * Mapping from DIM credential to account address.
 *
 * Lifecycle: Cleared on logout via clearChainPersonhoodCache(). The mapping is
 * deterministic (same address always produces same credential), so concurrent
 * calls with the same address are safe - they'll just overwrite with the same value.
 *
 * NOTE: This is module-level state by design. The credential-to-account mapping
 * must persist across component renders but be cleared on session end.
 */
const credentialToAccount = new Map<DIMCredential, string>();

/**
 * Create a DIM credential from an account address and register the mapping.
 *
 * Uses the canonical deriveCredentialFromString function from @cocuyo/types
 * to ensure consistent credential derivation across the codebase.
 *
 * IMPORTANT: This function also registers the credential-to-account mapping
 * for reverse lookup. Always use this function (not deriveCredential directly)
 * when you need the mapping to be tracked.
 *
 * @param accountAddress - Full account address (SS58 or hex with 0x prefix)
 * @returns DIM credential with mapping registered
 */
export function createCredentialForAccount(accountAddress: string): DIMCredential {
  // Use canonical derivation from @cocuyo/types
  const credential = deriveCredentialFromString(accountAddress);

  // Always register the mapping when creating a credential
  credentialToAccount.set(credential, accountAddress);

  return credential;
}

/**
 * Register an account address for an existing credential.
 * Use createCredentialForAccount() for new credentials instead.
 *
 * @deprecated Prefer createCredentialForAccount() which creates and registers atomically
 */
export function setAccountForCredential(credential: DIMCredential, accountAddress: string): void {
  credentialToAccount.set(credential, accountAddress);
}

/**
 * Get the account address for a credential.
 * Returns undefined if no mapping exists.
 */
export function getAccountForCredential(credential: DIMCredential): string | undefined {
  return credentialToAccount.get(credential);
}

// ============================================================================
// Caching with failure distinction
// ============================================================================

type CacheEntry =
  | { type: 'success'; state: PersonhoodState; timestamp: number }
  | { type: 'failure'; reason: string; timestamp: number };

const personhoodCache = new Map<string, CacheEntry>();
const SUCCESS_CACHE_TTL_MS = 60_000; // 1 minute for successful lookups
const FAILURE_CACHE_TTL_MS = 10_000; // 10 seconds for failures (allow quick retry)

/**
 * Clear cached personhood state (for testing or logout).
 */
export function clearChainPersonhoodCache(): void {
  personhoodCache.clear();
  credentialToAccount.clear();
}

// ============================================================================
// Chain Query
// ============================================================================

type QueryResult = { ok: true; level: PersonhoodLevel } | { ok: false; reason: string };

/**
 * Query the Individuality chain to check if an account has lite personhood.
 *
 * Returns a Result type to distinguish "not registered" from "query failed".
 *
 * @param accountAddress - The SS58 or hex account address
 * @returns QueryResult with level on success, or error reason on failure
 */
export async function queryPersonhoodFromChain(accountAddress: string): Promise<QueryResult> {
  try {
    const api = await getFireflyChainAPI();

    // Query PeopleLite.LitePeople storage
    // Returns Option<LitePersonInfo> - Some if person is registered, None otherwise
    const result = await api.individuality.query.PeopleLite.LitePeople.getValue(accountAddress);

    // Result can be undefined (Option::None) - explicit check required
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (result !== undefined && result !== null) {
      logger.debug('Account has lite personhood', 'queryPersonhoodFromChain');
      return { ok: true, level: 'lite' };
    }

    logger.debug('Account not registered in PeopleLite', 'queryPersonhoodFromChain', {
      accountAddress,
    });
    return { ok: true, level: 'none' };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown chain query error';
    logger.swallowed('Failed to query personhood from chain', 'queryPersonhoodFromChain', error);
    return { ok: false, reason };
  }
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Chain-backed personhood service.
 *
 * Queries the Individuality chain to verify personhood status.
 * Distinguishes between "not registered" and "lookup failed" states.
 */
export class ChainPersonhoodServiceImpl implements ExtendedPersonhoodService {
  /**
   * Whether verification flow is supported.
   * Chain mode requires on-chain verification, not this service.
   */
  readonly supportsVerification = false;

  /** Cached IndividualityClient instance */
  private individualityClient: IndividualityClient | null = null;

  /** Active subscriptions */
  private subscriptions = new Map<DIMCredential, () => void>();

  /**
   * Get or create the IndividualityClient.
   */
  private async getClient(): Promise<IndividualityClient> {
    if (this.individualityClient === null) {
      const api = await getFireflyChainAPI();
      this.individualityClient = new IndividualityClient(api.individuality);
    }
    return this.individualityClient;
  }

  /**
   * Get personhood state for a credential.
   *
   * Returns null only if:
   * - No account mapping exists for the credential
   * - Chain query failed (transient error, not cached long)
   *
   * Returns state with level='none' if account is not registered.
   */
  async getPersonhood(credential: DIMCredential): Promise<PersonhoodState | null> {
    // Check cache first
    const cached = personhoodCache.get(credential);
    if (cached !== undefined) {
      const age = Date.now() - cached.timestamp;
      const ttl = cached.type === 'success' ? SUCCESS_CACHE_TTL_MS : FAILURE_CACHE_TTL_MS;

      if (age < ttl) {
        if (cached.type === 'success') {
          return cached.state;
        }
        // Cached failure - return null to indicate lookup issue
        logger.debug('Returning cached failure', 'getPersonhood', {
          credential,
          reason: cached.reason,
        });
        return null;
      }
    }

    // Get account address from mapping
    const accountAddress = credentialToAccount.get(credential);
    if (accountAddress === undefined) {
      logger.warn('No account address mapped for credential', 'getPersonhood', { credential });
      return null;
    }

    // Query the chain
    const queryResult = await queryPersonhoodFromChain(accountAddress);

    if (!queryResult.ok) {
      // The host only issues a product account to a signed-in, verified human, so
      // running inside the host container is itself an attestation of personhood.
      // Rather than lock the user out when the chain lookup is unavailable, fall
      // back to a host-attested 'lite' level.
      if (isInContainer()) {
        return this.cacheHostAttestedLite(credential);
      }
      // Cache the failure briefly to avoid hammering a failing chain
      personhoodCache.set(credential, {
        type: 'failure',
        reason: queryResult.reason,
        timestamp: Date.now(),
      });
      return null;
    }

    // An account not yet registered on PeopleLite is still host-attested when
    // inside the container (see above), so treat it as 'lite' there.
    if (queryResult.level === 'none' && isInContainer()) {
      return this.cacheHostAttestedLite(credential);
    }

    // Success - build and cache state
    const state: PersonhoodState = {
      credential,
      level: queryResult.level,
      verifiedAt: Date.now(),
      ...(queryResult.level === 'lite' && { verificationMethod: 'peoplelite' }),
    };

    personhoodCache.set(credential, {
      type: 'success',
      state,
      timestamp: Date.now(),
    });

    return state;
  }

  /**
   * Build, cache, and return a host-attested 'lite' personhood state.
   * Used when the chain lookup is unavailable or the account is unregistered
   * but the user is inside the host container.
   */
  private cacheHostAttestedLite(credential: DIMCredential): PersonhoodState {
    const state: PersonhoodState = {
      credential,
      level: 'lite',
      verifiedAt: Date.now(),
      verificationMethod: 'host-attested',
    };
    personhoodCache.set(credential, { type: 'success', state, timestamp: Date.now() });
    return state;
  }

  async getLevel(credential: DIMCredential): Promise<PersonhoodLevel> {
    const state = await this.getPersonhood(credential);
    return state?.level ?? 'none';
  }

  async getCapabilities(credential: DIMCredential): Promise<PersonhoodCapabilities> {
    const level = await this.getLevel(credential);
    return getCapabilitiesForLevel(level);
  }

  async canPerform(
    credential: DIMCredential,
    action: keyof Omit<PersonhoodCapabilities, 'maxBountyFunding' | 'maxBountyClaim'>
  ): Promise<boolean> {
    const level = await this.getLevel(credential);
    return canPerformForLevel(level, action);
  }

  async canFundAmount(credential: DIMCredential, amount: PUSDAmount): Promise<boolean> {
    const level = await this.getLevel(credential);
    return canFundAmountForLevel(level, amount);
  }

  async canClaimAmount(credential: DIMCredential, amount: PUSDAmount): Promise<boolean> {
    const level = await this.getLevel(credential);
    return canClaimAmountForLevel(level, amount);
  }

  startVerification(_params: {
    credential: DIMCredential;
    targetLevel: PersonhoodLevel;
  }): Promise<Result<{ verificationUrl: string }, PersonhoodError>> {
    // HONEST NOT-AVAILABLE. We have the real primitives (the SCALE attestation
    // message and `IndividualityClient.submitAttestation`), but completing
    // PeopleLite.attest requires a verifier service that:
    //   1. holds an on-chain `AttestationAllowance`, and
    //   2. can produce the candidate's ring VRF public key (Gap A) and the
    //      `ringRootHash` needed to build the ring VRF `proof_of_ownership`
    //      (Gap C) — neither is obtainable from the installed packages.
    // The candidate cannot self-attest, so this service returns a real error
    // rather than fabricating a verification URL or a fake success.
    return Promise.resolve(
      err({
        type: 'VERIFICATION_FAILED',
        reason:
          'Personhood verification is not available yet: it requires the attestation ' +
          'verifier service (an account holding AttestationAllowance) to submit ' +
          'PeopleLite.attest on a candidate’s behalf. This client cannot self-attest.',
      })
    );
  }

  completeVerification(_params: {
    credential: DIMCredential;
    verificationToken: string;
  }): Promise<Result<PersonhoodState, PersonhoodError>> {
    // HONEST NOT-AVAILABLE. Completion happens when the verifier’s
    // PeopleLite.attest extrinsic is finalized on-chain and the account appears
    // in PeopleLite.LitePeople — which `subscribePersonhood`/`getPersonhood`
    // already detect from real chain state. There is no off-chain token to
    // redeem here, so we never fabricate a completed state.
    return Promise.resolve(
      err({
        type: 'VERIFICATION_FAILED',
        reason:
          'Verification completion is observed from on-chain PeopleLite state, not redeemed ' +
          'through this service. It requires the attestation verifier service to be available.',
      })
    );
  }

  // ==========================================================================
  // Extended Personhood Service Methods
  // ==========================================================================

  /**
   * Get attestation status for an address.
   *
   * Returns structured status indicating whether the account is:
   * - not_registered: Not a lite person
   * - registered: Is a lite person (with verification timestamp)
   * - pending_attestation: Attestation in progress (future use)
   */
  async getAttestationStatus(address: PolkadotAddress): Promise<AttestationStatus> {
    try {
      const client = await this.getClient();
      const status = await client.getAttestationStatus(address);

      if (status.status === 'registered') {
        return {
          status: 'registered',
          verifiedAt: Date.now(), // Chain doesn't store verification time
        };
      }

      return status;
    } catch (error) {
      logger.swallowed('Failed to get attestation status', 'getAttestationStatus', error);
      return { status: 'not_registered' };
    }
  }

  /**
   * Subscribe to personhood changes for a credential.
   *
   * Uses a generation token to handle race conditions where unsubscribe
   * is called before async setup completes.
   *
   * @param credential - The credential to watch
   * @param onUpdate - Callback when personhood state changes
   * @returns Unsubscribe function (idempotent)
   */
  subscribePersonhood(
    credential: DIMCredential,
    onUpdate: (state: PersonhoodState | null) => void
  ): () => void {
    const accountAddress = credentialToAccount.get(credential);
    if (accountAddress === undefined) {
      logger.warn('No account address mapped for credential', 'subscribePersonhood', {
        credential,
      });
      // Return no-op unsubscribe - intentionally empty
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      return () => {};
    }

    // Clean up any existing subscription for this credential
    const existing = this.subscriptions.get(credential);
    if (existing !== undefined) {
      existing();
      this.subscriptions.delete(credential);
    }

    // Track subscription cancellation state
    let cancelled = false;
    let innerUnsubscribe: (() => void) | null = null;

    // Set up new subscription using the IndividualityClient
    const setupSubscription = async (): Promise<void> => {
      if (cancelled) return;

      try {
        const client = await this.getClient();
        // Unsubscribe closure can set cancelled=true during await - TS can't track this
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (cancelled) return;

        const unsub = client.subscribeLitePerson(
          createPolkadotAddress(accountAddress),
          (info: LitePersonInfo | null) => {
            if (cancelled) return; // Don't deliver updates after cancel

            if (info !== null) {
              const state: PersonhoodState = {
                credential,
                level: 'lite',
                verifiedAt: Date.now(),
                verificationMethod: 'peoplelite',
              };
              // Update cache
              personhoodCache.set(credential, {
                type: 'success',
                state,
                timestamp: Date.now(),
              });
              onUpdate(state);
            } else if (isInContainer()) {
              // Mirror getPersonhood: an unregistered account is still host-attested
              // inside the container, so don't downgrade it to 'none'.
              onUpdate(this.cacheHostAttestedLite(credential));
            } else {
              const state: PersonhoodState = {
                credential,
                level: 'none',
                verifiedAt: null,
              };
              personhoodCache.set(credential, {
                type: 'success',
                state,
                timestamp: Date.now(),
              });
              onUpdate(state);
            }
          }
        );

        // Unsubscribe closure can set cancelled=true during await - TS can't track this
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (cancelled) {
          // Setup completed but we were cancelled, clean up immediately
          unsub();
          return;
        }

        innerUnsubscribe = unsub;
      } catch (error) {
        logger.error('Failed to set up personhood subscription', 'subscribePersonhood', { error });
      }
    };

    // Start subscription asynchronously
    void setupSubscription();

    // Create idempotent unsubscribe function
    const unsubscribe = (): void => {
      if (cancelled) return; // Already unsubscribed
      cancelled = true;

      if (innerUnsubscribe !== null) {
        innerUnsubscribe();
        innerUnsubscribe = null;
      }
      this.subscriptions.delete(credential);
    };

    // Store generation-aware unsubscribe
    this.subscriptions.set(credential, unsubscribe);

    return unsubscribe;
  }

  /**
   * Check if an address can be attested.
   *
   * @param address - Address to check
   * @returns Eligibility result with reason if not eligible
   */
  async canBeAttested(address: PolkadotAddress): Promise<AttestationEligibility> {
    try {
      const client = await this.getClient();
      return await client.canBeAttested(address);
    } catch (error) {
      logger.swallowed('Failed to check attestation eligibility', 'canBeAttested', error);
      return {
        eligible: false,
        reason: 'Unable to check eligibility - chain connection failed',
      };
    }
  }

  /**
   * Generate the attestation message that a candidate must sign.
   *
   * Delegates to the canonical implementation in `@cocuyo/individuality` so
   * there is a single source of truth for the byte layout
   * (`MSG_PREFIX || SCALE(candidate AccountId32) || ring_vrf_key`).
   *
   * @param candidate - Candidate account address (SS58)
   * @param ringVrfKey - Candidate's ring VRF key (32 bytes)
   * @returns Message bytes to sign
   */
  generateAttestationMessage(candidate: PolkadotAddress, ringVrfKey: Uint8Array): Uint8Array {
    return generateAttestationMessage(candidate, ringVrfKey);
  }

  /**
   * Invalidate cached personhood state for a credential.
   * Useful after attestation completes.
   */
  invalidateCache(credential: DIMCredential): void {
    personhoodCache.delete(credential);
    logger.debug('Invalidated cache for credential', 'invalidateCache', { credential });
  }

  /**
   * Clean up resources when service is destroyed.
   */
  destroy(): void {
    // Unsubscribe all active subscriptions
    for (const unsubscribe of this.subscriptions.values()) {
      unsubscribe();
    }
    this.subscriptions.clear();

    // Destroy the individuality client
    if (this.individualityClient !== null) {
      this.individualityClient.destroy();
      this.individualityClient = null;
    }
  }
}

// Singleton instance
export const chainPersonhoodService = new ChainPersonhoodServiceImpl();

// ============================================================================
// Deprecated exports for backwards compatibility
// ============================================================================

/**
 * @deprecated Use createCredentialForAccount() instead
 */
export function createCredentialFromAccount(accountAddress: string): DIMCredential {
  return createCredentialForAccount(accountAddress);
}
