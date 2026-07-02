/**
 * TypeScript types for Individuality pallets.
 *
 * These types map directly to the Rust types in the PeopleLite pallet:
 * - LitePersonInfo: Information about a registered lite person
 * - RecognitionMethod: How the person was verified
 * - ContextualAlias: Privacy-preserving alias with context
 *
 * @license GPL-3.0
 * @see https://github.com/nicksenger/individuality/tree/main/pallets/people-lite
 */

import type { PolkadotAddress } from '@cocuyo/types';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Recognition method for lite personhood.
 *
 * Currently only UniqueDevice is supported, where an attester
 * verifies that the candidate has a unique device.
 */
export interface RecognitionMethod {
  readonly type: 'UniqueDevice';
  readonly attester: PolkadotAddress;
}

/**
 * Information about a registered lite person.
 *
 * Stored on-chain in PeopleLite.LitePeople storage.
 */
export interface LitePersonInfo {
  /** Ring VRF key for privacy-preserving proofs (32 bytes, hex encoded) */
  readonly ringVrfKey: string;
  /** How the person was verified */
  readonly method: RecognitionMethod;
}

/**
 * Contextual alias for privacy-preserving identity.
 *
 * An alias is bound to a specific context (application) and can be
 * used to interact without revealing the underlying account.
 */
export interface ContextualAlias {
  /** The alias identifier (32 bytes, hex encoded) */
  readonly alias: string;
  /** The context this alias is valid for (32 bytes, hex encoded) */
  readonly context: string;
}

/**
 * Revised contextual alias with ring membership tracking.
 *
 * Includes revision info to track which ring version the alias was created with.
 */
export interface RevisedContextualAlias {
  /** Ring revision index */
  readonly revision: number;
  /** Ring index within the revision */
  readonly ring: number;
  /** The contextual alias */
  readonly contextualAlias: ContextualAlias;
}

// ============================================================================
// Attestation Types
// ============================================================================

/**
 * Status of attestation for an account.
 */
export type AttestationStatus =
  | { readonly status: 'not_registered' }
  | { readonly status: 'registered'; readonly info: LitePersonInfo }
  | { readonly status: 'pending_attestation' };

/**
 * Parameters for the attest extrinsic.
 *
 * The verifier calls this to attest that a candidate is a unique human.
 */
export interface AttestationParams {
  /** Account to be attested */
  readonly candidate: PolkadotAddress;
  /** Candidate's signature over the attestation message */
  readonly candidateSignature: Uint8Array;
  /** Candidate's ring VRF key */
  readonly ringVrfKey: Uint8Array;
  /** Proof of ownership of the ring VRF key */
  readonly proofOfOwnership: Uint8Array;
}

/**
 * Consumer registration parameters (optional during attestation).
 *
 * Allows the candidate to register as a consumer simultaneously.
 */
export interface ConsumerRegistrationParams {
  /** Candidate's signature */
  readonly signature: Uint8Array;
  /** Candidate's account */
  readonly account: PolkadotAddress;
  /** Communication identifier (public key, 65 bytes) */
  readonly identifierKey: Uint8Array;
  /** Chosen username */
  readonly username: string;
  /** Optional reserved username */
  readonly reservedUsername?: string;
}

// ============================================================================
// Query Result Types
// ============================================================================

/**
 * Result of checking if an address can be attested.
 */
export interface AttestationEligibility {
  /** Whether the address is eligible for attestation */
  readonly eligible: boolean;
  /** Reason if not eligible */
  readonly reason?: string;
}

/**
 * Attestation allowance for a verifier.
 */
