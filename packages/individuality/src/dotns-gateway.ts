/**
 * DotNS Gateway Extension support for Individuality pallets.
 *
 * Provides typed access to the dotNS Gateway Extension for:
 * - Free full-person name registration (v0.9.3 feature)
 * - Lite-person name reservation
 * - Base name reservation with lite registration
 *
 * The Gateway Extension (PR #963) enables free name registration for
 * verified persons using ring-VRF membership proofs.
 *
 * @license GPL-3.0
 * @see https://github.com/nicksenger/individuality/tree/main/pallets/dotns-gateway
 */

import type { PolkadotAddress } from '@cocuyo/types';
import type {
  LiteNameReservationParams,
  BaseNameReservationParams,
  FullNameRegistrationParams,
  RegistrationRecord,
  ValidationResult,
  EligibilityResult,
} from './types';
import { isValidLiteLabel, isValidPersonLabel, MAX_LABEL_BYTES } from './types';

/** Hex validation regex for chat keys (65 bytes = 130 hex chars). */
const CHAT_KEY_HEX_REGEX = /^(0x)?[0-9a-fA-F]{130}$/;

// ============================================================================
// Chain API Types
// ============================================================================

/**
 * Raw registration record from chain storage.
 */
interface RawRegistrationRecord {
  readonly collection: { type: 'People' } | { type: 'PeopleLite' };
  readonly account: string;
}

/**
 * Minimal chain API interface for DotNS Gateway queries.
 */
