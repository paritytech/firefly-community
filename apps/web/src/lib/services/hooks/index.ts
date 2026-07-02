/**
 * Service hooks.
 *
 * React hooks that provide data access with integrated wallet state.
 * Each hook handles both mock and chain implementations based on
 * NEXT_PUBLIC_USE_CHAIN environment variable.
 */

export { useServiceWithWallet } from './useServiceWithWallet';
export type { ServiceWalletState, UseServiceWithWalletOptions } from './useServiceWithWallet';

export { useSignalService } from './useSignalService';
export { useChainService } from './useChainService';
export { useCampaignService } from './useCampaignService';
export { useClaimService } from './useClaimService';
export { useCrowdstackingService } from './useCrowdstackingService';
export { useAllianceGovernanceService } from './useAllianceGovernanceService';

// Payment hooks (Phase 10)
export { usePUSDBalance, usePaymentRequest, usePaymentStatus } from './usePayment';
export type {
  UsePUSDBalanceResult,
  UsePaymentRequestResult,
  UsePaymentStatusResult,
} from './usePayment';

// Coinage hooks (Private Payments)
export { useCoinage } from './useCoinage';
export type { UseCoinageResult } from './useCoinage';

// Personhood hooks (Phase 11)
export {
  usePersonhoodService,
  useAttestationStatus,
  usePersonhoodCapabilities,
} from './usePersonhoodService';
export type {
  UsePersonhoodResult,
  UseAttestationStatusResult,
  UsePersonhoodCapabilitiesResult,
} from './usePersonhoodService';

// CoinPayment hooks (RFC 0017)
export { useCoinPayment } from './useCoinPayment';
export type { UseCoinPaymentResult, CoinPaymentOperationResult } from './useCoinPayment';
