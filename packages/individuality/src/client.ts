/**
 * IndividualityClient - High-level client for Individuality pallets.
 *
 * Provides a typed interface for interacting with the PeopleLite pallet
 * on the Individuality chain. This is the main entry point for applications
 * that need to verify personhood or manage aliases.
 *
 * Usage:
 * ```ts
 * const api = await getFireflyChainAPI();
 * const client = new IndividualityClient(api.individuality);
 *
 * // Check if account is registered
 * const info = await client.getLitePerson(address);
 *
 * // Subscribe to personhood changes
 * const unsubscribe = client.subscribeLitePerson(address, (info) => {
 *   console.log('Personhood updated:', info);
 * });
 * ```
 *
 * @license GPL-3.0
 */

import type { PolkadotAddress, Result } from '@cocuyo/types';
import { ok, err } from '@cocuyo/types';
import { accountIdBytes } from '@polkadot-apps/address';
import type {
  LitePersonInfo,
  ContextualAlias,
  RevisedContextualAlias,
  AttestationStatus,
  AttestationAllowance,
  AttestationEligibility,
  AttestationParams,
  ConsumerRegistrationParams,
} from './types';
import type { PeopleLiteApi } from './people-lite';
import {
  getLitePerson,
  getAttestationAllowance as getPalletAttestationAllowance,
  getAccountAlias,
  getAliasAccount,
  isLitePerson,
  canBeAttested as checkCanBeAttested,
} from './people-lite';
import { MSG_PREFIX } from './types';

// ============================================================================
// Client Interface
// ============================================================================

/**
 * Subscription callback for personhood changes.
 */
export type PersonhoodCallback = (info: LitePersonInfo | null) => void;

/**
 * Unsubscribe function returned by subscribe methods.
 */
export type Unsubscribe = () => void;

// ============================================================================
// Attestation Submission Types
// ============================================================================

/**
 * Structural result of a finalized polkadot-api `signAndSubmit`.
 *
 * We model only the fields we read so that this package does not need a direct
 * `polkadot-api` dependency. The app's typed `signAndSubmit` result is
 * structurally compatible. Crossing the package boundary we touch only plain
 * values (`boolean`, `string`, `unknown` for the opaque dispatch error), never
 * a runtime codec object — preserving polkadot-api version-skew discipline.
 */
export interface TxSubmissionResult {
  readonly ok: boolean;
  readonly txHash: string;
  readonly block: { readonly hash: string };
  readonly dispatchError?: unknown;
}

/**
 * Opaque signer accepted by `signAndSubmit`. The package never inspects it; it
 * is forwarded verbatim to the typed transaction. Typed as `unknown` so callers
 * pass their own `PolkadotSigner` without this package importing polkadot-api.
 */
export type AttestationSigner = unknown;

/**
 * Minimal structural view of the typed `PeopleLite.attest` transaction surface.
 *
 * The app passes `getFireflyChainAPI().individuality`, whose generated
 * `TypedApi` structurally satisfies this. Keeping the interface minimal (rather
 * than importing the descriptor type) avoids a polkadot-api dependency in this
 * package and keeps only plain structural values crossing the version boundary.
 */
export interface PeopleLiteTxApi {
  readonly tx: {
    readonly PeopleLite: {
      attest(args: AttestCallArgs): {
        signAndSubmit(signer: AttestationSigner): Promise<TxSubmissionResult>;
      };
    };
  };
}

/**
 * Structural arguments for `PeopleLite.attest`, matching the bundled
 * individuality descriptor:
 *
 * ```
 * attest({
 *   candidate: SS58String,
 *   candidate_signature: MultiSignature,  // structural enum
 *   ring_vrf_key: FixedSizeBinary<32>,
 *   proof_of_ownership: FixedSizeBinary<96>,
 *   consumer_registration?: {...}
 * })
 * ```
 *
 * `ring_vrf_key` / `proof_of_ownership` are passed as the values the caller
 * supplies for the descriptor's `FixedSizeBinary` fields (the app wraps raw
 * bytes with `Binary.fromBytes` before calling — see `buildAttestCallArgs`).
 */
