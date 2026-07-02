/**
 * PeopleLite pallet wrapper.
 *
 * Provides typed access to PeopleLite storage and calls via polkadot-api.
 * This pallet manages lite personhood verification on the Individuality chain.
 *
 * Storage:
 * - LitePeople: AccountId -> LitePersonInfo (who is registered)
 * - AliasToAccount: ContextualAlias -> AccountId (alias lookup)
 * - AccountToAlias: AccountId -> RevisedContextualAlias (reverse lookup)
 * - AttestationAllowance: AccountId -> u32 (verifier quotas)
 *
 * @license GPL-3.0
 * @see https://github.com/nicksenger/individuality/tree/main/pallets/people-lite
 */

import type { PolkadotAddress } from '@cocuyo/types';
import type {
  LitePersonInfo,
  RecognitionMethod,
  ContextualAlias,
  RevisedContextualAlias,
  AttestationAllowance,
} from './types';

// ============================================================================
// Chain API Types
// ============================================================================

/**
 * Minimal chain API interface for PeopleLite queries.
 *
 * This is a subset of the full ChainClient API that we need for personhood.
 * Some storage items are optional as they may not be available on all chains/versions.
 */
export interface PeopleLiteApi {
  readonly query: {
    readonly PeopleLite: {
      readonly LitePeople: {
        getValue(account: string): Promise<RawLitePersonInfo | undefined>;
      };
      /** Optional: alias to account lookup (may not exist on all chains) */
      readonly AliasToAccount?: {
        getValue(alias: RawContextualAlias): Promise<string | undefined>;
      };
      /** Optional: account to alias lookup (may not exist on all chains) */
      readonly AccountToAlias?: {
        getValue(account: string): Promise<RawRevisedContextualAlias | undefined>;
      };
      readonly AttestationAllowance: {
        getValue(account: string): Promise<number>;
      };
      /** Optional: collection created flag (may not exist on all chains) */
      readonly LitePeopleCollectionCreated?: {
        getValue(): Promise<boolean>;
      };
    };
  };
}

// ============================================================================
// Raw Chain Types (as returned by polkadot-api)
// ============================================================================

/**
 * Raw LitePersonInfo from chain storage.
 * Uses flexible types to accommodate different chain client return types.
 */
interface RawLitePersonInfo {
  /** Ring VRF key - can be Uint8Array, string, or FixedSizeBinary from polkadot-api */
  readonly ring_vrf_key: Uint8Array | string | { asBytes: () => Uint8Array };
  readonly method: RawRecognitionMethod;
}

/**
 * Raw RecognitionMethod from chain storage.
 */
interface RawRecognitionMethod {
  readonly type: 'UniqueDevice';
  readonly value: string; // AccountId
}

/**
 * Raw ContextualAlias from chain storage.
 * Uses flexible types to accommodate different chain client return types.
 */
interface RawContextualAlias {
  readonly alias: Uint8Array | string | { asBytes: () => Uint8Array };
  readonly context: Uint8Array | string | { asBytes: () => Uint8Array };
}

/**
 * Raw RevisedContextualAlias from chain storage.
 */
interface RawRevisedContextualAlias {
  readonly revision: number;
  readonly ring: number;
  readonly ca: RawContextualAlias;
}

// ============================================================================
// Type Converters
// ============================================================================

/**
 * Convert bytes to hex string.
 * Handles Uint8Array, string, or FixedSizeBinary from polkadot-api.
 */
