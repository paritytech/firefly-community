/**
 * @cocuyo/individuality
 *
 * TypeScript client for Individuality pallets (PeopleLite, DIM, DotNS Gateway).
 *
 * Provides typed access to:
 * - PeopleLite pallet for querying personhood status
 * - DotNS Gateway Extension for free name registration (v0.9.3)
 * - Attestation eligibility checking
 * - Privacy-preserving alias management
 * - Personhood change subscriptions
 *
 * Usage:
 * ```ts
 * import { IndividualityClient, PALLET_VERSION } from '@cocuyo/individuality';
 *
 * const api = await getFireflyChainAPI();
 * const client = new IndividualityClient(api.individuality);
 *
 * // Check if account is a verified person
 * const info = await client.getLitePerson(address);
 *
 * // Check pallet version
 * console.log(`Using individuality v${PALLET_VERSION.major}.${PALLET_VERSION.minor}.${PALLET_VERSION.patch}`);
 * ```
 *
 * @license GPL-3.0
 */

// Client
export { IndividualityClient, generateAttestationMessage, buildAttestCallArgs } from './client';
export type {
  PersonhoodCallback,
  Unsubscribe,
  PeopleLiteTxApi,
  TxSubmissionResult,
  AttestationSigner,
  AttestCallArgs,
  MultiSignatureValue,
  ConsumerRegistrationCallArgs,
} from './client';

// Types - PeopleLite
export type {
  RecognitionMethod,
  LitePersonInfo,
  ContextualAlias,
  RevisedContextualAlias,
  AttestationStatus,
  AttestationParams,
  ConsumerRegistrationParams,
  AttestationEligibility,
  AttestationAllowance,
  PeopleLiteEvent,
} from './types';

// Types - DotNS Gateway (v0.9.3)
export type {
  Collection,
  DotNsLink,
  LiteNameReservationParams,
  BaseNameReservationParams,
  FullNameRegistrationParams,
  RegistrationRecord,
  DispatcherRevert,
  ExtensionValidity,
  PalletError,
  DotNsGatewayError,
  ValidationResult,
  EligibilityResult,
  PalletVersion,
} from './types';

// Constants - PeopleLite
export {
  MSG_PREFIX,
  LITE_PEOPLE_AUTH_CONTEXT,
  LITE_PEOPLE_MEMBER_IDENTIFIER,
  ALIAS_SETUP_BLOCK_TOLERANCE,
  isLitePersonInfo,
  isRegistered,
} from './types';

// Constants - Version (v0.9.3)
export {
  PALLET_VERSION,
  MIN_LITE_USERNAME_DIGITS,
  MAX_LABEL_BYTES,
  isValidLiteLabel,
  isValidPersonLabel,
} from './types';

// Low-level pallet functions (for advanced use)
export type { PeopleLiteApi } from './people-lite';
export {
  getLitePerson,
  getAttestationAllowance,
  getAccountAlias,
  getAliasAccount,
  isCollectionCreated,
  isLitePerson,
  canBeAttested,
} from './people-lite';

// DotNS Gateway Extension (v0.9.3)
export type { DotNsGatewayApi } from './dotns-gateway';
export {
  isGatewayAvailable,
  getAliasRegistration,
  getAccountAlias as getDotNsAccountAlias,
  getLiteLabelOwner,
  isAliasRegistered,
  isAccountRegistered,
  validateLiteNameReservation,
  validateBaseNameReservation,
  validateFullNameRegistration,
  canRegisterFullName,
} from './dotns-gateway';