export interface AttestCallArgs {
  readonly candidate: string;
  readonly candidate_signature: MultiSignatureValue;
  readonly ring_vrf_key: unknown;
  readonly proof_of_ownership: unknown;
  readonly consumer_registration?: ConsumerRegistrationCallArgs;
}

/**
 * Structural MultiSignature enum value (polkadot-api style: `{ type, value }`).
 * The candidate signs raw bytes with sr25519, so the active variant is
 * `Sr25519` wrapping a 64-byte signature.
 */
export interface MultiSignatureValue {
  readonly type: 'Ed25519' | 'Sr25519' | 'Ecdsa' | 'Eth';
  readonly value: unknown;
}

/**
 * Structural consumer-registration argument for `PeopleLite.attest`.
 */
export interface ConsumerRegistrationCallArgs {
  readonly signature: MultiSignatureValue;
  readonly account: string;
  readonly identifier_key: unknown;
  readonly username: unknown;
  readonly reserved_username?: unknown;
}

// ============================================================================
// Client Implementation
// ============================================================================

/**
 * Client for interacting with Individuality pallets.
 *
 * Provides high-level methods for:
 * - Querying personhood status
 * - Checking attestation eligibility
 * - Managing aliases
 * - Subscribing to changes
 */
export class IndividualityClient {
  private readonly api: PeopleLiteApi;
  private subscriptions = new Map<string, Set<PersonhoodCallback>>();
  private pollingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private pollingCleanup = new Map<string, () => void>();

