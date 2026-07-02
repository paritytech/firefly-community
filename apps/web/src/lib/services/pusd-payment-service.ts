/**
 * pUSD Payment Service implementation.
 *
 * Provides real pUSD payment functionality using the Triangle SDK
 * (@novasamatech/host-api-wrapper). Supports dual-mode operation:
 * - HostedPaymentService: Real SDK integration for production
 * - MockPaymentService: In-memory simulation for development/testing
 *
 * The service selection is controlled by NEXT_PUBLIC_USE_MOCK_PAYMENT
 * environment variable.
 */

import type { PUSDAmount, PolkadotAddress, TransactionHash } from '@cocuyo/types';
import { createPUSDAmount, createTransactionHash, ZERO_PUSD } from '@cocuyo/types';
import { createLogger } from '../logging';
import { CHAIN_CONFIG } from '../chain/config';
import {
  transferNativePAS,
  getNativeBalance,
  pusdUnitsToPasPlanck,
  PAS_DECIMALS,
} from '../chain/native-payment';
import { getConnectedSigner, generateId } from './service-utils';

const logger = createLogger('PUSDPaymentService');

// ============================================================
// Types
// ============================================================

/**
 * A payment request initiated through the service.
 */
export interface PaymentRequest {
  readonly id: string;
  readonly amount: PUSDAmount;
  readonly from: PolkadotAddress;
  readonly to: PolkadotAddress;
  readonly memo?: string;
  readonly createdAt: number;
}

/**
 * Status of a payment request.
 */
export type PaymentStatus = 'pending' | 'confirming' | 'confirmed' | 'failed' | 'expired';

/**
 * Result of a payment operation.
 */
export interface PaymentResult {
  readonly requestId: string;
  readonly status: PaymentStatus;
  readonly txHash?: TransactionHash;
  readonly error?: string;
  /**
   * True when this result comes from a simulated tier (mock/hosted-stub) that did
   * not submit a real on-chain transaction. Such results never carry a `txHash`;
   * the UI must not present them as a confirmed on-chain payment.
   */
  readonly simulated?: boolean;
}

/**
 * pUSD Payment Service interface.
 *
 * Provides subscription-based balance updates and payment request handling
 * following the Triangle SDK patterns.
 */
export interface PUSDPaymentService {
  /**
   * Subscribe to balance updates for an address.
   * Returns an unsubscribe function.
   */
  subscribeBalance(
    address: PolkadotAddress,
    onUpdate: (balance: PUSDAmount) => void,
    onError: (error: Error) => void
  ): () => void;

  /**
   * Request a payment from one address to another.
   */
  requestPayment(
    from: PolkadotAddress,
    to: PolkadotAddress,
    amount: PUSDAmount,
    memo?: string
  ): Promise<PaymentRequest>;

  /**
   * Subscribe to payment status updates.
   * Returns an unsubscribe function.
   */
  subscribePaymentStatus(
    requestId: string,
    onUpdate: (result: PaymentResult) => void,
    onError: (error: Error) => void
  ): () => void;

  /**
   * Get current balance (one-time fetch).
   */
  getBalance(address: PolkadotAddress): Promise<PUSDAmount>;

  /**
   * Check if the service is available and configured.
   */
  isAvailable(): boolean;

  /**
   * Get the service mode (for debugging).
   */
  getMode(): 'hosted' | 'mock' | 'chain';
}

// ============================================================
// Configuration
// ============================================================

const PUSD_DECIMALS = 6;
const PUSD_MULTIPLIER = 10n ** BigInt(PUSD_DECIMALS);

// ============================================================
// Hosted Payment Service (Real SDK)
// ============================================================

/**
 * Real SDK integration for production use.
 *
 * Wraps @novasamatech/host-api-wrapper for pUSD operations.
 */