export interface AttestationAllowance {
  /** The verifier address */
  readonly verifier: PolkadotAddress;
  /** Number of attestations remaining */
  readonly remaining: number;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Events emitted by the PeopleLite pallet.
 */
export type PeopleLiteEvent =
  | {
      readonly type: 'PersonAttested';
      readonly candidate: PolkadotAddress;
      readonly verifier: PolkadotAddress;
    }
  | {
      readonly type: 'ConsumerRegistered';
      readonly account: PolkadotAddress;
    }
  | {
      readonly type: 'AliasAccountSet';
      readonly alias: ContextualAlias;
      readonly account: PolkadotAddress;
    }
  | {
      readonly type: 'AliasAccountUnset';
      readonly alias: ContextualAlias;
      readonly account: PolkadotAddress;
    }
  | {
      readonly type: 'AttestationAllowanceIncreased';
      readonly account: PolkadotAddress;
      readonly count: number;
    }
  | {
      readonly type: 'AllAttestationAllowanceCleared';
      readonly verifier: PolkadotAddress;
    };

// ============================================================================
// Constants
// ============================================================================

/**
 * Message prefix for attestation signatures.
 *
 * The full message is: MSG_PREFIX || encode(candidate) || encode(ringVrfKey)
 */
export const MSG_PREFIX = new Uint8Array([
  // "pop:people-lite:register using" in bytes
  0x70, 0x6f, 0x70, 0x3a, 0x70, 0x65, 0x6f, 0x70, 0x6c, 0x65, 0x2d, 0x6c, 0x69, 0x74, 0x65, 0x3a,
  0x72, 0x65, 0x67, 0x69, 0x73, 0x74, 0x65, 0x72, 0x20, 0x75, 0x73, 0x69, 0x6e, 0x67,
]);

/**
 * Auth context for lite people authentication (32 bytes, space-padded).
 *
 * "pop:polkadot.network/plite-auth "
 */
export const LITE_PEOPLE_AUTH_CONTEXT = new Uint8Array([
  0x70, 0x6f, 0x70, 0x3a, 0x70, 0x6f, 0x6c, 0x6b, 0x61, 0x64, 0x6f, 0x74, 0x2e, 0x6e, 0x65, 0x74,
  0x77, 0x6f, 0x72, 0x6b, 0x2f, 0x70, 0x6c, 0x69, 0x74, 0x65, 0x2d, 0x61, 0x75, 0x74, 0x68, 0x20,
]);

/**
 * Member collection identifier for lite people.
 *
 * "pop:polkadot.network/people-lite"
 */
export const LITE_PEOPLE_MEMBER_IDENTIFIER = new Uint8Array([
  0x70, 0x6f, 0x70, 0x3a, 0x70, 0x6f, 0x6c, 0x6b, 0x61, 0x64, 0x6f, 0x74, 0x2e, 0x6e, 0x65, 0x74,
  0x77, 0x6f, 0x72, 0x6b, 0x2f, 0x70, 0x65, 0x6f, 0x70, 0x6c, 0x65, 0x2d, 0x6c, 0x69, 0x74, 0x65,
]);

/**
 * Block tolerance for alias account setup (600 blocks ~ 1 hour at 6s/block).
 */
export const ALIAS_SETUP_BLOCK_TOLERANCE = 600;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a LitePersonInfo.
 */
export function isLitePersonInfo(value: unknown): value is LitePersonInfo {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.ringVrfKey === 'string' &&
    typeof obj.method === 'object' &&
    obj.method !== null &&
    (obj.method as Record<string, unknown>).type === 'UniqueDevice'
  );
}

/**
 * Check if attestation status indicates registration.
 */
export function isRegistered(
  status: AttestationStatus
): status is { status: 'registered'; info: LitePersonInfo } {
  return status.status === 'registered';
}

// ============================================================================
// Version Constants (v0.9.3)
// ============================================================================

/**
 * Pallet version information for compatibility checking.
 *
 * This corresponds to individuality v0.9.3:
 * - Spec version: 2,000,023
 * - Transaction version: 17
 */
export const PALLET_VERSION = {
  /** Major version */
  major: 0,
  /** Minor version */
  minor: 9,
  /** Patch version */
  patch: 3,
  /** Runtime spec version */
  specVersion: 2_000_023,
  /** Transaction version (bumped for dotNS gateway extension) */
  transactionVersion: 17,
} as const;

export type PalletVersion = typeof PALLET_VERSION;

// ============================================================================
// DotNS Gateway Types (v0.9.3 - PR #963)
// ============================================================================

/**
 * Which ring membership collection the proof targets.
 */
export type Collection = 'People' | 'PeopleLite';

/**
 * Link type for full-person username registration.
 *
 * Describes how a full-person username relates to a lite-person username.
 * SCALE encoding order: LiteUsername=0, None=1 (declaration order).
 */
export type DotNsLink =
  | { readonly type: 'LiteUsername'; readonly liteLabel: string }
  | { readonly type: 'None'; readonly chatKey: string };

/**
 * Parameters for lite-person name reservation.
 */
export interface LiteNameReservationParams {
  /** The lite-person label (e.g., "alice.42") */
  readonly liteLabel: string;
  /** The user's account address */
  readonly user: PolkadotAddress;
  /** ECDH chat key (65 bytes, hex encoded) */
  readonly chatKey: string;
}

/**
 * Parameters for base name reservation (with lite registration).
 */
export interface BaseNameReservationParams {
  /** Lite registration details */
  readonly lite: LiteNameReservationParams;
  /** Reserved base label for future full-person registration */
  readonly reservedBaseLabel: string;
}

/**
 * Parameters for full-person name registration.
 *
 * This is the core v0.9.3 feature - free full person name registration
 * via the dotNS Gateway Extension.
 */
export interface FullNameRegistrationParams {
  /** The full-person label (lowercase letters only) */
  readonly label: string;
  /** The user's account address */
  readonly user: PolkadotAddress;
  /** Link to existing lite username or standalone with chat key */
  readonly link: DotNsLink;
}

/**
 * Record of a name registration by an alias.
 */
export interface RegistrationRecord {
  /** Which collection the person belongs to */
  readonly collection: Collection;
  /** The account that initiated the registration */
  readonly account: PolkadotAddress;
}

/**
 * Dispatcher revert errors from dotNS contract calls.
 * Matches Rust DispatcherRevert enum in dotns-gateway/src/types.rs.
 */
