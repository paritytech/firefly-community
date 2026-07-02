/**
 * Coinage Service Implementation
 *
 * Provides private payment functionality using the Triangle Coinage SDK.
 * Coins are private, untraceable payment tokens that can be transferred
 * off-chain and recycled to maintain privacy.
 *
 * Key concepts:
 * - Onboard: Convert pUSD to private coins via recycler
 * - Transfer: Send coins off-chain using keys/QR codes
 * - Recycle: Reset coin age to maintain privacy (uses claim tokens)
 * - Offboard: Convert private coins back to pUSD
 *
 * This service requires initialization with a DIM credential to create
 * a namespace-scoped coinage context.
 */

import type {
  CoinageService,
  CoinageError,
  Coin,
  CoinWallet,
  CoinExponent,
  RecyclerVoucher,
  RecyclerClaimToken,
  TransferPackage,
  ClaimTokenAllocation,
  DIMCredential,
  PolkadotAddress,
  TransactionHash,
  PUSDAmount,
  Result,
} from '@cocuyo/types';
import {
  ok,
  err,
  createEmptyCoinWallet,
  createTransactionHash,
  createCoinPublicKey,
  decomposeAmountCents,
  toPUSDCents,
  COIN_VALUES_CENTS,
} from '@cocuyo/types';
import { createLogger } from '../logging';
import { storage } from '../host/storage';
import { generateId } from './service-utils';

const logger = createLogger('CoinageService');

// ============================================================
// Types
// ============================================================

export type { CoinageError } from '@cocuyo/types';

/** Storage key for wallet state */
const WALLET_STORAGE_KEY = 'coinage-wallet';
const TRANSFERS_STORAGE_KEY = 'coinage-transfers';

/** Simple transfer record for mock storage */
interface TransferRecord {
  readonly id: string;
  readonly keys: readonly string[];
  readonly exponents: readonly CoinExponent[];
  readonly totalValueCents: number;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly claimed: boolean;
}

// ============================================================
// Mock Coinage Service
// ============================================================

/**
 * Mock implementation of CoinageService for development.
 *
 * Stores coin state in localStorage for persistence across sessions.
 * Real implementation would use the Triangle Coinage SDK.
 */
export class MockCoinageService implements CoinageService {
  private wallet: CoinWallet = createEmptyCoinWallet();
  private transfers: TransferRecord[] = [];
  private nextDerivationIndex = 0;
  private initPromise: Promise<void>;
  private initialized = false;

  constructor() {
    this.initPromise = this.loadFromStorage().then(() => {
      this.initialized = true;
    });
  }