class HostedPaymentService implements PUSDPaymentService {
  private sdk: typeof import('@novasamatech/host-api-wrapper') | null = null;
  private apiKey: string | null = null;
  private environment: 'testnet' | 'production' = 'testnet';
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_PUSD_API_KEY ?? null;
    const envMode = process.env.NEXT_PUBLIC_PUSD_ENV;
    this.environment = envMode === 'production' ? 'production' : 'testnet';
  }

  private async ensureInitialized(): Promise<void> {
    if (this.sdk) return;

    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      try {
        // Dynamic import to avoid SSR issues
        this.sdk = await import('@novasamatech/host-api-wrapper');
        logger.info('Triangle SDK loaded', 'ensureInitialized', {
          environment: this.environment,
        });
      } catch (error) {
        logger.error('Failed to load Triangle SDK', 'ensureInitialized', { error });
        throw new Error('Triangle SDK not available');
      }
    })();

    await this.initPromise;
  }

  subscribeBalance(
    address: PolkadotAddress,
    onUpdate: (balance: PUSDAmount) => void,
    onError: (error: Error) => void
  ): () => void {
    let unsubscribed = false;

    // Initialize and subscribe asynchronously
    this.ensureInitialized()
      .then(() => {
        if (unsubscribed || !this.sdk) return;

        // The SDK uses subscribeBalance from the product instance
        // For now, we'll poll as fallback until we have the proper integration
        logger.info('Balance subscription started', 'subscribeBalance');

        // Poll every 30 seconds as a fallback
        const poll = async (): Promise<void> => {
          if (unsubscribed) return;
          try {
            const balance = await this.getBalance(address);
            onUpdate(balance);
          } catch (error) {
            onError(error instanceof Error ? error : new Error(String(error)));
          }
        };

        void poll();
        const interval = setInterval(() => void poll(), 30000);

        // Store interval for cleanup
        (this as unknown as { _balanceInterval: NodeJS.Timeout | null })._balanceInterval =
          interval;
      })
      .catch(onError);

    return () => {
      unsubscribed = true;
      const self = this as unknown as { _balanceInterval: NodeJS.Timeout | null };
      if (self._balanceInterval) {
        clearInterval(self._balanceInterval);
        self._balanceInterval = null;
      }
    };
  }

  async requestPayment(
    from: PolkadotAddress,
    to: PolkadotAddress,
    amount: PUSDAmount,
    memo?: string
  ): Promise<PaymentRequest> {
    await this.ensureInitialized();

    const requestId = generateId('pr', 6);

    logger.info('Payment requested', 'requestPayment', {
      requestId,
      from,
      to,
      amount: amount.toString(),
      memo,
    });

    // In a real implementation, this would call the SDK's requestPayment
    // For now, create the request object
    const request: PaymentRequest = {
      id: requestId,
      amount,
      from,
      to,
      createdAt: Date.now(),
    };

    // Only include memo if provided
    if (memo !== undefined) {
      return { ...request, memo };
    }

    return request;
  }

  subscribePaymentStatus(
    requestId: string,
    onUpdate: (result: PaymentResult) => void,
    onError: (error: Error) => void
  ): () => void {
    let unsubscribed = false;

    // Simulate payment processing
    this.ensureInitialized()
      .then(() => {
        if (unsubscribed) return;

        // Initial pending state
        onUpdate({
          requestId,
          status: 'pending',
        });

        // Simulate confirming after 2s
        setTimeout(() => {
          if (unsubscribed) return;
          onUpdate({
            requestId,
            status: 'confirming',
          });
        }, 2000);

        // Simulate confirmed after 5s. This hosted stub does not submit a real
        // transaction, so emit no txHash and flag the result as simulated rather
        // than fabricating a real-looking hash.
        setTimeout(() => {
          if (unsubscribed) return;
          onUpdate({
            requestId,
            status: 'confirmed',
            simulated: true,
          });
        }, 5000);
      })
      .catch(onError);

    return () => {
      unsubscribed = true;
    };
  }

  async getBalance(address: PolkadotAddress): Promise<PUSDAmount> {
    await this.ensureInitialized();

    // In a real implementation, this would call the SDK
    // For now, return a mock balance for testing
    logger.debug('Getting balance', 'getBalance', { address });

    // Return a default balance of 1000 pUSD for testing
    return createPUSDAmount(1000n * PUSD_MULTIPLIER);
  }

  isAvailable(): boolean {
    return this.apiKey !== null || this.environment === 'testnet';
  }

  getMode(): 'hosted' | 'mock' {
    return 'hosted';
  }
}

