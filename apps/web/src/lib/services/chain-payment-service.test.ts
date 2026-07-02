/**
 * Routing / unit tests for ChainPaymentService (the native-PAS payment path).
 *
 * SCOPE: This is NOT an on-chain integration test. The `transferNativePAS`
 * primitive and the connected-signer accessor are mocked at the module
 * boundary, so no real extrinsic is submitted. What is verified here is the
 * service's own logic around that boundary: that requestPayment routes to
 * transferNativePAS with the correctly-converted planck amount and the
 * connected signer, that it fails closed when no signer is present, that a
 * rejected transfer drives the payment to 'failed', and that status/balance
 * are reported from the (mocked) primitive's result. The genuine extrinsic
 * submission lives in `transferNativePAS` and is out of scope here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPolkadotAddress, createPUSDAmount } from '@cocuyo/types';
import type { PaymentResult } from './pusd-payment-service';

// Mock the native transfer primitive and the connected-signer accessor.
vi.mock('../chain/native-payment', async () => {
  const actual =
    await vi.importActual<typeof import('../chain/native-payment')>('../chain/native-payment');
  return {
    ...actual,
    transferNativePAS: vi.fn(),
    getNativeBalance: vi.fn(),
  };
});
vi.mock('./service-utils', async () => {
  const actual = await vi.importActual<typeof import('./service-utils')>('./service-utils');
  return {
    ...actual,
    getConnectedSigner: vi.fn(),
  };
});

import { ChainPaymentService } from './pusd-payment-service';
import { transferNativePAS, getNativeBalance, pusdUnitsToPasPlanck } from '../chain/native-payment';
import { getConnectedSigner } from './service-utils';

const mockTransfer = vi.mocked(transferNativePAS);
const mockNativeBalance = vi.mocked(getNativeBalance);
const mockSigner = vi.mocked(getConnectedSigner);

const FROM = createPolkadotAddress('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
const TO = createPolkadotAddress('5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty');
const SIGNER = { publicKey: new Uint8Array() } as never;

/** Subscribe and resolve once the payment reaches a terminal status. */
function awaitTerminalStatus(
  service: ChainPaymentService,
  requestId: string
): Promise<PaymentResult[]> {
  return new Promise((resolve) => {
    const seen: PaymentResult[] = [];
    const unsub = service.subscribePaymentStatus(
      requestId,
      (result) => {
        seen.push(result);
        if (result.status === 'confirmed' || result.status === 'failed') {
          unsub();
          resolve(seen);
        }
      },
      () => undefined
    );
  });
}

describe('ChainPaymentService (native PAS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes to transferNativePAS with the planck-converted amount and the connected signer, then confirms with the returned tx hash', async () => {
    mockSigner.mockReturnValue(SIGNER);
    mockTransfer.mockResolvedValue({ txHash: '0xabc', blockHash: '0xblock' });
    const service = new ChainPaymentService();

    const amount = createPUSDAmount(1_000_000n);
    const request = await service.requestPayment(FROM, TO, amount);
    const statuses = await awaitTerminalStatus(service, request.id);

    expect(mockTransfer).toHaveBeenCalledTimes(1);
    expect(mockTransfer).toHaveBeenCalledWith({
      to: TO,
      amountPlanck: pusdUnitsToPasPlanck(amount),
      signer: SIGNER,
    });
    const last = statuses[statuses.length - 1];
    expect(last?.status).toBe('confirmed');
    expect(last?.txHash).toBe('0xabc');
  });

  it('passes through a non-terminal "confirming" status before confirming the transfer', async () => {
    mockSigner.mockReturnValue(SIGNER);
    // Hold the transfer open so the 'confirming' status is observable, then release it.
    let release!: (v: { txHash: string; blockHash: string }) => void;
    mockTransfer.mockReturnValue(
      new Promise((r) => {
        release = r;
      })
    );
    const service = new ChainPaymentService();

    const request = await service.requestPayment(FROM, TO, createPUSDAmount(1_000_000n));
    const statuses: PaymentResult[] = [];
    const unsub = service.subscribePaymentStatus(
      request.id,
      (r) => statuses.push(r),
      () => undefined
    );
    // Let the deferred current-status emit fire while the transfer is still in flight.
    await new Promise((r) => setTimeout(r, 0));
    expect(statuses.map((s) => s.status)).toContain('confirming');

    release({ txHash: '0xabc', blockHash: '0xblock' });
    await new Promise((r) => setTimeout(r, 0));
    expect(statuses[statuses.length - 1]?.status).toBe('confirmed');
    unsub();
  });

  it('records pending synchronously and threads the memo onto the request', async () => {
    mockSigner.mockReturnValue(SIGNER);
    // Never resolve the transfer so the request stays pre-terminal.
    mockTransfer.mockReturnValue(new Promise(() => undefined));
    const service = new ChainPaymentService();

    const request = await service.requestPayment(FROM, TO, createPUSDAmount(1_000_000n), 'rent');
    expect(request.memo).toBe('rent');

    // A subscriber attaching after the request still receives the recorded pending state.
    const seen: PaymentResult[] = [];
    const unsub = service.subscribePaymentStatus(
      request.id,
      (r) => seen.push(r),
      () => undefined
    );
    await new Promise((r) => setTimeout(r, 0));
    unsub();
    expect(seen.some((s) => s.status === 'pending' || s.status === 'confirming')).toBe(true);
  });

  it('fails closed when no signer is connected', async () => {
    mockSigner.mockReturnValue(null);
    const service = new ChainPaymentService();

    const request = await service.requestPayment(FROM, TO, createPUSDAmount(1_000_000n));
    const statuses = await awaitTerminalStatus(service, request.id);

    expect(mockTransfer).not.toHaveBeenCalled();
    const last = statuses[statuses.length - 1];
    expect(last?.status).toBe('failed');
    expect(last?.error).toContain('signer');
  });

  it('marks the payment failed when the transfer rejects', async () => {
    mockSigner.mockReturnValue(SIGNER);
    mockTransfer.mockRejectedValue(new Error('Native PAS transfer failed on chain'));
    const service = new ChainPaymentService();

    const request = await service.requestPayment(FROM, TO, createPUSDAmount(1_000_000n));
    const statuses = await awaitTerminalStatus(service, request.id);

    const last = statuses[statuses.length - 1];
    expect(last?.status).toBe('failed');
    expect(last?.error).toContain('failed on chain');
  });

  it('reports the native balance converted to the 6-decimal accounting unit', async () => {
    // 50_000_000_000 planck (10 decimals) = 5_000_000 units (6 decimals).
    mockNativeBalance.mockResolvedValue(50_000_000_000n);
    const service = new ChainPaymentService();

    const balance = await service.getBalance(FROM);
    expect(balance).toBe(createPUSDAmount(5_000_000n));
  });

  it('returns a zero balance (does not throw) when the chain balance read fails', async () => {
    mockNativeBalance.mockRejectedValue(new Error('node unreachable'));
    const service = new ChainPaymentService();

    // Fails soft so the UI does not break; never surfaces the raw chain error.
    const balance = await service.getBalance(FROM);
    expect(balance).toBe(createPUSDAmount(0n));
  });

  it('reports its mode as "chain" and is always available', () => {
    const service = new ChainPaymentService();
    expect(service.getMode()).toBe('chain');
    expect(service.isAvailable()).toBe(true);
  });
});
