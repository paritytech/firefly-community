/**
 * Tests for the payment router's on-chain native-PAS helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPUSDAmount, createTransactionHash } from '@cocuyo/types';
import type { PolkadotAddress, PUSDAmount } from '@cocuyo/types';
import type { PaymentRequest, PaymentResult, PUSDPaymentService } from './pusd-payment-service';

const mockConfig = vi.hoisted(() => ({
  CHAIN_CONFIG: { payments: { recipient: undefined as string | undefined } },
}));

vi.mock('../chain/config', () => mockConfig);
vi.mock('./pusd-payment-service', () => ({ getPaymentService: vi.fn() }));
vi.mock('./service-utils', () => ({ getConnectedWallet: vi.fn() }));
vi.mock('./coinage-service', () => ({ getCoinageService: vi.fn() }));

import { isOnChainPaymentActive, payToRecipient } from './payment-router-service';
import { getPaymentService } from './pusd-payment-service';
import { getConnectedWallet } from './service-utils';

const mockGetService = vi.mocked(getPaymentService);
const mockGetWallet = vi.mocked(getConnectedWallet);

const RECIPIENT = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const WALLET = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

/** A fake payment service whose status subscription emits a terminal result. */
function fakeService(opts: {
  mode?: 'mock' | 'chain';
  terminal?: PaymentResult;
}): PUSDPaymentService {
  return {
    getMode: () => opts.mode ?? 'chain',
    requestPayment: (from, to, amount): Promise<PaymentRequest> =>
      Promise.resolve({ id: 'req-1', from, to, amount, createdAt: 0 }),
    subscribePaymentStatus: (_requestId, onUpdate) => {
      const { terminal } = opts;
      if (terminal) {
        setTimeout(() => onUpdate(terminal), 0);
      }
      return () => undefined;
    },
    subscribeBalance: () => () => undefined,
    getBalance: () => Promise.resolve(createPUSDAmount(0n)),
    isAvailable: () => true,
  };
}

describe('isOnChainPaymentActive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.CHAIN_CONFIG.payments.recipient = undefined;
  });

  it('is true only when in chain mode AND a recipient is configured', () => {
    mockGetService.mockReturnValue(fakeService({ mode: 'chain' }));
    mockConfig.CHAIN_CONFIG.payments.recipient = RECIPIENT;
    expect(isOnChainPaymentActive()).toBe(true);
  });

  it('is false when no recipient is configured', () => {
    mockGetService.mockReturnValue(fakeService({ mode: 'chain' }));
    mockConfig.CHAIN_CONFIG.payments.recipient = undefined;
    expect(isOnChainPaymentActive()).toBe(false);
  });

  it('is false when not in chain mode', () => {
    mockGetService.mockReturnValue(fakeService({ mode: 'mock' }));
    mockConfig.CHAIN_CONFIG.payments.recipient = RECIPIENT;
    expect(isOnChainPaymentActive()).toBe(false);
  });
});

describe('payToRecipient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.CHAIN_CONFIG.payments.recipient = RECIPIENT;
  });

  it('fails closed when no recipient is configured', async () => {
    mockConfig.CHAIN_CONFIG.payments.recipient = undefined;
    mockGetWallet.mockReturnValue(WALLET);
    mockGetService.mockReturnValue(fakeService({}));

    const result = await payToRecipient(createPUSDAmount(1_000_000n));
    expect(result.ok).toBe(false);
  });

  it('fails closed when no wallet is connected', async () => {
    mockGetWallet.mockReturnValue(null);
    mockGetService.mockReturnValue(fakeService({}));

    const result = await payToRecipient(createPUSDAmount(1_000_000n));
    expect(result.ok).toBe(false);
  });

  it('returns the confirmed tx hash on success and forwards wallet/recipient/amount', async () => {
    mockGetWallet.mockReturnValue(WALLET);
    // Standalone spy (not an object-method reference) so we can assert its args.
    const requestPaymentSpy = vi.fn(
      (from: PolkadotAddress, to: PolkadotAddress, amount: PUSDAmount): Promise<PaymentRequest> =>
        Promise.resolve({ id: 'req-1', from, to, amount, createdAt: 0 })
    );
    const service: PUSDPaymentService = {
      getMode: () => 'chain',
      requestPayment: requestPaymentSpy,
      subscribePaymentStatus: (_requestId, onUpdate) => {
        setTimeout(
          () =>
            onUpdate({
              requestId: 'req-1',
              status: 'confirmed',
              txHash: createTransactionHash('0xfeed'),
            }),
          0
        );
        return () => undefined;
      },
      subscribeBalance: () => () => undefined,
      getBalance: () => Promise.resolve(createPUSDAmount(0n)),
      isAvailable: () => true,
    };
    mockGetService.mockReturnValue(service);

    const amount = createPUSDAmount(1_000_000n);
    const result = await payToRecipient(amount);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('0xfeed');
    // Guard against sending to the wrong recipient/amount.
    expect(requestPaymentSpy).toHaveBeenCalledWith(WALLET, RECIPIENT, amount, undefined);
  });

  it('propagates a failed payment as an error result', async () => {
    mockGetWallet.mockReturnValue(WALLET);
    mockGetService.mockReturnValue(
      fakeService({ terminal: { requestId: 'req-1', status: 'failed', error: 'boom' } })
    );

    const result = await payToRecipient(createPUSDAmount(1_000_000n));
    expect(result.ok).toBe(false);
  });
});