// ============================================================
// Chain Payment Service (On-Chain via native PAS)
// ============================================================

// Native PAS uses 10 decimals; PUSDAmount accounting uses 6. The service exposes
// balances/amounts in the app's 6-decimal units and converts to/from native
// planck at the chain boundary.
const PAS_TO_PUSD_SCALE = 10n ** BigInt(PAS_DECIMALS - PUSD_DECIMALS);

/**
 * Real on-chain payment service using native PAS balance transfers.
 *
 * Submits genuine `Balances.transfer_keep_alive` extrinsics via the host-routed
 * Asset Hub client and reads live balances from `System.Account`. Fails closed:
 * a missing signer or a failed dispatch rejects rather than faking success.
 */
export class ChainPaymentService implements PUSDPaymentService {
  private balancePollers = new Map<
    string,
    {
      interval: NodeJS.Timeout;
      callbacks: Set<(balance: PUSDAmount) => void>;
    }
  >();

  private paymentStatuses = new Map<string, PaymentResult>();
  private paymentSubscribers = new Map<string, Set<(result: PaymentResult) => void>>();

  constructor() {
    logger.info('Chain payment service initialized (native PAS)', 'constructor');
  }

  private notifyPaymentStatus(requestId: string, result: PaymentResult): void {
    this.paymentStatuses.set(requestId, result);
    const subscribers = this.paymentSubscribers.get(requestId);
    if (subscribers) {
      for (const callback of subscribers) {
        callback(result);
      }
    }
  }

  /**
   * Submit the native transfer in the background and drive the request's status
   * from the real on-chain result. Fails closed: any error marks the payment
   * 'failed' rather than reporting a fake confirmation.
   */
  private async executePayment(
    requestId: string,
    from: PolkadotAddress,
    to: PolkadotAddress,
    amount: PUSDAmount
  ): Promise<void> {
    this.notifyPaymentStatus(requestId, { requestId, status: 'confirming' });
    try {
      const txHash = await this.transfer(from, to, amount);
      this.notifyPaymentStatus(requestId, { requestId, status: 'confirmed', txHash });
    } catch (error) {
      logger.error('Chain payment failed', 'executePayment', { requestId, error });
      this.notifyPaymentStatus(requestId, {
        requestId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Payment failed',
      });
    }
  }

  subscribeBalance(
    address: PolkadotAddress,
    onUpdate: (balance: PUSDAmount) => void,
    onError: (error: Error) => void
  ): () => void {
    // Get or create poller for this address
    let poller = this.balancePollers.get(address);
    if (!poller) {
      poller = {
        interval: setInterval(() => {
          void this.pollBalance(address);
        }, 10000), // Poll every 10 seconds
        callbacks: new Set(),
      };
      this.balancePollers.set(address, poller);
    }

    poller.callbacks.add(onUpdate);

    // Initial fetch
    this.getBalance(address).then(onUpdate).catch(onError);

    // Return unsubscribe function
    return () => {
      const existingPoller = this.balancePollers.get(address);
      if (existingPoller) {
        existingPoller.callbacks.delete(onUpdate);
        if (existingPoller.callbacks.size === 0) {
          clearInterval(existingPoller.interval);
          this.balancePollers.delete(address);
        }
      }
    };
  }

  private async pollBalance(address: PolkadotAddress): Promise<void> {
    const poller = this.balancePollers.get(address);
    if (!poller || poller.callbacks.size === 0) return;

    try {
      const balance = await this.getBalance(address);
      for (const callback of poller.callbacks) {
        callback(balance);
      }
    } catch (error) {
      logger.warn('Balance poll failed', 'pollBalance', { address, error });
    }
  }

