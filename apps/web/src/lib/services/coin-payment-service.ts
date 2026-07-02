/**
 * CoinPayment Service (RFC 0017)
 *
 * Provides firewalled dotUSD purse management. Products never see coin secrets,
 * derivation paths, or raw proofs.
 *
 * Two implementations:
 * - MockCoinPaymentService: In-memory mock for development/testing
 * - HostedCoinPaymentService: Uses Host API via host-api-wrapper
 */

import type {
  CoinPaymentService,
  CoinPaymentResult,
  CoinPaymentPurseId,
  CoinPaymentPurseInfo,
  CoinPaymentBalance,
  CoinPaymentReceivable,
  CoinPaymentCheque,
  CoinPaymentStatus,
  CoinPaymentListenItem,
} from '@cocuyo/types';
import {
  MAIN_PURSE,
  MAX_PURSES,
  createCoinPaymentPurseId,
  createCoinPaymentBalance,
  createCoinPaymentReceivable,
} from '@cocuyo/types';
import { isInContainer, getAccountsProvider } from '../host/detect';
import { ok, err } from '@cocuyo/types';

// ============================================================================
// Mock Implementation
// ============================================================================

interface MockPurse {
  id: CoinPaymentPurseId;
  name: string;
  balance: CoinPaymentBalance;
}

interface MockReceivable {
  address: CoinPaymentReceivable;
  purseId: CoinPaymentPurseId;
  createdAt: number;
}

/**
 * Mock CoinPayment service for development and testing.
 * Simulates purse operations with realistic delays and error conditions.
 */
export class MockCoinPaymentService implements CoinPaymentService {
  private purses = new Map<number, MockPurse>();
  private receivables = new Map<string, MockReceivable>();
  private nextPurseId = 1;

  constructor() {
    // Initialize with main purse
    this.purses.set(MAIN_PURSE, {
      id: MAIN_PURSE,
      name: 'Main Purse',
      balance: createCoinPaymentBalance(10000), // $100.00
    });
  }

  async createPurse(name: string): Promise<CoinPaymentResult<CoinPaymentPurseId>> {
    await this.simulateDelay(100);

    if (this.purses.size >= MAX_PURSES) {
      return err({ type: 'Denied', reason: `Maximum of ${MAX_PURSES} purses allowed` });
    }

    if (name.length > 64) {
      return err({ type: 'Denied', reason: 'Purse name must be 64 characters or less' });
    }

    const id = createCoinPaymentPurseId(this.nextPurseId++);
    this.purses.set(id, {
      id,
      name,
      balance: createCoinPaymentBalance(0),
    });

    return ok(id);
  }

  async queryPurse(purse: CoinPaymentPurseId): Promise<CoinPaymentResult<CoinPaymentPurseInfo>> {
    await this.simulateDelay(50);

    const p = this.purses.get(purse);
    if (!p) {
      return err({ type: 'PurseNotFound', purseId: purse });
    }

    return ok({
      id: p.id,
      name: p.name,
      balance: p.balance,
    });
  }

  async listPurses(): Promise<CoinPaymentResult<readonly CoinPaymentPurseInfo[]>> {
    await this.simulateDelay(50);

    const purses = Array.from(this.purses.values()).map((p) => ({
      id: p.id,
      name: p.name,
      balance: p.balance,
    }));

    return ok(purses);
  }

  async *rebalancePurse(
    from: CoinPaymentPurseId,
    to: CoinPaymentPurseId,
    amount: CoinPaymentBalance
  ): AsyncIterable<CoinPaymentStatus> {
    yield { type: 'clearing' };
    await this.simulateDelay(500);

    const fromPurse = this.purses.get(from);
    const toPurse = this.purses.get(to);

    if (!fromPurse) {
      yield { type: 'failed', error: { type: 'PurseNotFound', purseId: from } };
      return;
    }

    if (!toPurse) {
      yield { type: 'failed', error: { type: 'PurseNotFound', purseId: to } };
      return;
    }

    if (fromPurse.balance < amount) {
      yield {
        type: 'failed',
        error: {
          type: 'BalanceLow',
          available: fromPurse.balance,
          required: amount,
        },
      };
      return;
    }

    // Perform transfer
    fromPurse.balance = createCoinPaymentBalance(fromPurse.balance - amount);
    toPurse.balance = createCoinPaymentBalance(toPurse.balance + amount);

    yield {
      type: 'done',
      reference: {
        txHash: `0x${this.randomHex(64)}`,
        blockNumber: Math.floor(Math.random() * 1000000),
        timestamp: Date.now(),
      },
    };
  }