export interface DotNsGatewayApi {
  readonly query: {
    readonly DotnsGateway?: {
      /** Alias to registration record mapping */
      readonly AliasRegistration?: {
        getValue(alias: string): Promise<RawRegistrationRecord | undefined>;
      };
      /** Account to alias mapping */
      readonly AccountAlias?: {
        getValue(account: string): Promise<string | undefined>;
      };
      /** Lite label to owner mapping */
      readonly LiteLabelOwner?: {
        getValue(label: string): Promise<string | undefined>;
      };
    };
  };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Check if the DotNS Gateway pallet is available on this chain.
 *
 * @param api - The chain API interface
 * @returns true if the gateway pallet is available
 */
export function isGatewayAvailable(api: DotNsGatewayApi): boolean {
  return api.query.DotnsGateway !== undefined;
}

/**
 * Get the registration record for an alias.
 *
 * @param api - The DotNS Gateway API interface
 * @param alias - The alias to look up (hex encoded)
 * @returns RegistrationRecord if registered, null otherwise
 */
export async function getAliasRegistration(
  api: DotNsGatewayApi,
  alias: string
): Promise<RegistrationRecord | null> {
  if (api.query.DotnsGateway?.AliasRegistration === undefined) {
    return null;
  }

  const raw = await api.query.DotnsGateway.AliasRegistration.getValue(alias);
  if (raw === undefined) {
    return null;
  }

  return {
    collection: raw.collection.type,
    account: raw.account as PolkadotAddress,
  };
}

/**
 * Get the alias registered by an account.
 *
 * @param api - The DotNS Gateway API interface
 * @param account - The account address
 * @returns Alias (hex encoded) if registered, null otherwise
 */
export async function getAccountAlias(
  api: DotNsGatewayApi,
  account: PolkadotAddress
): Promise<string | null> {
  if (api.query.DotnsGateway?.AccountAlias === undefined) {
    return null;
  }

  const alias = await api.query.DotnsGateway.AccountAlias.getValue(account);
  return alias ?? null;
}

/**
 * Get the owner of a lite label.
 *
 * @param api - The DotNS Gateway API interface
 * @param label - The lite label (e.g., "alice.42")
 * @returns Owner account if set, null otherwise
 */
export async function getLiteLabelOwner(
  api: DotNsGatewayApi,
  label: string
): Promise<PolkadotAddress | null> {
  if (api.query.DotnsGateway?.LiteLabelOwner === undefined) {
    return null;
  }

  const owner = await api.query.DotnsGateway.LiteLabelOwner.getValue(label);
  return owner !== undefined ? (owner as PolkadotAddress) : null;
}

/**
 * Check if an alias has already registered a name.
 *
 * @param api - The DotNS Gateway API interface
 * @param alias - The alias to check (hex encoded)
 * @returns true if the alias has already registered
 */
export async function isAliasRegistered(api: DotNsGatewayApi, alias: string): Promise<boolean> {
  const record = await getAliasRegistration(api, alias);
  return record !== null;
}

/**
 * Check if an account has already registered via the gateway.
 *
 * @param api - The DotNS Gateway API interface
 * @param account - The account to check
 * @returns true if the account has already registered
 */
export async function isAccountRegistered(
  api: DotNsGatewayApi,
  account: PolkadotAddress
): Promise<boolean> {
  const alias = await getAccountAlias(api, account);
  return alias !== null;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a chat key hex string.
 * Must be exactly 65 bytes (130 hex chars, optionally with 0x prefix).
 */
function isValidChatKey(chatKey: string): boolean {
  return CHAT_KEY_HEX_REGEX.test(chatKey);
}

/**
 * Validate lite name reservation parameters.
 *
 * Checks:
 * - liteLabel matches lite-person format (dns-stem.digits)
 * - chatKey is valid 65-byte hex string
 *
 * Note: Ownership validation happens on-chain, not here.
 *
 * @param params - The reservation parameters
 * @returns Validation result with error if invalid
 */
export function validateLiteNameReservation(params: LiteNameReservationParams): ValidationResult {
  if (!isValidLiteLabel(params.liteLabel)) {
    return { valid: false, error: 'InvalidLiteLabel' };
  }

  if (!isValidChatKey(params.chatKey)) {
    return { valid: false, error: 'InvalidName' };
  }

  return { valid: true };
}

/**
 * Validate base name reservation parameters.
 *
 * Checks:
 * - All lite registration validations
 * - reservedBaseLabel matches full-person format (lowercase letters only)
 *
 * @param params - The reservation parameters
 * @returns Validation result with error if invalid
 */
export function validateBaseNameReservation(params: BaseNameReservationParams): ValidationResult {
  const liteValidation = validateLiteNameReservation(params.lite);
  if (!liteValidation.valid) {
    return liteValidation;
  }

  if (!isValidPersonLabel(params.reservedBaseLabel)) {
    return { valid: false, error: 'InvalidBaseLabel' };
  }

  // Check byte length for reserved label
  const bytes = new TextEncoder().encode(params.reservedBaseLabel);
  if (bytes.length > MAX_LABEL_BYTES) {
    return { valid: false, error: 'InvalidBaseLabel' };
  }

  return { valid: true };
}

/**
 * Validate full name registration parameters.
 *
 * Checks:
 * - label matches full-person format (lowercase letters only, max 32 bytes)
 * - If LiteUsername link: liteLabel is valid
 * - If None link: chatKey is valid 65-byte hex
 *
 * Note: Lite label ownership validation happens on-chain, not here.
 *
 * @param params - The registration parameters
 * @returns Validation result with error if invalid
 */
export function validateFullNameRegistration(params: FullNameRegistrationParams): ValidationResult {
  if (!isValidPersonLabel(params.label)) {
    return { valid: false, error: 'InvalidName' };
  }

  if (params.link.type === 'LiteUsername') {
    if (!isValidLiteLabel(params.link.liteLabel)) {
      return { valid: false, error: 'InvalidLiteLabel' };
    }
  } else {
    if (!isValidChatKey(params.link.chatKey)) {
      return { valid: false, error: 'InvalidName' };
    }
  }

  return { valid: true };
}

// ============================================================================
// Eligibility Checks
// ============================================================================

/**
 * Check if an account can register a full-person name.
 *
 * Performs client-side eligibility checks:
 * - Gateway pallet is available
 * - Account hasn't already registered
 * - Alias hasn't already registered
 *
 * Note: This does NOT validate the ring-VRF proof or signature.
 * Those are validated on-chain during transaction execution.
 *
 * @param api - The DotNS Gateway API interface
 * @param account - The account to check
 * @param alias - The alias that would be used (hex encoded)
 * @returns Eligibility result with reason if not eligible
 */
export async function canRegisterFullName(
  api: DotNsGatewayApi,
  account: PolkadotAddress,
  alias: string
): Promise<EligibilityResult> {
  if (!isGatewayAvailable(api)) {
    // Gateway pallet not available - use DispatcherAddressNotSet as closest match
    return { eligible: false, error: 'DispatcherAddressNotSet' };
  }

  const accountRegistered = await isAccountRegistered(api, account);
  if (accountRegistered) {
    return { eligible: false, error: 'AccountAlreadyRegistered' };
  }

  const aliasRegistered = await isAliasRegistered(api, alias);
  if (aliasRegistered) {
    return { eligible: false, error: 'AliasAlreadyRegistered' };
  }

  return { eligible: true };
}