export type DispatcherRevert =
  | 'NotRoot'
  | 'NotGateway'
  | 'InvalidLiteLabel'
  | 'InvalidBaseLabel'
  | 'NoActiveReservation'
  | 'QueueFull'
  | 'AlreadyReserved'
  | 'NotHolder';

/**
 * Transaction extension validity errors.
 * Matches Rust CustomValidity enum in dotns-gateway/src/extension.rs.
 */
export type ExtensionValidity =
  | 'OriginNotNone'
  | 'InvalidName'
  | 'NotLiteLabelOwner'
  | 'InvalidOffchainSignature'
  | 'AliasAlreadyRegistered'
  | 'AccountAlreadyRegistered';

/**
 * Pallet dispatch errors from dotNS gateway.
 * Matches Rust pallet::Error in dotns-gateway/src/lib.rs.
 */
export type PalletError =
  | 'AlreadyRegistered'
  | 'ContractCallFailed'
  | 'InvalidName'
  | 'NoAttestationAllowance'
  | 'InvalidAttestationSignature'
  | 'ReservationSignatureExpired'
  | 'ReservationSignatureFromFuture'
  | 'NotLiteLabelOwner'
  | 'DispatcherAddressNotSet';

/**
 * All possible dotNS gateway errors (union of all error types).
 */
export type DotNsGatewayError = DispatcherRevert | ExtensionValidity | PalletError;

/**
 * Validation result type used by client-side validation functions.
 */
export type ValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly error: DotNsGatewayError };

/**
 * Eligibility check result type.
 */
export type EligibilityResult =
  | { readonly eligible: true }
  | { readonly eligible: false; readonly error: DotNsGatewayError };

// ============================================================================
// DotNS Type Guards
// ============================================================================

/** Minimum trailing digits required in lite-person suffix. Matches Rust MIN_LITE_USERNAME_DIGITS. */
export const MIN_LITE_USERNAME_DIGITS = 2;

/** Maximum label length in bytes. Matches Rust BaseLabel BoundedVec<u8, ConstU32<32>>. */
export const MAX_LABEL_BYTES = 32;

/**
 * Validate a DNS label range: non-empty, only [a-z0-9-], cannot start/end with hyphen.
 * Mirrors Rust indiv_support::labels::is_dns_label_range.
 */
function isDnsLabel(label: string): boolean {
  if (label.length === 0) {
    return false;
  }
  // Cannot start or end with hyphen
  if (label.startsWith('-') || label.endsWith('-')) {
    return false;
  }
  // Only lowercase alphanumeric and hyphen
  return /^[a-z0-9-]+$/.test(label);
}

/**
 * Validate a lite-person label format: `<dns-stem>.<2+ digits>`.
 *
 * Mirrors Rust indiv_support::labels::is_lite_person_label exactly:
 * - Minimum length: MIN_LITE_USERNAME_DIGITS + 2 (e.g., "x.NN")
 * - Maximum length: MAX_LABEL_BYTES (32)
 * - Exactly one dot separator
 * - DNS-valid stem before dot: [a-z0-9-], no leading/trailing hyphen
 * - At least MIN_LITE_USERNAME_DIGITS ASCII digits after dot
 *
 * Valid examples: "alice.42", "a-b.99", "123.99"
 * Invalid examples: "alice-.42", "-alice.42", "alice.1", "alice..42"
 */
export function isValidLiteLabel(label: string): boolean {
  const bytes = new TextEncoder().encode(label);

  // Check byte length bounds
  if (bytes.length < MIN_LITE_USERNAME_DIGITS + 2 || bytes.length > MAX_LABEL_BYTES) {
    return false;
  }

  // Find the single dot separator (must be exactly one dot)
  const dotIndex = label.indexOf('.');
  if (dotIndex === -1 || label.lastIndexOf('.') !== dotIndex) {
    return false;
  }

  // Validate DNS stem before dot
  const stem = label.slice(0, dotIndex);
  if (!isDnsLabel(stem)) {
    return false;
  }

  // Validate suffix: at least MIN_LITE_USERNAME_DIGITS digits
  const suffix = label.slice(dotIndex + 1);
  if (suffix.length < MIN_LITE_USERNAME_DIGITS) {
    return false;
  }
  // Suffix must be all ASCII digits
  return /^\d+$/.test(suffix);
}

/**
 * Validate a full-person label format: lowercase ASCII letters only.
 *
 * Mirrors Rust indiv_support::labels::is_person_label exactly:
 * - Non-empty
 * - Maximum length: MAX_LABEL_BYTES (32)
 * - Only lowercase ASCII letters [a-z] (no digits, no hyphens)
 */
export function isValidPersonLabel(label: string): boolean {
  if (label.length === 0) {
    return false;
  }
  const bytes = new TextEncoder().encode(label);
  if (bytes.length > MAX_LABEL_BYTES) {
    return false;
  }
  return /^[a-z]+$/.test(label);
}
