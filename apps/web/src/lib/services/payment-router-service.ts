/**
 * Payment Router Service
 *
 * Routes between public (pUSD) and private (coinage) payment modes.
 * Provides recommendations based on use case, amount, and user preferences.
 *
 * Payment Modes:
 * - public: On-chain pUSD transfers (transparent, auditable)
 * - private: Off-chain coinage transfers (anonymous, untraceable)
 *
 * The router helps users choose the appropriate mode for their use case
 * while considering compliance requirements and privacy preferences.
 */

import type {
  PaymentRouter,
  PaymentMode,
  PaymentError,
  CoinageError,
  PUSDAmount,
  PolkadotAddress,
  TransactionHash,
  TransferPackage,
  Result,
  Coin,
  PaymentUseCase,
} from '@cocuyo/types';
import {
  ok,
  err,
  selectPaymentMode,
  COIN_VALUES_CENTS,
  createPolkadotAddress,
} from '@cocuyo/types';
import { getPaymentService, type PUSDPaymentService } from './pusd-payment-service';
import { getCoinageService } from './coinage-service';
import { getConnectedWallet } from './service-utils';
import { CHAIN_CONFIG } from '../chain/config';
import { createLogger } from '../logging';

const logger = createLogger('PaymentRouter');

/** Max time to wait for a public payment to finalize before failing closed. */
const PAYMENT_CONFIRM_TIMEOUT_MS = 90_000;

/**
 * Resolve with the finalized transaction hash for a payment request, or reject
 * if it fails or does not confirm within the timeout. Always unsubscribes.
 */
function waitForPaymentTxHash(
  service: PUSDPaymentService,
  requestId: string
): Promise<TransactionHash> {
  return new Promise<TransactionHash>((resolve, reject) => {
    let settled = false;
    // Relies on the PUSDPaymentService contract that subscribePaymentStatus
    // never emits synchronously (initial replay is deferred via setTimeout,
    // terminal updates arrive async), so `unsubscribe` is always assigned by
    // the time `finish` runs.
    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new Error('Payment confirmation timed out')));
    }, PAYMENT_CONFIRM_TIMEOUT_MS);

    const unsubscribe = service.subscribePaymentStatus(
      requestId,
      (result) => {
        if (result.status === 'confirmed' && result.txHash !== undefined) {
          const { txHash } = result;
          finish(() => resolve(txHash));
        } else if (result.status === 'failed') {
          finish(() => reject(new Error(result.error ?? 'Payment failed')));
        }
      },
      (error) => {
        finish(() => reject(error));
      }
    );
  });
}

// ============================================================
// Types
// ============================================================

export interface PaymentRouterConfig {
  /** Maximum amount for private payments (cents) */
  readonly privateMaxCents: number;
  /** Minimum amount for public payments (cents) */
  readonly publicMinCents: number;
  /** Use cases that require public payments */
  readonly publicRequiredCases: readonly string[];
  /** High-sensitivity use cases (recommend private) */
  readonly highSensitivityCases: readonly string[];
}

// ============================================================
// Default Configuration
// ============================================================

const DEFAULT_CONFIG: PaymentRouterConfig = {
  privateMaxCents: 100000, // $1000 max for private
  publicMinCents: 100, // $1 min for public (gas efficiency)
  publicRequiredCases: [
    'campaign_contribution',
    'treasury_deposit',
    'outlet_funding',
    'stake_deposit',
  ],
  highSensitivityCases: [
    'whistleblower_tip',
    'source_payment',
    'anonymous_contribution',
    'privacy_sensitive',
  ],
};

// ============================================================
// Payment Router Implementation
// ============================================================

/**
 * Payment router that selects between public and private payment modes.
 */
export class PaymentRouterImpl implements PaymentRouter {
  private config: PaymentRouterConfig;

