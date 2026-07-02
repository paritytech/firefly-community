/**
 * Hooks Exports
 *
 * Convention — where hooks live:
 * - `src/hooks/` (this directory): generic, app-wide React hooks with no
 *   service-layer dependency (wallet/contracts, DOM utilities, formatters,
 *   debounced suggestions, etc.).
 * - `src/lib/services/hooks/`: service hooks that wrap the data/service layer
 *   and integrate wallet state (e.g. useSignalService, useClaimService).
 * Do not reintroduce `src/lib/hooks/` — generic hooks belong here.
 */

export { useSigner } from '../lib/context/SignerContext';
export { useBulletin, type UseBulletinResult } from './useBulletin';
export {
  useBulletinStatus,
  type UseBulletinStatusResult,
  type BulletinConnectionStatus,
} from './useBulletinStatus';
export { useBulletinWithSigner, type UseBulletinWithSignerResult } from './useBulletinWithSigner';
export { useIlluminate } from './useIlluminate';
export { useIdentity, type IdentityState, type IdentityStatus } from './useIdentity';
export { usePersonhood, type PersonhoodInfo } from './usePersonhood';

// Contract hooks
export { useBountyEscrow, type UseBountyEscrowOptions } from './useBountyEscrow';
export { useFireflyReputation, type UseFireflyReputationOptions } from './useFireflyReputation';

// UI utility hooks
export { useClickOutside } from './useClickOutside';
export { useEscapeKey } from './useEscapeKey';