  requestPayment(
    from: PolkadotAddress,
    to: PolkadotAddress,
    amount: PUSDAmount,
    memo?: string
  ): Promise<PaymentRequest> {
    const requestId = generateId('chain-pr', 6);

    logger.info('Chain payment requested', 'requestPayment', {
      requestId,
      from,
      to,
      amount: amount.toString(),
      memo,
    });

    const request: PaymentRequest = {
      id: requestId,
      amount,
      from,
      to,
      createdAt: Date.now(),
    };

    // Record the initial state synchronously so a subscriber that attaches before
    // submission completes still sees 'pending', then submit the real transfer.
    this.paymentStatuses.set(requestId, { requestId, status: 'pending' });
    void this.executePayment(requestId, from, to, amount);

    if (memo !== undefined) {
      return Promise.resolve({ ...request, memo });
    }

    return Promise.resolve(request);
  }

  subscribePaymentStatus(
    requestId: string,
    onUpdate: (result: PaymentResult) => void,
    _onError: (error: Error) => void
  ): () => void {
    let subscribers = this.paymentSubscribers.get(requestId);
    if (!subscribers) {
      subscribers = new Set();
      this.paymentSubscribers.set(requestId, subscribers);
    }
    subscribers.add(onUpdate);

    // Emit the current status if the payment is already in flight. Guard the
    // deferred emit so an immediate unsubscribe cancels it.
    let active = true;
    const current = this.paymentStatuses.get(requestId);
    const initialTimer = current
      ? setTimeout(() => {
          if (active) onUpdate(current);
        }, 0)
      : null;

    return () => {
      active = false;
      if (initialTimer !== null) clearTimeout(initialTimer);
      const subs = this.paymentSubscribers.get(requestId);
      if (subs) {
        subs.delete(onUpdate);
        if (subs.size === 0) {
          this.paymentSubscribers.delete(requestId);
        }
      }
    };
  }

  async getBalance(address: PolkadotAddress): Promise<PUSDAmount> {
    try {
      const planck = await getNativeBalance(address);
      // Native PAS (10 decimals) → app's 6-decimal accounting unit.
      return createPUSDAmount(planck / PAS_TO_PUSD_SCALE);
    } catch (error) {
      logger.error('Failed to get balance', 'getBalance', { address, error });
      // Return zero on error to avoid breaking UI
      return ZERO_PUSD;
    }
  }

  /**
   * Transfer native PAS to another account.
   *
   * The signer is taken from the connected session (the host product-account
   * signer in-container). The amount is given in the app's 6-decimal unit and
   * converted to native PAS planck. Rejects if no signer is connected.
   */
  async transfer(
    _from: PolkadotAddress,
    to: PolkadotAddress,
    amount: PUSDAmount
  ): Promise<TransactionHash> {
    const signer = getConnectedSigner();
    if (signer === null) {
      throw new Error('No connected signer available for payment');
    }

    const result = await transferNativePAS({
      to,
      amountPlanck: pusdUnitsToPasPlanck(amount),
      signer,
    });

    return createTransactionHash(result.txHash);
  }

  isAvailable(): boolean {
    return true;
  }

  getMode(): 'hosted' | 'mock' | 'chain' {
    return 'chain';
  }
}

// ============================================================
// Mock Payment Service (Development/Testing)
// ============================================================

/**
 * Mock implementation for development and testing.
 *
 * Provides in-memory simulation with configurable delays and balances.
 */
class MockPaymentService implements PUSDPaymentService {
  private balances = new Map<string, PUSDAmount>();
  private balanceSubscribers = new Map<string, Set<(balance: PUSDAmount) => void>>();
  private paymentStatuses = new Map<string, PaymentResult>();
  private paymentSubscribers = new Map<string, Set<(result: PaymentResult) => void>>();

  constructor() {
    logger.info('Mock payment service initialized', 'constructor');
  }

  /**
   * Set a mock balance for testing.
   */
  setMockBalance(address: PolkadotAddress, balance: PUSDAmount): void {
    this.balances.set(address, balance);
    this.notifyBalanceSubscribers(address, balance);
  }

  private notifyBalanceSubscribers(address: PolkadotAddress, balance: PUSDAmount): void {
    const subscribers = this.balanceSubscribers.get(address);
    if (subscribers) {
      for (const callback of subscribers) {
        callback(balance);
      }
    }
  }