  async *deletePurse(
    target: CoinPaymentPurseId,
    drainInto: CoinPaymentPurseId
  ): AsyncIterable<CoinPaymentStatus> {
    yield { type: 'clearing' };
    await this.simulateDelay(500);

    if (target === MAIN_PURSE) {
      yield { type: 'failed', error: { type: 'Denied', reason: 'Cannot delete main purse' } };
      return;
    }

    const targetPurse = this.purses.get(target);
    const drainPurse = this.purses.get(drainInto);

    if (!targetPurse) {
      yield { type: 'failed', error: { type: 'PurseNotFound', purseId: target } };
      return;
    }

    if (!drainPurse) {
      yield { type: 'failed', error: { type: 'PurseNotFound', purseId: drainInto } };
      return;
    }

    // Drain and delete
    drainPurse.balance = createCoinPaymentBalance(drainPurse.balance + targetPurse.balance);
    this.purses.delete(target);

    yield {
      type: 'done',
      reference: {
        txHash: `0x${this.randomHex(64)}`,
        blockNumber: Math.floor(Math.random() * 1000000),
        timestamp: Date.now(),
      },
    };
  }

  async createReceivable(
    intoPurse: CoinPaymentPurseId
  ): Promise<CoinPaymentResult<CoinPaymentReceivable>> {
    await this.simulateDelay(100);

    if (!this.purses.has(intoPurse)) {
      return err({ type: 'PurseNotFound', purseId: intoPurse });
    }

    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const address = createCoinPaymentReceivable(bytes);

    this.receivables.set(this.bytesToHex(bytes), {
      address,
      purseId: intoPurse,
      createdAt: Date.now(),
    });

    return ok(address);
  }

  async createCheque(
    from: CoinPaymentPurseId,
    to: CoinPaymentReceivable,
    amount: CoinPaymentBalance
  ): Promise<CoinPaymentResult<CoinPaymentCheque>> {
    await this.simulateDelay(100);

    const fromPurse = this.purses.get(from);
    if (!fromPurse) {
      return err({ type: 'PurseNotFound', purseId: from });
    }

    if (fromPurse.balance < amount) {
      return err({
        type: 'BalanceLow',
        available: fromPurse.balance,
        required: amount,
      });
    }

    // Generate encrypted data (mock)
    const encryptedData = new Uint8Array(64);
    crypto.getRandomValues(encryptedData);

    return ok({
      from,
      to,
      amount,
      encryptedData,
    });
  }

  async *deposit(cheque: CoinPaymentCheque): AsyncIterable<CoinPaymentStatus> {
    yield { type: 'clearing' };
    await this.simulateDelay(500);

    const receivableKey = this.bytesToHex(cheque.to as Uint8Array);
    const receivable = this.receivables.get(receivableKey);

    if (!receivable) {
      yield { type: 'failed', error: { type: 'ReceivableNotFound' } };
      return;
    }

    const purse = this.purses.get(receivable.purseId);
    if (!purse) {
      yield { type: 'failed', error: { type: 'PurseNotFound', purseId: receivable.purseId } };
      return;
    }

    // Credit the purse
    purse.balance = createCoinPaymentBalance(purse.balance + cheque.amount);

    // Clean up receivable (one-time use)
    this.receivables.delete(receivableKey);

    yield {
      type: 'done',
      reference: {
        txHash: `0x${this.randomHex(64)}`,
        blockNumber: Math.floor(Math.random() * 1000000),
        timestamp: Date.now(),
      },
    };
  }