  /**
   * Create a new IndividualityClient.
   *
   * @param api - The Individuality chain API (api.individuality from ChainClient)
   */
  constructor(api: PeopleLiteApi) {
    this.api = api;
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Get LitePersonInfo for an account.
   *
   * @param address - Account address to query
   * @returns LitePersonInfo if registered, null otherwise
   */
  async getLitePerson(address: PolkadotAddress): Promise<LitePersonInfo | null> {
    return getLitePerson(this.api, address);
  }

  /**
   * Get attestation status for an account.
   *
   * Returns structured status indicating whether the account is:
   * - not_registered: Not a lite person
   * - registered: Is a lite person (with info)
   * - pending_attestation: Attestation in progress (future use)
   *
   * @param address - Account address to query
   * @returns AttestationStatus
   */
  async getAttestationStatus(address: PolkadotAddress): Promise<AttestationStatus> {
    const info = await this.getLitePerson(address);
    if (info !== null) {
      return { status: 'registered', info };
    }
    return { status: 'not_registered' };
  }

  /**
   * Get attestation allowance for a verifier.
   *
   * @param verifier - Verifier account address
   * @returns AttestationAllowance with remaining count
   */
  async getAttestationAllowance(verifier: PolkadotAddress): Promise<AttestationAllowance> {
    return getPalletAttestationAllowance(this.api, verifier);
  }

  /**
   * Check if an account can be attested.
   *
   * @param address - Account to check
   * @returns Eligibility result with reason if not eligible
   */
  async canBeAttested(address: PolkadotAddress): Promise<AttestationEligibility> {
    return checkCanBeAttested(this.api, address);
  }

  /**
   * Check if an account is a lite person.
   *
   * @param address - Account to check
   * @returns true if registered as lite person
   */
  async isLitePerson(address: PolkadotAddress): Promise<boolean> {
    return isLitePerson(this.api, address);
  }

  /**
   * Get alias for an account.
   *
   * @param address - Account address
   * @returns RevisedContextualAlias if set, null otherwise
   */
  async getAlias(address: PolkadotAddress): Promise<RevisedContextualAlias | null> {
    return getAccountAlias(this.api, address);
  }

  /**
   * Get account for an alias.
   *
   * @param alias - Contextual alias
   * @returns Account address if set, null otherwise
   */
  async resolveAlias(alias: ContextualAlias): Promise<PolkadotAddress | null> {
    return getAliasAccount(this.api, alias);
  }

  // ==========================================================================
  // Subscription Methods
  // ==========================================================================

  /**
   * Subscribe to personhood changes for an address.
   *
   * Note: This uses polling since polkadot-api subscriptions depend on
   * the specific chain client implementation. For production, this should
   * be replaced with proper WebSocket subscriptions.
   *
   * @param address - Address to watch
   * @param callback - Called when personhood changes
   * @param pollIntervalMs - Polling interval in ms (default: 10s, min: 1s)
   * @returns Unsubscribe function
   */
  subscribeLitePerson(
    address: PolkadotAddress,
    callback: PersonhoodCallback,
    pollIntervalMs = 10_000
  ): Unsubscribe {
    // Validate and clamp poll interval to prevent hot loops
    const MIN_POLL_INTERVAL = 1000;
    const MAX_POLL_INTERVAL = 60_000;
    const clampedInterval = Math.max(
      MIN_POLL_INTERVAL,
      Math.min(MAX_POLL_INTERVAL, Number.isFinite(pollIntervalMs) ? pollIntervalMs : 10_000)
    );

    const key = address;

    // Add callback to subscription set
    let callbacks = this.subscriptions.get(key);
    if (callbacks === undefined) {
      callbacks = new Set();
      this.subscriptions.set(key, callbacks);
    }
    callbacks.add(callback);

    // Start polling if not already
    if (!this.pollingTimeouts.has(key)) {
      // Use undefined as sentinel to indicate first poll hasn't happened yet
      let lastInfo: LitePersonInfo | null | undefined = undefined;
      let isActive = true;

      const scheduleNextPoll = (): void => {
        if (!isActive) return;
        // Add jitter (0-10% of interval) to prevent thundering herd
        const jitter = Math.random() * clampedInterval * 0.1;
        const timeout = setTimeout(() => {
          void runPoll();
        }, clampedInterval + jitter);
        this.pollingTimeouts.set(key, timeout);
      };

      const runPoll = async (): Promise<void> => {
        if (!isActive) return;

        try {
          const info = await this.getLitePerson(address);
          // Cleanup closure can set isActive=false during the await - TS can't track this
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!isActive) return;

          // Only notify if changed (first poll always notifies)
          const isFirstPoll = lastInfo === undefined;
          const hasChanged = isFirstPoll || !this.deepEqual(info, lastInfo);

          if (hasChanged) {
            lastInfo = info;
            const cbs = this.subscriptions.get(key);
            if (cbs !== undefined) {
              for (const cb of cbs) {
                try {
                  cb(info);
                } catch {
                  // Ignore callback errors
                }
              }
            }
          }
        } catch {
          // Ignore polling errors
        }

        // Schedule next poll after this one completes (prevents overlap)
        scheduleNextPoll();
      };

      // Store cleanup function to stop in-flight polls
      this.pollingCleanup.set(key, () => {
        isActive = false;
      });

      // Initial poll (immediate)
      void runPoll();
    }

    // Return unsubscribe function
    return () => {
      const cbs = this.subscriptions.get(key);
      if (cbs !== undefined) {
        cbs.delete(callback);
        if (cbs.size === 0) {
          this.subscriptions.delete(key);
          // Clear timeout
          const timeout = this.pollingTimeouts.get(key);
          if (timeout !== undefined) {
            clearTimeout(timeout);
            this.pollingTimeouts.delete(key);
          }
          // Call cleanup to stop any in-flight poll
          const cleanup = this.pollingCleanup.get(key);
          if (cleanup !== undefined) {
            cleanup();
            this.pollingCleanup.delete(key);
          }
        }
      }
    };
  }