function bytesToHex(bytes: Uint8Array | string | { asBytes: () => Uint8Array }): string {
  if (typeof bytes === 'string') {
    return bytes.startsWith('0x') ? bytes : `0x${bytes}`;
  }
  // Handle FixedSizeBinary from polkadot-api
  const byteArray = 'asBytes' in bytes ? bytes.asBytes() : bytes;
  return (
    '0x' +
    Array.from(byteArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Convert raw chain LitePersonInfo to typed version.
 */
function convertLitePersonInfo(raw: RawLitePersonInfo): LitePersonInfo {
  const method: RecognitionMethod = {
    type: 'UniqueDevice',
    attester: raw.method.value as PolkadotAddress,
  };

  return {
    ringVrfKey: bytesToHex(raw.ring_vrf_key),
    method,
  };
}

/**
 * Convert raw chain ContextualAlias to typed version.
 */
function convertContextualAlias(raw: RawContextualAlias): ContextualAlias {
  return {
    alias: bytesToHex(raw.alias),
    context: bytesToHex(raw.context),
  };
}

/**
 * Convert raw chain RevisedContextualAlias to typed version.
 */
function convertRevisedContextualAlias(raw: RawRevisedContextualAlias): RevisedContextualAlias {
  return {
    revision: raw.revision,
    ring: raw.ring,
    contextualAlias: convertContextualAlias(raw.ca),
  };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Query LitePersonInfo for an account.
 *
 * @param api - The PeopleLite API interface
 * @param account - Account address to query
 * @returns LitePersonInfo if registered, null otherwise
 */
export async function getLitePerson(
  api: PeopleLiteApi,
  account: PolkadotAddress
): Promise<LitePersonInfo | null> {
  const raw = await api.query.PeopleLite.LitePeople.getValue(account);
  return raw !== undefined ? convertLitePersonInfo(raw) : null;
}

/**
 * Query attestation allowance for a verifier.
 *
 * @param api - The PeopleLite API interface
 * @param verifier - Verifier account address
 * @returns Number of remaining attestations
 */
export async function getAttestationAllowance(
  api: PeopleLiteApi,
  verifier: PolkadotAddress
): Promise<AttestationAllowance> {
  const remaining = await api.query.PeopleLite.AttestationAllowance.getValue(verifier);
  return {
    verifier,
    remaining,
  };
}

/**
 * Query alias for an account.
 *
 * @param api - The PeopleLite API interface
 * @param account - Account address to query
 * @returns RevisedContextualAlias if set, null otherwise (null if storage not available)
 */
export async function getAccountAlias(
  api: PeopleLiteApi,
  account: PolkadotAddress
): Promise<RevisedContextualAlias | null> {
  if (api.query.PeopleLite.AccountToAlias === undefined) {
    return null;
  }
  const raw = await api.query.PeopleLite.AccountToAlias.getValue(account);
  return raw !== undefined ? convertRevisedContextualAlias(raw) : null;
}

/**
 * Query account for an alias.
 *
 * @param api - The PeopleLite API interface
 * @param alias - Contextual alias to look up
 * @returns Account address if set, null otherwise (null if storage not available)
 */
export async function getAliasAccount(
  api: PeopleLiteApi,
  alias: ContextualAlias
): Promise<PolkadotAddress | null> {
  if (api.query.PeopleLite.AliasToAccount === undefined) {
    return null;
  }
  const rawAlias: RawContextualAlias = {
    alias: alias.alias,
    context: alias.context,
  };
  const account = await api.query.PeopleLite.AliasToAccount.getValue(rawAlias);
  return account !== undefined ? (account as PolkadotAddress) : null;
}

/**
 * Check if the lite people collection has been created.
 *
 * @param api - The PeopleLite API interface
 * @returns true if collection is initialized (assumes true if storage not available)
 */
export async function isCollectionCreated(api: PeopleLiteApi): Promise<boolean> {
  if (api.query.PeopleLite.LitePeopleCollectionCreated === undefined) {
    // Assume collection is created if storage doesn't exist
    return true;
  }
  return api.query.PeopleLite.LitePeopleCollectionCreated.getValue();
}

// ============================================================================
// Eligibility Checks
// ============================================================================

/**
 * Check if an account is already registered as a lite person.
 *
 * @param api - The PeopleLite API interface
 * @param account - Account to check
 * @returns true if already registered
 */
export async function isLitePerson(api: PeopleLiteApi, account: PolkadotAddress): Promise<boolean> {
  const info = await getLitePerson(api, account);
  return info !== null;
}

/**
 * Check if an account can be attested (not already registered).
 *
 * @param api - The PeopleLite API interface
 * @param account - Account to check
 * @returns Eligibility result with reason if not eligible
 */
export async function canBeAttested(
  api: PeopleLiteApi,
  account: PolkadotAddress
): Promise<{ eligible: boolean; reason?: string }> {
  // Check if collection is created
  const collectionCreated = await isCollectionCreated(api);
  if (!collectionCreated) {
    return {
      eligible: false,
      reason: 'PeopleLite collection not yet initialized',
    };
  }

  // Check if already registered
  const alreadyRegistered = await isLitePerson(api, account);
  if (alreadyRegistered) {
    return {
      eligible: false,
      reason: 'Account already registered as a lite person',
    };
  }

  return { eligible: true };
}