  async *refund(receivable: CoinPaymentReceivable): AsyncIterable<CoinPaymentStatus> {
    yield { type: 'clearing' };
    await this.simulateDelay(300);

    const receivableKey = this.bytesToHex(receivable as Uint8Array);
    if (!this.receivables.has(receivableKey)) {
      yield { type: 'failed', error: { type: 'ReceivableNotFound' } };
      return;
    }

    // Remove receivable
    this.receivables.delete(receivableKey);

    yield {
      type: 'done',
      reference: {
        txHash: `0x${this.randomHex(64)}`,
        blockNumber: Math.floor(Math.random() * 1000000),
        timestamp: Date.now(),
      },
    };
  }

  async *listenForPayment(receivable: CoinPaymentReceivable): AsyncIterable<CoinPaymentListenItem> {
    // Mock: Wait a bit then yield a simulated payment
    await this.simulateDelay(2000);

    yield {
      channel: 'standard',
      cheque: {
        from: MAIN_PURSE,
        to: receivable,
        amount: createCoinPaymentBalance(500), // $5.00
        encryptedData: new Uint8Array(64),
      },
    };
  }

  // Test helpers
  setBalance(purseId: CoinPaymentPurseId, balance: number): void {
    const purse = this.purses.get(purseId);
    if (purse) {
      purse.balance = createCoinPaymentBalance(balance);
    }
  }

  reset(): void {
    this.purses.clear();
    this.receivables.clear();
    this.nextPurseId = 1;
    this.purses.set(MAIN_PURSE, {
      id: MAIN_PURSE,
      name: 'Main Purse',
      balance: createCoinPaymentBalance(10000),
    });
  }