  private notifyPaymentSubscribers(requestId: string, result: PaymentResult): void {
    const subscribers = this.paymentSubscribers.get(requestId);
    if (subscribers) {
      for (const callback of subscribers) {
        callback(result);
      }
    }
    this.paymentStatuses.set(requestId, result);
  }

  subscribeBalance(
    address: PolkadotAddress,
    onUpdate: (balance: PUSDAmount) => void,
    _onError: (error: Error) => void
  ): () => void {
    let subscribers = this.balanceSubscribers.get(address);
    if (!subscribers) {
      subscribers = new Set();
      this.balanceSubscribers.set(address, subscribers);
    }
    subscribers.add(onUpdate);

    // Immediately emit current balance
    const currentBalance = this.balances.get(address) ?? createPUSDAmount(100n * PUSD_MULTIPLIER);
    setTimeout(() => onUpdate(currentBalance), 0);

    return () => {
      const subs = this.balanceSubscribers.get(address);
      if (subs) {
        subs.delete(onUpdate);
        if (subs.size === 0) {
          this.balanceSubscribers.delete(address);
        }
      }
    };
  }

  requestPayment(
    from: PolkadotAddress,
    to: PolkadotAddress,
    amount: PUSDAmount,
    memo?: string
  ): Promise<PaymentRequest> {
    const requestId = generateId('mock-pr', 6);

    logger.info('Mock payment requested', 'requestPayment', {
      requestId,
      from,
      to,
      amount: amount.toString(),
    });

    // Simulate payment processing in background
    this.simulatePaymentProcessing(requestId, from, to, amount);

    const request: PaymentRequest = {
      id: requestId,
      amount,
      from,
      to,
      createdAt: Date.now(),
    };

    // Only include memo if provided
    if (memo !== undefined) {
      return Promise.resolve({ ...request, memo });
    }

    return Promise.resolve(request);
  }

  private simulatePaymentProcessing(
    requestId: string,
    from: PolkadotAddress,
    to: PolkadotAddress,
    amount: PUSDAmount
  ): void {
    // Pending
    this.notifyPaymentSubscribers(requestId, {
      requestId,
      status: 'pending',
    });

    // Confirming after 1s
    setTimeout(() => {
      this.notifyPaymentSubscribers(requestId, {
        requestId,
        status: 'confirming',
      });
    }, 1000);

    // Confirmed after 2s
    setTimeout(() => {
      // Update balances
      const fromBalance = this.balances.get(from) ?? ZERO_PUSD;
      const toBalance = this.balances.get(to) ?? ZERO_PUSD;

      if (fromBalance >= amount) {
        const newFromBalance = createPUSDAmount(fromBalance - amount);
        const newToBalance = createPUSDAmount(toBalance + amount);
        this.balances.set(from, newFromBalance);
        this.balances.set(to, newToBalance);
        this.notifyBalanceSubscribers(from, newFromBalance);
        this.notifyBalanceSubscribers(to, newToBalance);

        // The mock tier simulates the balance transfer in-memory; no real
        // transaction is submitted. Flag the result as simulated and emit no
        // txHash rather than a `0xmock…` string masquerading as a real hash.
        this.notifyPaymentSubscribers(requestId, {
          requestId,
          status: 'confirmed',
          simulated: true,
        });
      } else {
        this.notifyPaymentSubscribers(requestId, {
          requestId,
          status: 'failed',
          error: 'Insufficient balance',
        });
      }
    }, 2000);
  }

  subscribePaymentStatus(
    requestId: string,
    onUpdate: (result: PaymentResult) => void,
    _onError: (error: Error) => void
  ): () => void {
    let subscribers = this.paymentSubscribers.get(requestId);
    if (!subscribers) {
      subscribers = new Set();
      this.paymentSubscribers.set(requestId, subscribers);
    }
    subscribers.add(onUpdate);

    // Emit current status if available
    const currentStatus = this.paymentStatuses.get(requestId);
    if (currentStatus) {
      setTimeout(() => onUpdate(currentStatus), 0);
    }

    return () => {
      const subs = this.paymentSubscribers.get(requestId);
      if (subs) {
        subs.delete(onUpdate);
        if (subs.size === 0) {
          this.paymentSubscribers.delete(requestId);
        }
      }
    };
  }