  /** Ensure storage is loaded before operations */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initPromise;
    }
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const savedWallet = await storage.read<CoinWallet>(WALLET_STORAGE_KEY);
      if (savedWallet) {
        this.wallet = savedWallet;
        this.nextDerivationIndex = savedWallet.nextDerivationIndex;
      }

      const savedTransfers = await storage.read<TransferRecord[]>(TRANSFERS_STORAGE_KEY);
      if (savedTransfers) {
        this.transfers = savedTransfers;
      }
    } catch (error) {
      logger.swallowed('Failed to load coinage state', 'loadFromStorage', error);
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      await Promise.all([
        storage.write(WALLET_STORAGE_KEY, this.wallet),
        storage.write(TRANSFERS_STORAGE_KEY, this.transfers),
      ]);
    } catch (error) {
      logger.swallowed('Failed to save coinage state', 'saveToStorage', error);
    }
  }

  async scanForCoins(): Promise<CoinWallet> {
    await this.ensureInitialized();
    // In real implementation, would scan chain for user's coins
    return this.wallet;
  }

  getWallet(): CoinWallet {
    // Note: Synchronous getter - caller should call scanForCoins first to ensure initialized
    return this.wallet;
  }

  async onboard(params: {
    amount: PUSDAmount;
    sourceAddress: PolkadotAddress;
  }): Promise<Result<RecyclerVoucher[], CoinageError>> {
    logger.info('Onboarding coins', 'onboard', { amount: params.amount });

    const amountCents = toPUSDCents(params.amount);
    const exponents = decomposeAmountCents(amountCents);

    // Create mock vouchers with proper structure
    const vouchers: RecyclerVoucher[] = exponents.map((exponent, i) => ({
      recyclerExponent: exponent,
      ringIndex: i,
      alias: new TextEncoder().encode(`voucher-${Date.now()}-${i}`),
      createdAt: Date.now(),
    }));

    // Create coins from vouchers
    const newCoins: Coin[] = exponents.map((exponent, i) => ({
      exponent,
      age: 0,
      owner: createCoinPublicKey(`pk-${Date.now()}-${this.nextDerivationIndex + i}`),
      derivationIndex: this.nextDerivationIndex + i,
    }));

    this.nextDerivationIndex += newCoins.length;

    // Update wallet
    const totalCents = newCoins.reduce((sum, c) => sum + COIN_VALUES_CENTS[c.exponent], 0);
    this.wallet = {
      totalBalanceCents: this.wallet.totalBalanceCents + totalCents,
      coins: [...this.wallet.coins, ...newCoins],
      nextDerivationIndex: this.nextDerivationIndex,
      pendingIncoming: this.wallet.pendingIncoming,
    };

    await this.saveToStorage();

    logger.info('Onboarding complete', 'onboard', {
      coinsCreated: newCoins.length,
      newBalance: this.wallet.totalBalanceCents,
    });

    return ok(vouchers);
  }

  async claimCoins(params: {
    vouchers: readonly RecyclerVoucher[];
    claimToken: RecyclerClaimToken;
  }): Promise<Result<Coin[], CoinageError>> {
    logger.info('Claiming coins from vouchers', 'claimCoins', {
      voucherCount: params.vouchers.length,
      claimTokenType: params.claimToken.type,
    });

    // Create coins from vouchers
    const newCoins: Coin[] = params.vouchers.map((v, i) => ({
      exponent: v.recyclerExponent,
      age: 0,
      owner: createCoinPublicKey(`pk-claimed-${Date.now()}-${this.nextDerivationIndex + i}`),
      derivationIndex: this.nextDerivationIndex + i,
    }));

    this.nextDerivationIndex += newCoins.length;

    // Update wallet
    const totalCents = newCoins.reduce((sum, c) => sum + COIN_VALUES_CENTS[c.exponent], 0);
    this.wallet = {
      totalBalanceCents: this.wallet.totalBalanceCents + totalCents,
      coins: [...this.wallet.coins, ...newCoins],
      nextDerivationIndex: this.nextDerivationIndex,
      pendingIncoming: this.wallet.pendingIncoming,
    };

    await this.saveToStorage();

    return ok(newCoins);
  }

  async splitCoin(params: {
    coin: Coin;
    into: readonly CoinExponent[];
  }): Promise<Result<Coin[], CoinageError>> {
    logger.info('Splitting coin', 'splitCoin', {
      inputExponent: params.coin.exponent,
      outputs: params.into,
    });

    // Find and remove original coin
    const coinIndex = this.wallet.coins.findIndex(
      (c) => c.derivationIndex === params.coin.derivationIndex
    );
    if (coinIndex === -1) {
      return err({ type: 'COIN_NOT_FOUND', derivationIndex: params.coin.derivationIndex });
    }

    // Create new coins
    const newCoins: Coin[] = params.into.map((exponent, i) => ({
      exponent,
      age: params.coin.age,
      owner: createCoinPublicKey(`pk-split-${Date.now()}-${this.nextDerivationIndex + i}`),
      derivationIndex: this.nextDerivationIndex + i,
    }));

    this.nextDerivationIndex += newCoins.length;

    // Update wallet
    const remainingCoins = this.wallet.coins.filter((_, i) => i !== coinIndex);
    this.wallet = {
      ...this.wallet,
      coins: [...remainingCoins, ...newCoins],
      nextDerivationIndex: this.nextDerivationIndex,
    };

    await this.saveToStorage();

    return ok(newCoins);
  }

  prepareTransfer(params: { coins: readonly Coin[]; expiresInSeconds?: number }): TransferPackage {
    logger.info('Preparing transfer', 'prepareTransfer', {
      coinCount: params.coins.length,
    });

    const expiresInSeconds = params.expiresInSeconds ?? 24 * 60 * 60; // 24 hours default
    const expiresAt = Date.now() + expiresInSeconds * 1000;

    // Generate mock keys for each coin
    const keys: string[] = params.coins.map((coin) => {
      const keyBytes = new Uint8Array(32);
      crypto.getRandomValues(keyBytes);
      return `key-${coin.derivationIndex}-${Array.from(keyBytes.slice(0, 8))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`;
    });

    const exponents = params.coins.map((c) => c.exponent);
    const totalValueCents = params.coins.reduce((sum, c) => sum + COIN_VALUES_CENTS[c.exponent], 0);

    // Create transfer record
    const transfer: TransferRecord = {
      id: generateId('transfer'),
      keys,
      exponents,
      totalValueCents,
      createdAt: Date.now(),
      expiresAt,
      claimed: false,
    };

    this.transfers.push(transfer);

    // Remove coins from wallet
    const coinKeys = new Set(params.coins.map((c) => c.derivationIndex));
    const remainingCoins = this.wallet.coins.filter((c) => !coinKeys.has(c.derivationIndex));

    this.wallet = {
      totalBalanceCents: this.wallet.totalBalanceCents - totalValueCents,
      coins: remainingCoins,
      nextDerivationIndex: this.nextDerivationIndex,
      pendingIncoming: this.wallet.pendingIncoming,
    };

    void this.saveToStorage();

    return {
      keys,
      exponents,
      totalValueCents,
      expiresAt,
    };
  }

  async claimTransfer(params: { keys: readonly string[] }): Promise<Result<Coin[], CoinageError>> {
    logger.info('Claiming transfer', 'claimTransfer', {
      keyCount: params.keys.length,
    });

    // Find the transfer by keys
    const transfer = this.transfers.find(
      (t) =>
        !t.claimed &&
        t.keys.length === params.keys.length &&
        t.keys.every((k, i) => k === params.keys[i])
    );

    if (!transfer) {
      return err({ type: 'TRANSFER_EXPIRED', transferId: 'unknown' });
    }

    if (Date.now() > transfer.expiresAt) {
      return err({ type: 'TRANSFER_EXPIRED', transferId: transfer.id });
    }

    // Mark as claimed
    const transferIndex = this.transfers.indexOf(transfer);
    this.transfers[transferIndex] = { ...transfer, claimed: true };

    // Create new coins from transfer
    const newCoins: Coin[] = transfer.exponents.map((exponent, i) => ({
      exponent,
      age: 1, // Increment age on transfer
      owner: createCoinPublicKey(`pk-received-${Date.now()}-${this.nextDerivationIndex + i}`),
      derivationIndex: this.nextDerivationIndex + i,
    }));

    this.nextDerivationIndex += newCoins.length;

    // Add to wallet
    this.wallet = {
      totalBalanceCents: this.wallet.totalBalanceCents + transfer.totalValueCents,
      coins: [...this.wallet.coins, ...newCoins],
      nextDerivationIndex: this.nextDerivationIndex,
      pendingIncoming: this.wallet.pendingIncoming,
    };

    await this.saveToStorage();

    return ok(newCoins);
  }

  async cancelTransfer(params: { coins: readonly Coin[] }): Promise<Result<Coin[], CoinageError>> {
    logger.info('Cancelling transfer', 'cancelTransfer', {
      coinCount: params.coins.length,
    });

    // In a real implementation, we would reclaim the coins from a pending transfer
    // For the mock, just return the coins as-is (they would be re-added to wallet)
    const newCoins: Coin[] = params.coins.map((c, i) => ({
      exponent: c.exponent,
      age: c.age,
      owner: createCoinPublicKey(`pk-reclaimed-${Date.now()}-${this.nextDerivationIndex + i}`),
      derivationIndex: this.nextDerivationIndex + i,
    }));

    this.nextDerivationIndex += newCoins.length;

    const totalCents = newCoins.reduce((sum, c) => sum + COIN_VALUES_CENTS[c.exponent], 0);
    this.wallet = {
      totalBalanceCents: this.wallet.totalBalanceCents + totalCents,
      coins: [...this.wallet.coins, ...newCoins],
      nextDerivationIndex: this.nextDerivationIndex,
      pendingIncoming: this.wallet.pendingIncoming,
    };

    await this.saveToStorage();

    return ok(newCoins);
  }

  async recycleCoin(params: {
    coins: readonly Coin[];
    claimToken: RecyclerClaimToken;
  }): Promise<Result<Coin[], CoinageError>> {
    logger.info('Recycling coins', 'recycleCoin', {
      coinCount: params.coins.length,
      claimTokenType: params.claimToken.type,
    });

    // Create recycled coins with age reset
    const coinKeys = new Set(params.coins.map((c) => c.derivationIndex));
    const remainingCoins = this.wallet.coins.filter((c) => !coinKeys.has(c.derivationIndex));

    const newCoins: Coin[] = params.coins.map((c, i) => ({
      exponent: c.exponent,
      age: 0, // Reset age
      owner: createCoinPublicKey(`pk-recycled-${Date.now()}-${this.nextDerivationIndex + i}`),
      derivationIndex: this.nextDerivationIndex + i,
    }));

    this.nextDerivationIndex += newCoins.length;

    this.wallet = {
      ...this.wallet,
      coins: [...remainingCoins, ...newCoins],
      nextDerivationIndex: this.nextDerivationIndex,
    };

    await this.saveToStorage();

    return ok(newCoins);
  }

  async offboard(params: {
    coins: readonly Coin[];
    destinationAddress: PolkadotAddress;
    claimToken: RecyclerClaimToken;
  }): Promise<Result<TransactionHash, CoinageError>> {
    logger.info('Offboarding coins', 'offboard', {
      coinCount: params.coins.length,
      destination: params.destinationAddress,
      claimTokenType: params.claimToken.type,
    });

    // Remove coins from wallet
    const coinKeys = new Set(params.coins.map((c) => c.derivationIndex));
    const remainingCoins = this.wallet.coins.filter((c) => !coinKeys.has(c.derivationIndex));
    const removedValue = params.coins.reduce((sum, c) => sum + COIN_VALUES_CENTS[c.exponent], 0);

    this.wallet = {
      totalBalanceCents: this.wallet.totalBalanceCents - removedValue,
      coins: remainingCoins,
      nextDerivationIndex: this.nextDerivationIndex,
      pendingIncoming: this.wallet.pendingIncoming,
    };

    await this.saveToStorage();

    // Generate mock transaction hash
    const txHash = createTransactionHash(
      `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`
    );

    return ok(txHash);
  }

  getClaimTokenAllocation(credential: DIMCredential): Promise<ClaimTokenAllocation> {
    return Promise.resolve({
      credential,
      period: Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)),
      available: 100,
      used: 0,
      periodEndsAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
  }
}

// ============================================================
// Singleton Export
// ============================================================

let serviceInstance: CoinageService | null = null;

/**
 * Get the coinage service singleton.
 */
export function getCoinageService(): CoinageService {
  serviceInstance ??= new MockCoinageService();
  return serviceInstance;
}

/**
 * Clear the service cache (for testing).
 */
export async function clearCoinageServiceCache(): Promise<void> {
  await Promise.all([storage.clear(WALLET_STORAGE_KEY), storage.clear(TRANSFERS_STORAGE_KEY)]);
  serviceInstance = null;
}