  /**
   * Deep equality check for LitePersonInfo.
   * More reliable than JSON.stringify and handles null correctly.
   */
  private deepEqual(a: LitePersonInfo | null, b: LitePersonInfo | null | undefined): boolean {
    if (a === b) return true;
    if (a === null || b === null || b === undefined) return false;
    // Compare all fields - method.type check is defensive for future RecognitionMethod variants
    if (a.ringVrfKey !== b.ringVrfKey) return false;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (a.method.type !== b.method.type) return false;
    if (a.method.attester !== b.method.attester) return false;
    return true;
  }

  // ==========================================================================
  // Message Generation
  // ==========================================================================

  /**
   * Generate the attestation message that a candidate must sign.
   *
   * Delegates to the standalone {@link generateAttestationMessage} so there is a
   * single source of truth for the byte layout.
   *
   * @param candidate - Candidate account address (SS58)
   * @param ringVrfKey - Candidate's ring VRF key (32 bytes)
   * @returns Message bytes to sign
   */
  generateAttestationMessage(candidate: PolkadotAddress, ringVrfKey: Uint8Array): Uint8Array {
    return generateAttestationMessage(candidate, ringVrfKey);
  }

  /**
   * Submit a `PeopleLite.attest` extrinsic and resolve once it is finalized.
   *
   * This is the on-chain primitive a verifier (an account holding
   * `AttestationAllowance`) calls to register a candidate as a lite person. The
   * `signer` must therefore be the verifier's signer, NOT the candidate's — the
   * candidate only contributes `candidate_signature` / `proof_of_ownership`.
   *
   * Fails closed exactly like the native-payment path: any submission error,
   * timeout, or on-chain dispatch error returns an `err` Result. It NEVER
   * fabricates a success, hash, or registration.
   *
   * Arguments are forwarded as plain structural values (string SS58, structural
   * `{ type, value }` enums, and the caller's pre-wrapped `FixedSizeBinary`
   * values). No runtime codec object from a different polkadot-api major crosses
   * the boundary — preserving version-skew discipline.
   *
   * @param api - The typed individuality chain API (`getFireflyChainAPI().individuality`)
   * @param args - Structural `attest` call arguments (see {@link buildAttestCallArgs})
   * @param signer - The verifier's signer
   * @returns Result with the finalized tx/block hashes, or an error
   */
  async submitAttestation(
    api: PeopleLiteTxApi,
    args: AttestCallArgs,
    signer: AttestationSigner
  ): Promise<Result<{ txHash: string; blockHash: string }>> {
    try {
      const tx = api.tx.PeopleLite.attest(args);
      const result = await tx.signAndSubmit(signer);

      if (!result.ok) {
        // Surface the dispatch error rather than reporting a fake success.
        return err(new Error('PeopleLite.attest failed on chain'));
      }

      return ok({ txHash: result.txHash, blockHash: result.block.hash });
    } catch (error) {
      return err(error instanceof Error ? error : new Error('PeopleLite.attest submission failed'));
    }
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Stop all subscriptions and clean up resources.
   */
  destroy(): void {
    // Clear all polling timeouts
    for (const timeout of this.pollingTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.pollingTimeouts.clear();

    // Call all cleanup functions to stop in-flight polls
    for (const cleanup of this.pollingCleanup.values()) {
      cleanup();
    }
    this.pollingCleanup.clear();

    this.subscriptions.clear();
  }
}

// ============================================================================
// Standalone Attestation Message (single source of truth)
// ============================================================================

/** SCALE-encoded length of an AccountId32 (raw 32 bytes, no length prefix). */
const ACCOUNT_ID_LEN = 32;

/** Length of the ring VRF public key in bytes. */
const RING_VRF_KEY_LEN = 32;

/**
 * Build the exact byte string a candidate must sign to be attested as a lite
 * person.
 *
 * Layout (matches the pallet's `register using` payload):
 *
 * ```
 * MSG_PREFIX  ++  SCALE(candidate: AccountId32)  ++  ring_vrf_key (32 bytes)
 * ```
 *
 * `AccountId32` SCALE encoding is simply its 32 raw public-key bytes (a fixed
 * size type carries no length prefix), so we decode the SS58 candidate address
 * to its 32-byte AccountId via polkadot-api's `AccountId` codec (re-exported as
 * `accountIdBytes`). The previous implementation `TextEncoder`-encoded the SS58
 * *string* instead, which produced a payload the chain could never verify.
 *
 * @param candidate - Candidate account address (SS58)
 * @param ringVrfKey - Candidate's ring VRF key (must be 32 bytes)
 * @returns Message bytes to sign (length = MSG_PREFIX + 32 + 32)
 * @throws if `ringVrfKey` is not 32 bytes
 */
export function generateAttestationMessage(
  candidate: PolkadotAddress,
  ringVrfKey: Uint8Array
): Uint8Array {
  if (ringVrfKey.length !== RING_VRF_KEY_LEN) {
    throw new Error(`ring_vrf_key must be ${RING_VRF_KEY_LEN} bytes, got ${ringVrfKey.length}`);
  }

  // Decode SS58 -> 32-byte AccountId32 (this IS the SCALE encoding of AccountId32).
  const candidateAccountId = accountIdBytes(candidate);
  if (candidateAccountId.length !== ACCOUNT_ID_LEN) {
    throw new Error(
      `candidate AccountId must be ${ACCOUNT_ID_LEN} bytes, got ${candidateAccountId.length}`
    );
  }

  const message = new Uint8Array(MSG_PREFIX.length + ACCOUNT_ID_LEN + RING_VRF_KEY_LEN);
  message.set(MSG_PREFIX, 0);
  message.set(candidateAccountId, MSG_PREFIX.length);
  message.set(ringVrfKey, MSG_PREFIX.length + ACCOUNT_ID_LEN);
  return message;
}

/**
 * Assemble the structural `PeopleLite.attest` call arguments from typed
 * {@link AttestationParams}.
 *
 * `wrapFixedBytes` lets the caller supply the polkadot-api `Binary.fromBytes`
 * wrapper for the descriptor's `FixedSizeBinary` fields without this package
 * importing polkadot-api (keeping version-skew discipline). Callers in the app
 * pass `(bytes) => Binary.fromBytes(bytes)`.
 *
 * @param params - Typed attestation parameters
 * @param wrapFixedBytes - Wraps raw bytes into the chain's FixedSizeBinary value
 * @param consumer - Optional consumer-registration parameters
 * @returns Structural args ready for {@link IndividualityClient.submitAttestation}
 */
export function buildAttestCallArgs(
  params: AttestationParams,
  wrapFixedBytes: (bytes: Uint8Array) => unknown,
  consumer?: ConsumerRegistrationParams
): AttestCallArgs {
  const candidateSignature: MultiSignatureValue = {
    type: 'Sr25519',
    value: wrapFixedBytes(params.candidateSignature),
  };

  const base: AttestCallArgs = {
    candidate: params.candidate,
    candidate_signature: candidateSignature,
    ring_vrf_key: wrapFixedBytes(params.ringVrfKey),
    proof_of_ownership: wrapFixedBytes(params.proofOfOwnership),
  };

  if (consumer === undefined) {
    return base;
  }

  const consumerArgs: ConsumerRegistrationCallArgs = {
    signature: { type: 'Sr25519', value: wrapFixedBytes(consumer.signature) },
    account: consumer.account,
    identifier_key: wrapFixedBytes(consumer.identifierKey),
    username: consumer.username,
    ...(consumer.reservedUsername !== undefined && {
      reserved_username: consumer.reservedUsername,
    }),
  };

  return { ...base, consumer_registration: consumerArgs };
}
