/**
 * Tests for pUSD Payment Service.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getPaymentService,
  clearPaymentServiceCache,
  setMockBalance,
  getPaymentServiceStats,
  type PaymentStatus,
} from './pusd-payment-service';
import { createPolkadotAddress, createPUSDAmount } from '@cocuyo/types';
import type { PolkadotAddress, PUSDAmount } from '@cocuyo/types';

describe('PUSDPaymentService', () => {
  let testAddress: PolkadotAddress;
  let recipientAddress: PolkadotAddress;

  beforeEach(() => {
    clearPaymentServiceCache();
    testAddress = createPolkadotAddress('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
    recipientAddress = createPolkadotAddress('5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty');
  });

  afterEach(() => {
    clearPaymentServiceCache();
  });

  describe('getPaymentService', () => {
    it('returns a singleton instance', () => {
      const service1 = getPaymentService();
      const service2 = getPaymentService();
      expect(service1).toBe(service2);
    });

    it('returns mock service by default', () => {
      const service = getPaymentService();
      expect(service.getMode()).toBe('mock');
    });

    it('reports as available', () => {
      const service = getPaymentService();
      expect(service.isAvailable()).toBe(true);
    });
  });

  describe('getPaymentServiceStats', () => {
    it('returns correct stats for mock service', () => {
      const stats = getPaymentServiceStats();
      expect(stats.mode).toBe('mock');
      expect(stats.available).toBe(true);
    });
  });

  describe('getBalance', () => {
    it('returns default balance for unknown address', async () => {
      const service = getPaymentService();
      const balance = await service.getBalance(testAddress);

      // Default mock balance is 100 pUSD
      expect(balance).toBe(createPUSDAmount(100_000_000n));
    });

    it('returns set mock balance', async () => {
      const service = getPaymentService();
      const mockBalance = createPUSDAmount(500_000_000n); // 500 pUSD

      setMockBalance(testAddress, mockBalance);
      const balance = await service.getBalance(testAddress);

      expect(balance).toBe(mockBalance);
    });
  });

  describe('subscribeBalance', () => {
    it('emits initial balance immediately', async () => {
      const service = getPaymentService();
      const mockBalance = createPUSDAmount(250_000_000n); // 250 pUSD
      setMockBalance(testAddress, mockBalance);

      const updates: PUSDAmount[] = [];
      const errors: Error[] = [];

      const unsubscribe = service.subscribeBalance(
        testAddress,
        (balance) => updates.push(balance),
        (error) => errors.push(error)
      );

      // Wait for async update
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(updates).toHaveLength(1);
      expect(updates[0]).toBe(mockBalance);
      expect(errors).toHaveLength(0);

      unsubscribe();
    });

    it('unsubscribes correctly', async () => {
      const service = getPaymentService();

      const updates: PUSDAmount[] = [];
      const unsubscribe = service.subscribeBalance(
        testAddress,
        (balance) => updates.push(balance),
        (_error) => {
          /* error handler */
        }
      );

      // Wait for initial update
      await new Promise((resolve) => setTimeout(resolve, 50));

      const initialCount = updates.length;
      unsubscribe();

      // Update balance after unsubscribe
      setMockBalance(testAddress, createPUSDAmount(999_000_000n));

      // Wait and verify no new updates
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(updates.length).toBe(initialCount);
    });
  });

  describe('requestPayment', () => {
    it('creates a payment request', async () => {
      const service = getPaymentService();
      const amount = createPUSDAmount(10_000_000n); // 10 pUSD

      const request = await service.requestPayment(
        testAddress,
        recipientAddress,
        amount,
        'Test memo'
      );

      expect(request.id).toMatch(/^mock-pr-/);
      expect(request.amount).toBe(amount);
      expect(request.from).toBe(testAddress);
      expect(request.to).toBe(recipientAddress);
      expect(request.memo).toBe('Test memo');
      expect(request.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it('creates unique request IDs', async () => {
      const service = getPaymentService();
      const amount = createPUSDAmount(10_000_000n);

      const request1 = await service.requestPayment(testAddress, recipientAddress, amount);
      const request2 = await service.requestPayment(testAddress, recipientAddress, amount);

      expect(request1.id).not.toBe(request2.id);
    });
  });

  describe('subscribePaymentStatus', () => {
    it('tracks payment through status progression', async () => {
      const service = getPaymentService();
      const amount = createPUSDAmount(10_000_000n); // 10 pUSD

      // Set up sender with sufficient balance
      setMockBalance(testAddress, createPUSDAmount(100_000_000n));

      const request = await service.requestPayment(testAddress, recipientAddress, amount);

      const statuses: PaymentStatus[] = [];
      const unsubscribe = service.subscribePaymentStatus(
        request.id,
        (result) => statuses.push(result.status),
        (_error) => {
          /* error handler */
        }
      );

      // Wait for all status updates (mock takes 2s total)
      await new Promise((resolve) => setTimeout(resolve, 2500));

      expect(statuses).toContain('pending');
      expect(statuses).toContain('confirming');
      expect(statuses).toContain('confirmed');

      unsubscribe();
    });

    it('reports failure for insufficient balance', async () => {
      const service = getPaymentService();
      const amount = createPUSDAmount(1000_000_000n); // 1000 pUSD

      // Set up sender with insufficient balance
      setMockBalance(testAddress, createPUSDAmount(10_000_000n)); // Only 10 pUSD

      const request = await service.requestPayment(testAddress, recipientAddress, amount);

      const results: { status: PaymentStatus; error: string | undefined }[] = [];
      const unsubscribe = service.subscribePaymentStatus(
        request.id,
        (result) => results.push({ status: result.status, error: result.error }),
        (_error) => {
          /* error handler */
        }
      );

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const failedResult = results.find((r) => r.status === 'failed');
      expect(failedResult).toBeDefined();
      expect(failedResult?.error).toBe('Insufficient balance');

      unsubscribe();
    });
  });

  describe('balance updates after payment', () => {
    it('updates sender and recipient balances on successful payment', async () => {
      const service = getPaymentService();
      const initialSenderBalance = createPUSDAmount(100_000_000n); // 100 pUSD
      const initialRecipientBalance = createPUSDAmount(50_000_000n); // 50 pUSD
      const paymentAmount = createPUSDAmount(25_000_000n); // 25 pUSD

      setMockBalance(testAddress, initialSenderBalance);
      setMockBalance(recipientAddress, initialRecipientBalance);

      await service.requestPayment(testAddress, recipientAddress, paymentAmount);

      // Wait for payment to complete
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const senderBalance = await service.getBalance(testAddress);
      const recipientBalance = await service.getBalance(recipientAddress);

      // Sender should have 100 - 25 = 75 pUSD
      expect(senderBalance).toBe(createPUSDAmount(75_000_000n));
      // Recipient should have 50 + 25 = 75 pUSD
      expect(recipientBalance).toBe(createPUSDAmount(75_000_000n));
    });
  });

  describe('clearPaymentServiceCache', () => {
    it('resets all state', async () => {
      getPaymentService();
      setMockBalance(testAddress, createPUSDAmount(999_000_000n));

      clearPaymentServiceCache();

      // Get fresh service
      const freshService = getPaymentService();

      // Should have default balance again
      const balance = await freshService.getBalance(testAddress);
      expect(balance).toBe(createPUSDAmount(100_000_000n));
    });
  });
});