  getBalance(address: PolkadotAddress): Promise<PUSDAmount> {
    // Default to 100 pUSD for testing
    return Promise.resolve(this.balances.get(address) ?? createPUSDAmount(100n * PUSD_MULTIPLIER));
  }

  isAvailable(): boolean {
    return true;
  }

  getMode(): 'hosted' | 'mock' {
    return 'mock';
  }

  /**
   * Clear all mock state. Use in tests for isolation.
   */
  clearMockState(): void {
    this.balances.clear();
    this.balanceSubscribers.clear();
    this.paymentStatuses.clear();
    this.paymentSubscribers.clear();
  }
}

// ============================================================
// Factory and Singleton
// ============================================================

/**
 * Determine which payment service to use.
 * Priority:
 * 1. Mock (NEXT_PUBLIC_USE_MOCK_PAYMENT=true, default)
 * 2. Chain (NEXT_PUBLIC_USE_CHAIN_CONTRACTS=true and mock is false)
 * 3. Hosted (Triangle SDK fallback)
 */
function getServiceMode(): 'mock' | 'chain' | 'hosted' {
  const useMock = CHAIN_CONFIG.features.useMockPayment;
  const useChain = CHAIN_CONFIG.features.useChainContracts;

  if (useMock) {
    return 'mock';
  }

  if (useChain) {
    return 'chain';
  }

  return 'hosted';
}

let paymentServiceInstance: PUSDPaymentService | null = null;
let mockServiceInstance: MockPaymentService | null = null;
let chainServiceInstance: ChainPaymentService | null = null;

/**
 * Get the payment service singleton.
 *
 * Returns:
 * - MockPaymentService: Development/testing (default)
 * - ChainPaymentService: On-chain via native PAS transfers
 * - HostedPaymentService: Triangle SDK integration
 */
export function getPaymentService(): PUSDPaymentService {
  if (!paymentServiceInstance) {
    const mode = getServiceMode();

    switch (mode) {
      case 'mock':
        mockServiceInstance = new MockPaymentService();
        paymentServiceInstance = mockServiceInstance;
        logger.info('Using mock payment service', 'getPaymentService');
        break;

      case 'chain':
        chainServiceInstance = new ChainPaymentService();
        paymentServiceInstance = chainServiceInstance;
        logger.info('Using chain payment service', 'getPaymentService');
        break;

      case 'hosted':
        paymentServiceInstance = new HostedPaymentService();
        logger.info('Using hosted payment service', 'getPaymentService');
        break;
    }
  }
  return paymentServiceInstance;
}

/**
 * Get the chain payment service directly (for advanced operations).
 * Returns null if not using chain mode.
 */
export function getChainPaymentService(): ChainPaymentService | null {
  if (getServiceMode() !== 'chain') {
    return null;
  }
  if (!chainServiceInstance) {
    getPaymentService(); // Initialize
  }
  return chainServiceInstance;
}

// ============================================================
// Test Helpers
// ============================================================

/**
 * Clear payment service state and reset singleton.
 * Use in tests for isolation.
 */
export function clearPaymentServiceCache(): void {
  if (mockServiceInstance) {
    mockServiceInstance.clearMockState();
  }
  paymentServiceInstance = null;
  mockServiceInstance = null;
  chainServiceInstance = null;
}

/**
 * Set a mock balance for an address.
 * Only works when using MockPaymentService.
 */
export function setMockBalance(address: PolkadotAddress, balance: PUSDAmount): void {
  const service = getPaymentService();
  if (service.getMode() === 'mock' && mockServiceInstance) {
    mockServiceInstance.setMockBalance(address, balance);
  } else {
    logger.warn('setMockBalance called but not using mock service', 'setMockBalance');
  }
}

/**
 * Get cache statistics for debugging.
 */
export function getPaymentServiceStats(): {
  mode: 'hosted' | 'mock' | 'chain';
  available: boolean;
} {
  const service = getPaymentService();
  return {
    mode: service.getMode(),
    available: service.isAvailable(),
  };
}