  private async simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private randomHex(length: number): string {
    const bytes = new Uint8Array(length / 2);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

// ============================================================================
// Hosted Implementation (Host API)
// ============================================================================

/**
 * Hosted CoinPayment service that uses the Triangle Host API.
 * Requires host-api-wrapper.
 */
export class HostedCoinPaymentService implements CoinPaymentService {
  createPurse(_name: string): Promise<CoinPaymentResult<CoinPaymentPurseId>> {
    const provider = getAccountsProvider();
    if (!provider) {
      return Promise.resolve(err({ type: 'UserAgentCapabilityUnavailable' }));
    }

    // TODO: Use actual Host API when available (host-api-wrapper)
    // const result = await provider.coinPayment.createPurse(name);
    // return ok(createCoinPaymentPurseId(result.id));
    return Promise.resolve(err({ type: 'UserAgentCapabilityUnavailable' }));
  }

  queryPurse(_purse: CoinPaymentPurseId): Promise<CoinPaymentResult<CoinPaymentPurseInfo>> {
    const provider = getAccountsProvider();
    if (!provider) {
      return Promise.resolve(err({ type: 'UserAgentCapabilityUnavailable' }));
    }

    // TODO: Use actual Host API when available
    return Promise.resolve(err({ type: 'UserAgentCapabilityUnavailable' }));
  }

  listPurses(): Promise<CoinPaymentResult<readonly CoinPaymentPurseInfo[]>> {
    const provider = getAccountsProvider();
    if (!provider) {
      return Promise.resolve(err({ type: 'UserAgentCapabilityUnavailable' }));
    }

    // TODO: Use actual Host API when available
    return Promise.resolve(err({ type: 'UserAgentCapabilityUnavailable' }));
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface requires an AsyncIterable; streaming via Host API is a pending TODO with no await yet
  async *rebalancePurse(
    _from: CoinPaymentPurseId,
    _to: CoinPaymentPurseId,
    _amount: CoinPaymentBalance
  ): AsyncIterable<CoinPaymentStatus> {
    const provider = getAccountsProvider();
    if (!provider) {
      yield { type: 'failed', error: { type: 'UserAgentCapabilityUnavailable' } };
      return;
    }

    // TODO: Implement streaming via Host API
    yield { type: 'failed', error: { type: 'UserAgentCapabilityUnavailable' } };
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface requires an AsyncIterable; streaming via Host API is a pending TODO with no await yet
  async *deletePurse(
    _target: CoinPaymentPurseId,
    _drainInto: CoinPaymentPurseId
  ): AsyncIterable<CoinPaymentStatus> {
    const provider = getAccountsProvider();
    if (!provider) {
      yield { type: 'failed', error: { type: 'UserAgentCapabilityUnavailable' } };
      return;
    }

    // TODO: Implement streaming via Host API
    yield { type: 'failed', error: { type: 'UserAgentCapabilityUnavailable' } };
  }

  createReceivable(
    _intoPurse: CoinPaymentPurseId
  ): Promise<CoinPaymentResult<CoinPaymentReceivable>> {
    const provider = getAccountsProvider();
    if (!provider) {
      return Promise.resolve(err({ type: 'UserAgentCapabilityUnavailable' }));
    }

    // TODO: Use actual Host API when available
    return Promise.resolve(err({ type: 'UserAgentCapabilityUnavailable' }));
  }

  createCheque(
    _from: CoinPaymentPurseId,
    _to: CoinPaymentReceivable,
    _amount: CoinPaymentBalance
  ): Promise<CoinPaymentResult<CoinPaymentCheque>> {
    const provider = getAccountsProvider();
    if (!provider) {
      return Promise.resolve(err({ type: 'UserAgentCapabilityUnavailable' }));
    }

    // TODO: Use actual Host API when available
    return Promise.resolve(err({ type: 'UserAgentCapabilityUnavailable' }));
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface requires an AsyncIterable; streaming via Host API is a pending TODO with no await yet
  async *deposit(_cheque: CoinPaymentCheque): AsyncIterable<CoinPaymentStatus> {
    const provider = getAccountsProvider();
    if (!provider) {
      yield { type: 'failed', error: { type: 'UserAgentCapabilityUnavailable' } };
      return;
    }

    // TODO: Implement streaming via Host API
    yield { type: 'failed', error: { type: 'UserAgentCapabilityUnavailable' } };
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface requires an AsyncIterable; streaming via Host API is a pending TODO with no await yet
  async *refund(_receivable: CoinPaymentReceivable): AsyncIterable<CoinPaymentStatus> {
    const provider = getAccountsProvider();
    if (!provider) {
      yield { type: 'failed', error: { type: 'UserAgentCapabilityUnavailable' } };
      return;
    }

    // TODO: Implement streaming via Host API
    yield { type: 'failed', error: { type: 'UserAgentCapabilityUnavailable' } };
  }

  // eslint-disable-next-line require-yield, @typescript-eslint/require-await -- interface requires an AsyncIterable; streaming via Host API is a pending TODO with no yield/await yet
  async *listenForPayment(
    _receivable: CoinPaymentReceivable
  ): AsyncIterable<CoinPaymentListenItem> {
    const provider = getAccountsProvider();
    if (!provider) {
      return;
    }

    // TODO: Implement streaming via Host API
    // This method will yield items when host API provides them
  }
}

// ============================================================================
// Factory
// ============================================================================

let _mockService: MockCoinPaymentService | null = null;
let _hostedService: HostedCoinPaymentService | null = null;

/**
 * Create a CoinPayment service instance.
 * Returns HostedCoinPaymentService if in host environment, MockCoinPaymentService otherwise.
 */
export function createCoinPaymentService(): CoinPaymentService {
  if (isInContainer()) {
    _hostedService ??= new HostedCoinPaymentService();
    return _hostedService;
  }

  _mockService ??= new MockCoinPaymentService();
  return _mockService;
}

/**
 * Get the mock service directly (for testing).
 */
export function getMockCoinPaymentService(): MockCoinPaymentService {
  _mockService ??= new MockCoinPaymentService();
  return _mockService;
}

/**
 * Check if CoinPayment service is available.
 * Returns true in mock mode, or if Host API is available.
 */
export function isCoinPaymentAvailable(): boolean {
  if (!isInContainer()) {
    return true; // Mock is always available
  }
  return getAccountsProvider() !== null;
}