  constructor(config: Partial<PaymentRouterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get recommended payment mode for a use case.
   */
  getRecommendedMode(params: {
    useCase: string;
    senderPreference?: PaymentMode;
    receiverPreference?: PaymentMode;
    complianceRequired?: boolean;
    receiverHasCoinage?: boolean;
    amountCents?: number;
  }): { mode: PaymentMode; reason: string; warning?: string } {
    const {
      useCase,
      senderPreference,
      receiverPreference,
      complianceRequired = false,
      receiverHasCoinage = false,
      amountCents,
    } = params;

    // Check compliance requirement
    if (complianceRequired) {
      return {
        mode: 'public',
        reason: 'Compliance requirements mandate public, auditable payments',
      };
    }

    // Check if use case requires public
    if (this.config.publicRequiredCases.includes(useCase)) {
      return {
        mode: 'public',
        reason: `${useCase} requires public payments for transparency`,
      };
    }

    // Check amount limits
    if (amountCents !== undefined) {
      if (amountCents > this.config.privateMaxCents) {
        return {
          mode: 'public',
          reason: 'Amount exceeds private payment limit',
          warning: `Private payments are limited to $${this.config.privateMaxCents / 100}`,
        };
      }

      if (amountCents < this.config.publicMinCents) {
        return {
          mode: 'private',
          reason: 'Small amounts are more efficient as private transfers',
        };
      }
    }

    // Check receiver capability
    if (!receiverHasCoinage) {
      return {
        mode: 'public',
        reason: 'Receiver has not set up private payments',
        warning: 'Receiver needs to enable coinage to receive private payments',
      };
    }

    // Check high-sensitivity cases
    if (this.config.highSensitivityCases.includes(useCase)) {
      return {
        mode: 'private',
        reason: 'High-sensitivity use case benefits from privacy',
      };
    }

    // Use type system recommendation with a valid use case type
    const validUseCase = this.mapToValidUseCase(useCase);
    const typeRecommendation = selectPaymentMode({
      useCase: validUseCase,
      receiverHasCoinage,
      ...(senderPreference ? { senderPreference } : {}),
      ...(receiverPreference ? { receiverPreference } : {}),
    });

    const result: { mode: PaymentMode; reason: string; warning?: string } = {
      mode: typeRecommendation.mode,
      reason: typeRecommendation.reason,
    };
    if (typeRecommendation.warning !== undefined && typeRecommendation.warning !== '') {
      result.warning = typeRecommendation.warning;
    }
    return result;
  }

  /**
   * Map arbitrary use case strings to valid PaymentUseCase types.
   */
  private mapToValidUseCase(useCase: string): PaymentUseCase {
    const mapping: Record<string, PaymentUseCase> = {
      bounty_payout: 'bounty_payout',
      journalist_salary: 'journalist_salary',
      contribution: 'contribution',
      membership: 'membership',
      settlement: 'settlement',
      source_payment: 'source_payment',
      expense: 'expense',
      offboard: 'offboard',
      // Map legacy/custom use cases
      campaign_contribution: 'contribution',
      treasury_deposit: 'contribution',
      outlet_funding: 'settlement',
      whistleblower_tip: 'source_payment',
      anonymous_contribution: 'contribution',
      privacy_sensitive: 'expense',
      tip: 'bounty_payout',
      stake_deposit: 'membership',
    };
    return mapping[useCase] ?? 'expense';
  }

  /**
   * Execute a public payment.
   */
  async sendPublicPayment(params: {
    from: PolkadotAddress;
    to: PolkadotAddress;
    amount: PUSDAmount;
    memo?: string;
  }): Promise<Result<TransactionHash, PaymentError>> {
    const { from, to, amount, memo } = params;

    logger.info('Sending public payment', 'sendPublicPayment', {
      from,
      to,
      amount: amount.toString(),
    });

    try {
      const service = getPaymentService();
      const request = await service.requestPayment(from, to, amount, memo);
      const txHash = await waitForPaymentTxHash(service, request.id);
      return ok(txHash);
    } catch (error) {
      logger.error('Public payment failed', 'sendPublicPayment', { error });
      return err({
        type: 'NETWORK_ERROR',
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Prepare a private payment (returns transfer package for off-chain delivery).
   */
  preparePrivatePayment(params: {
    amountCents: number;
  }): Promise<Result<TransferPackage, CoinageError>> {
    const { amountCents } = params;

    logger.info('Preparing private payment', 'preparePrivatePayment', {
      amountCents,
    });

    try {
      const service = getCoinageService();
      const wallet = service.getWallet();

      // Select coins to transfer
      const selectedCoins = this.selectCoinsForAmount(wallet.coins, amountCents);

      if (selectedCoins.length === 0) {
        const totalAvailable = wallet.coins.reduce(
          (sum, c) => sum + COIN_VALUES_CENTS[c.exponent],
          0
        );
        return Promise.resolve(
          err({
            type: 'INSUFFICIENT_COINS',
            available: totalAvailable,
            required: amountCents,
          })
        );
      }

      // Prepare transfer
      const transferPkg = service.prepareTransfer({
        coins: selectedCoins,
      });

      return Promise.resolve(ok(transferPkg));
    } catch (error) {
      logger.error('Private payment preparation failed', 'preparePrivatePayment', { error });
      return Promise.resolve(
        err({
          type: 'INVALID_SPLIT',
          reason: error instanceof Error ? error.message : 'Unknown error',
        })
      );
    }
  }

  /**
   * Select coins that sum to at least the target amount.
   * Uses a greedy algorithm for simplicity.
   */
  private selectCoinsForAmount(coins: readonly Coin[], targetCents: number): Coin[] {
    // Sort by value descending
    const sorted = [...coins].sort((a, b) => b.exponent - a.exponent);

    const selected: Coin[] = [];
    let remaining = targetCents;

    for (const coin of sorted) {
      if (remaining <= 0) break;

      const coinValue = COIN_VALUES_CENTS[coin.exponent];
      if (coinValue <= remaining * 2) {
        // Don't use a coin that's way larger than needed
        selected.push(coin);
        remaining -= coinValue;
      }
    }

    // If we couldn't match exactly, try smaller coins too
    if (remaining > 0) {
      const reverseSorted = [...sorted].reverse();
      for (const coin of reverseSorted) {
        if (remaining <= 0) break;

        const coinValue = COIN_VALUES_CENTS[coin.exponent];
        if (!selected.some((c) => c.derivationIndex === coin.derivationIndex)) {
          selected.push(coin);
          remaining -= coinValue;
        }
      }
    }

    return remaining <= 0 ? selected : [];
  }
}

// ============================================================
// Singleton Export
// ============================================================

let routerInstance: PaymentRouterImpl | null = null;

/**
 * Get the payment router singleton.
 */
export function getPaymentRouter(): PaymentRouterImpl {
  routerInstance ??= new PaymentRouterImpl();
  return routerInstance;
}

// ============================================================
// Convenience Functions
// ============================================================

/**
 * Whether a real on-chain (native PAS) payment will be submitted: the payment
 * service is in chain mode AND a recipient address is configured. When false,
 * callers should fall back to the simulated flow.
 */
export function isOnChainPaymentActive(): boolean {
  return getPaymentService().getMode() === 'chain' && CHAIN_CONFIG.payments.recipient !== undefined;
}

/**
 * Submit a real native-PAS payment from the connected wallet to the configured
 * recipient. Fails closed if no recipient is configured or no wallet is
 * connected — it never silently succeeds.
 */
export async function payToRecipient(
  amount: PUSDAmount
): Promise<Result<TransactionHash, PaymentError>> {
  const { recipient } = CHAIN_CONFIG.payments;
  if (recipient === undefined) {
    return err({ type: 'NETWORK_ERROR', reason: 'No payment recipient configured' });
  }
  const from = getConnectedWallet();
  if (from === null) {
    return err({ type: 'NETWORK_ERROR', reason: 'No connected wallet for payment' });
  }
  return getPaymentRouter().sendPublicPayment({
    from: createPolkadotAddress(from),
    to: createPolkadotAddress(recipient),
    amount,
  });
}
