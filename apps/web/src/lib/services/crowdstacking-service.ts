/**
 * Crowdstacking Service implementation.
 *
 * Provides access to the CrowdstackingPool contract for contributors
 * to deposit, withdraw, and track their positions.
 *
 * This is a session-cached implementation that will integrate with
 * the on-chain contracts when available.
 */

import type {
  PoolId,
  WithdrawalRequestId,
  PoolState,
  ContributorPosition,
  WithdrawalRequest,
  ContributorTier,
  PoolStats,
  PolkadotAddress,
  TransactionHash,
  PUSDAmount,
  Result,
} from '@cocuyo/types';
import {
  ok,
  err,
  createPoolId,
  createWithdrawalRequestId,
  createTransactionHash,
  createPolkadotAddress,
  createPUSDAmount,
  ZERO_PUSD,
  addPUSD,
  subtractPUSD,
  getTierForAmount,
  toPUSDCents,
  SHARE_PRECISION,
  INITIAL_SHARE_PRICE,
  WITHDRAWAL_COOLDOWN_SECONDS,
  MIN_CONTRIBUTION,
  calculateSharesForContribution,
  calculateShareValue,
  meetsMinimumContribution,
} from '@cocuyo/types';
import { getConnectedWallet, getConnectedSigner, uploadToBulletin } from './service-utils';
import { storage } from '../host/storage';
import { createLogger } from '../logging';
import { isChainContractsEnabled } from '../chain/config';
import {
  getCrowdstackingPoolClient,
  type CrowdstackingPoolClient,
} from '../chain/contracts/crowdstacking-pool';

const logger = createLogger('CrowdstackingService');

// ============================================================
// Error Types
// ============================================================

export type CrowdstackingError =
  | { readonly type: 'WALLET_NOT_CONNECTED' }
  | { readonly type: 'POOL_NOT_FOUND'; readonly poolId: PoolId }
  | { readonly type: 'BELOW_MINIMUM'; readonly amount: PUSDAmount; readonly minimum: bigint }
  | { readonly type: 'INSUFFICIENT_SHARES'; readonly available: bigint; readonly requested: bigint }
  | { readonly type: 'REQUEST_NOT_FOUND'; readonly requestId: WithdrawalRequestId }
  | { readonly type: 'REQUEST_NOT_READY'; readonly availableAt: number }
  | { readonly type: 'REQUEST_NOT_PENDING' }
  | { readonly type: 'TRANSACTION_FAILED'; readonly reason: string };

// ============================================================
// Service Interface
// ============================================================

export interface ICrowdstackingService {
  /** Get the current state of the pool */
  getPoolState(): Promise<PoolState | null>;

  /** Get a contributor's position */
  getPosition(address: PolkadotAddress): Promise<ContributorPosition | null>;

  /** Get pool statistics */
  getPoolStats(): Promise<PoolStats | null>;

  /** Contribute pUSD to the pool */
  contribute(
    amount: PUSDAmount
  ): Promise<Result<{ txHash: TransactionHash; shares: bigint }, CrowdstackingError>>;

  /** Request a withdrawal (starts cooldown) */
  requestWithdrawal(
    shares: bigint
  ): Promise<Result<{ requestId: WithdrawalRequestId }, CrowdstackingError>>;

  /** Complete a withdrawal after cooldown */
  completeWithdrawal(
    requestId: WithdrawalRequestId
  ): Promise<Result<{ assets: PUSDAmount }, CrowdstackingError>>;

  /** Cancel a pending withdrawal */
  cancelWithdrawal(requestId: WithdrawalRequestId): Promise<Result<void, CrowdstackingError>>;

  /** Get all withdrawal requests for an address */
  getWithdrawalRequests(address: PolkadotAddress): Promise<readonly WithdrawalRequest[]>;

  /** Get a specific withdrawal request */
  getWithdrawalRequest(requestId: WithdrawalRequestId): Promise<WithdrawalRequest | null>;
}

// ============================================================
// Storage Keys
// ============================================================

const POOL_STATE_KEY = 'crowdstacking-pool-state';
const POSITIONS_KEY = 'crowdstacking-positions';
const WITHDRAWALS_KEY = 'crowdstacking-withdrawals';

// ============================================================
// Session Caches
// ============================================================

let poolStateCache: PoolState | null = null;
const positionsCache = new Map<string, ContributorPosition>();
const withdrawalsCache: WithdrawalRequest[] = [];
let nextWithdrawalId = 1;

// ============================================================
// Implementation
// ============================================================

export class CrowdstackingServiceImpl implements ICrowdstackingService {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    // Load from persistent storage
    const [storedPool, storedPositions, storedWithdrawals] = await Promise.all([
      storage.read<PoolState>(POOL_STATE_KEY),
      storage.read<Record<string, ContributorPosition>>(POSITIONS_KEY),
      storage.read<WithdrawalRequest[]>(WITHDRAWALS_KEY),
    ]);

    if (storedPool) {
      poolStateCache = storedPool;
    } else {
      // Create default pool state
      poolStateCache = this.createDefaultPoolState();
      await storage.write(POOL_STATE_KEY, poolStateCache);
    }

    if (storedPositions) {
      for (const [addr, pos] of Object.entries(storedPositions)) {
        positionsCache.set(addr, pos);
      }
    }

    if (storedWithdrawals) {
      withdrawalsCache.push(...storedWithdrawals);
      const maxId = Math.max(
        0,
        ...storedWithdrawals.map((w) => parseInt(w.id.split('-')[1] ?? '0', 10))
      );
      nextWithdrawalId = maxId + 1;
    }

    this.initialized = true;
    logger.debug('Crowdstacking service initialized', 'ensureInitialized', {
      poolState: true, // poolStateCache is guaranteed to be set at this point
      positions: positionsCache.size,
      withdrawals: withdrawalsCache.length,
    });
  }

  private createDefaultPoolState(): PoolState {
    const now = Date.now();
    return {
      id: createPoolId('pool-main'),
      name: 'Firefly Alliance Pool',
      totalShares: 0n,
      totalAssets: ZERO_PUSD,
      sharePrice: INITIAL_SHARE_PRICE,
      contributorCount: 0,
      isOpen: true,
      isPaused: false,
      paymentToken: createPolkadotAddress('0x0000000000000000000000000000000000000000'),
      outletRegistry: createPolkadotAddress('0x0000000000000000000000000000000000000000'),
      createdAt: now,
      updatedAt: now,
    };
  }

  async getPoolState(): Promise<PoolState | null> {
    await this.ensureInitialized();
    return poolStateCache;
  }

  async getPosition(address: PolkadotAddress): Promise<ContributorPosition | null> {
    await this.ensureInitialized();
    return positionsCache.get(address) ?? null;
  }

  async getPoolStats(): Promise<PoolStats | null> {
    await this.ensureInitialized();
    if (!poolStateCache) return null;

    // Calculate contributors by tier
    const contributorsByTier: Record<ContributorTier, number> = {
      none: 0,
      spark: 0,
      flame: 0,
      beacon: 0,
      lighthouse: 0,
    };

    for (const position of positionsCache.values()) {
      contributorsByTier[position.tier]++;
    }

    return {
      poolId: poolStateCache.id,
      tvl: poolStateCache.totalAssets,
      activeContributors: poolStateCache.contributorCount,
      contributorsByTier,
      fundedOutlets: 0, // Would come from OutletRegistry
      totalDistributed: ZERO_PUSD, // Would come from distribution history
      distributedLast30Days: ZERO_PUSD,
      annualizedYield: 0, // Would be calculated from historical data
      snapshotAt: Date.now(),
    };
  }

  async contribute(
    amount: PUSDAmount
  ): Promise<Result<{ txHash: TransactionHash; shares: bigint }, CrowdstackingError>> {
    await this.ensureInitialized();

    const wallet = getConnectedWallet();
    if (wallet === null) {
      return err({ type: 'WALLET_NOT_CONNECTED' });
    }

    if (!meetsMinimumContribution(amount)) {
      return err({ type: 'BELOW_MINIMUM', amount, minimum: MIN_CONTRIBUTION });
    }

    if (!poolStateCache) {
      return err({ type: 'POOL_NOT_FOUND', poolId: createPoolId('pool-main') });
    }

    const address = createPolkadotAddress(wallet);

    // Calculate shares at current price
    const sharePrice =
      poolStateCache.totalShares === 0n
        ? INITIAL_SHARE_PRICE
        : (BigInt(poolStateCache.totalAssets.toString()) * SHARE_PRECISION) /
          poolStateCache.totalShares;
    const shares = calculateSharesForContribution(amount, sharePrice);

    const now = Date.now();

    // Update or create position
    let position = positionsCache.get(address);
    const isNewContributor = position === undefined;

    if (position) {
      position = {
        ...position,
        shares: position.shares + shares,
        cumulativeContributed: addPUSD(position.cumulativeContributed, amount),
        tier: getTierForAmount(toPUSDCents(addPUSD(position.cumulativeContributed, amount))),
        updatedAt: now,
      };
    } else {
      position = {
        poolId: poolStateCache.id,
        contributor: address,
        shares,
        cumulativeContributed: amount,
        tier: getTierForAmount(toPUSDCents(amount)),
        createdAt: now,
        updatedAt: now,
      };
    }

    positionsCache.set(address, position);

    // Update pool state
    poolStateCache = {
      ...poolStateCache,
      totalShares: poolStateCache.totalShares + shares,
      totalAssets: addPUSD(poolStateCache.totalAssets, amount),
      contributorCount: isNewContributor
        ? poolStateCache.contributorCount + 1
        : poolStateCache.contributorCount,
      updatedAt: now,
    };

    // Persist
    await Promise.all([
      storage.write(POOL_STATE_KEY, poolStateCache),
      storage.write(POSITIONS_KEY, Object.fromEntries(positionsCache)),
    ]);

    // Upload to Bulletin for audit trail
    await uploadToBulletin({
      type: 'contribution',
      poolId: poolStateCache.id,
      contributor: address,
      amount: amount.toString(),
      shares: shares.toString(),
      timestamp: now,
    });

    const txHash = createTransactionHash(
      `0x${now.toString(16)}${Math.random().toString(16).slice(2)}`
    );

    logger.info('Contribution recorded', 'contribute', {
      amount: amount.toString(),
      shares: shares.toString(),
    });

    return ok({ txHash, shares });
  }

  async requestWithdrawal(
    sharesToWithdraw: bigint
  ): Promise<Result<{ requestId: WithdrawalRequestId }, CrowdstackingError>> {
    await this.ensureInitialized();

    const wallet = getConnectedWallet();
    if (wallet === null) {
      return err({ type: 'WALLET_NOT_CONNECTED' });
    }

    const address = createPolkadotAddress(wallet);
    const position = positionsCache.get(address);

    if (!position || position.shares < sharesToWithdraw) {
      return err({
        type: 'INSUFFICIENT_SHARES',
        available: position?.shares ?? 0n,
        requested: sharesToWithdraw,
      });
    }

    const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    const availableAt = now + WITHDRAWAL_COOLDOWN_SECONDS;
    const requestId = createWithdrawalRequestId(`wr-${nextWithdrawalId++}`);

    // Lock shares (remove from position)
    const updatedPosition: ContributorPosition = {
      ...position,
      shares: position.shares - sharesToWithdraw,
      updatedAt: Date.now(),
    };
    positionsCache.set(address, updatedPosition);

    // Create withdrawal request
    const poolState = poolStateCache;
    if (poolState === null) {
      return err({ type: 'TRANSACTION_FAILED', reason: 'Pool not initialized' });
    }
    const request: WithdrawalRequest = {
      id: requestId,
      poolId: poolState.id,
      requester: address,
      shares: sharesToWithdraw,
      status: 'pending',
      requestedAt: now,
      availableAt,
    };
    withdrawalsCache.push(request);

    // Persist
    await Promise.all([
      storage.write(POSITIONS_KEY, Object.fromEntries(positionsCache)),
      storage.write(WITHDRAWALS_KEY, withdrawalsCache),
    ]);

    logger.info('Withdrawal requested', 'requestWithdrawal', {
      requestId,
      requester: address,
      shares: sharesToWithdraw.toString(),
      availableAt,
    });

    return ok({ requestId });
  }

  async completeWithdrawal(
    requestId: WithdrawalRequestId
  ): Promise<Result<{ assets: PUSDAmount }, CrowdstackingError>> {
    await this.ensureInitialized();

    const wallet = getConnectedWallet();
    if (wallet === null) {
      return err({ type: 'WALLET_NOT_CONNECTED' });
    }

    const request = withdrawalsCache.find((w) => w.id === requestId);
    if (request === undefined) {
      return err({ type: 'REQUEST_NOT_FOUND', requestId });
    }

    if (request.status !== 'pending') {
      return err({ type: 'REQUEST_NOT_PENDING' });
    }

    const now = Math.floor(Date.now() / 1000);
    if (now < request.availableAt) {
      return err({ type: 'REQUEST_NOT_READY', availableAt: request.availableAt });
    }

    const poolState = poolStateCache;
    if (poolState === null) {
      return err({ type: 'TRANSACTION_FAILED', reason: 'Pool not initialized' });
    }

    // Calculate assets at current price
    const sharePrice =
      poolState.totalShares > 0n
        ? (BigInt(poolState.totalAssets.toString()) * SHARE_PRECISION) / poolState.totalShares
        : INITIAL_SHARE_PRICE;
    const assetsValue = calculateShareValue(request.shares, sharePrice);
    const assets = createPUSDAmount(assetsValue);

    // Update request in cache
    const requestIndex = withdrawalsCache.indexOf(request);
    const updatedRequest: WithdrawalRequest = {
      ...request,
      status: 'completed',
      completedAt: now,
      amountReceived: assets,
    };
    withdrawalsCache[requestIndex] = updatedRequest;

    // Update pool state
    const address = createPolkadotAddress(wallet);
    const position = positionsCache.get(address);

    poolStateCache = {
      ...poolState,
      totalShares: poolState.totalShares - request.shares,
      totalAssets: subtractPUSD(poolState.totalAssets, assets),
      contributorCount:
        position?.shares === 0n ? poolState.contributorCount - 1 : poolState.contributorCount,
      updatedAt: Date.now(),
    };

    // Persist
    await Promise.all([
      storage.write(POOL_STATE_KEY, poolStateCache),
      storage.write(WITHDRAWALS_KEY, withdrawalsCache),
    ]);

    logger.info('Withdrawal completed', 'completeWithdrawal', {
      requestId,
      shares: request.shares.toString(),
      assets: assets.toString(),
    });

    return ok({ assets });
  }

  async cancelWithdrawal(
    requestId: WithdrawalRequestId
  ): Promise<Result<void, CrowdstackingError>> {
    await this.ensureInitialized();

    const wallet = getConnectedWallet();
    if (wallet === null) {
      return err({ type: 'WALLET_NOT_CONNECTED' });
    }

    const request = withdrawalsCache.find((w) => w.id === requestId);
    if (request === undefined) {
      return err({ type: 'REQUEST_NOT_FOUND', requestId });
    }

    if (request.status !== 'pending') {
      return err({ type: 'REQUEST_NOT_PENDING' });
    }

    // Update request status
    const requestIndex = withdrawalsCache.indexOf(request);
    const updatedRequest: WithdrawalRequest = {
      ...request,
      status: 'cancelled',
    };
    withdrawalsCache[requestIndex] = updatedRequest;

    // Return shares to position
    const address = request.requester;
    const position = positionsCache.get(address);

    if (position) {
      const updatedPosition: ContributorPosition = {
        ...position,
        shares: position.shares + request.shares,
        updatedAt: Date.now(),
      };
      positionsCache.set(address, updatedPosition);
    }

    // Persist
    await Promise.all([
      storage.write(POSITIONS_KEY, Object.fromEntries(positionsCache)),
      storage.write(WITHDRAWALS_KEY, withdrawalsCache),
    ]);

    logger.info('Withdrawal cancelled', 'cancelWithdrawal', {
      requestId,
      shares: request.shares.toString(),
    });

    return ok(undefined);
  }

  async getWithdrawalRequests(address: PolkadotAddress): Promise<readonly WithdrawalRequest[]> {
    await this.ensureInitialized();
    return withdrawalsCache.filter((w) => w.requester === address);
  }

  async getWithdrawalRequest(requestId: WithdrawalRequestId): Promise<WithdrawalRequest | null> {
    await this.ensureInitialized();
    return withdrawalsCache.find((w) => w.id === requestId) ?? null;
  }
}

// ============================================================
// Chain Crowdstacking Service (On-Chain)
// ============================================================

/**
 * Chain-backed crowdstacking service using the CrowdstackingPool contract.
 *
 * Interacts directly with the smart contract on Asset Hub for all
 * pool operations. Requires wallet connection for write operations.
 */
class ChainCrowdstackingServiceImpl implements ICrowdstackingService {
  private client: CrowdstackingPoolClient | null = null;

  private getClient(): CrowdstackingPoolClient {
    this.client ??= getCrowdstackingPoolClient();
    return this.client;
  }

  async getPoolState(): Promise<PoolState | null> {
    try {
      return await this.getClient().getPoolState();
    } catch (error) {
      logger.error('Failed to get pool state from chain', 'getPoolState', { error });
      return null;
    }
  }

  async getPosition(address: PolkadotAddress): Promise<ContributorPosition | null> {
    try {
      return await this.getClient().getPosition(address);
    } catch (error) {
      logger.warn('Failed to get position from chain', 'getPosition', { address, error });
      return null;
    }
  }

  async getPoolStats(): Promise<PoolStats | null> {
    const poolState = await this.getPoolState();
    if (!poolState) return null;

    // For chain mode, we don't have tier breakdown without indexing
    const contributorsByTier: Record<ContributorTier, number> = {
      none: 0,
      spark: 0,
      flame: 0,
      beacon: 0,
      lighthouse: 0,
    };

    return {
      poolId: poolState.id,
      tvl: poolState.totalAssets,
      activeContributors: poolState.contributorCount,
      contributorsByTier,
      fundedOutlets: 0,
      totalDistributed: ZERO_PUSD,
      distributedLast30Days: ZERO_PUSD,
      annualizedYield: 0,
      snapshotAt: Date.now(),
    };
  }

  async contribute(
    amount: PUSDAmount
  ): Promise<Result<{ txHash: TransactionHash; shares: bigint }, CrowdstackingError>> {
    const wallet = getConnectedWallet();
    if (wallet === null) {
      return err({ type: 'WALLET_NOT_CONNECTED' });
    }

    // Host product-account signer (mirrors bounty-escrow.ts fundBounty / treasury
    // distributeToOutlets): the host signs and submits the Revive extrinsic.
    const signer = getConnectedSigner();
    if (signer === null) {
      return err({ type: 'WALLET_NOT_CONNECTED' });
    }

    if (!meetsMinimumContribution(amount)) {
      return err({ type: 'BELOW_MINIMUM', amount, minimum: MIN_CONTRIBUTION });
    }

    // PUSDAmount is already in the payment token's base units (6-decimal pUSD), the
    // same units contribute(assets) / approve(amount) / allowance expect — pass
    // through directly. The pool resolves its configured payment token internally
    // (no hard-coded address here).
    const assets = BigInt(amount.toString());
    const address = createPolkadotAddress(wallet);
    const client = this.getClient();

    // FAILS CLOSED: any allowance / approve / contribute failure surfaces as
    // TRANSACTION_FAILED rather than a fabricated success.
    try {
      // ERC-20 deposit requires the pool to be approved to pull `assets`. Top up
      // the allowance first when it is short, then contribute.
      const allowance = await client.getAllowance(address);
      if (allowance < assets) {
        logger.info('Approving pool to spend payment token', 'contribute', {
          current: allowance.toString(),
          required: assets.toString(),
        });
        await client.approve(assets, signer);
      }

      logger.info('Contributing to pool on-chain', 'contribute', {
        assets: assets.toString(),
        wallet,
      });

      const result = await client.contribute(assets, signer);
      return ok({ txHash: result.txHash, shares: result.shares });
    } catch (error) {
      logger.error('Chain contribution failed', 'contribute', { error });
      return err({
        type: 'TRANSACTION_FAILED',
        reason: error instanceof Error ? error.message : 'Contribution failed',
      });
    }
  }

  async requestWithdrawal(
    sharesToWithdraw: bigint
  ): Promise<Result<{ requestId: WithdrawalRequestId }, CrowdstackingError>> {
    const wallet = getConnectedWallet();
    if (wallet === null) {
      return err({ type: 'WALLET_NOT_CONNECTED' });
    }

    const address = createPolkadotAddress(wallet);
    const position = await this.getPosition(address);

    if (!position || position.shares < sharesToWithdraw) {
      return err({
        type: 'INSUFFICIENT_SHARES',
        available: position?.shares ?? 0n,
        requested: sharesToWithdraw,
      });
    }

    logger.info('Chain withdrawal requested', 'requestWithdrawal', {
      shares: sharesToWithdraw.toString(),
    });

    return err({
      type: 'TRANSACTION_FAILED',
      reason: 'Use useCrowdstackingService hook for chain transactions',
    });
  }

  async completeWithdrawal(
    requestId: WithdrawalRequestId
  ): Promise<Result<{ assets: PUSDAmount }, CrowdstackingError>> {
    const wallet = getConnectedWallet();
    if (wallet === null) {
      return err({ type: 'WALLET_NOT_CONNECTED' });
    }

    const request = await this.getWithdrawalRequest(requestId);
    if (!request) {
      return err({ type: 'REQUEST_NOT_FOUND', requestId });
    }

    if (request.status !== 'pending') {
      return err({ type: 'REQUEST_NOT_PENDING' });
    }

    const now = Math.floor(Date.now() / 1000);
    if (now < request.availableAt) {
      return err({ type: 'REQUEST_NOT_READY', availableAt: request.availableAt });
    }

    return err({
      type: 'TRANSACTION_FAILED',
      reason: 'Use useCrowdstackingService hook for chain transactions',
    });
  }

  async cancelWithdrawal(
    requestId: WithdrawalRequestId
  ): Promise<Result<void, CrowdstackingError>> {
    const wallet = getConnectedWallet();
    if (wallet === null) {
      return err({ type: 'WALLET_NOT_CONNECTED' });
    }

    const request = await this.getWithdrawalRequest(requestId);
    if (!request) {
      return err({ type: 'REQUEST_NOT_FOUND', requestId });
    }

    if (request.status !== 'pending') {
      return err({ type: 'REQUEST_NOT_PENDING' });
    }

    return err({
      type: 'TRANSACTION_FAILED',
      reason: 'Use useCrowdstackingService hook for chain transactions',
    });
  }

  getWithdrawalRequests(address: PolkadotAddress): Promise<readonly WithdrawalRequest[]> {
    // Chain mode would need event indexing to enumerate requests
    // For now, return empty - UI should track request IDs
    logger.debug('getWithdrawalRequests requires indexer', 'getWithdrawalRequests', { address });
    return Promise.resolve([]);
  }

  async getWithdrawalRequest(requestId: WithdrawalRequestId): Promise<WithdrawalRequest | null> {
    try {
      // Extract numeric ID from branded type
      const numericId = parseInt(requestId.replace('wr-', ''), 10);
      if (isNaN(numericId)) {
        return null;
      }

      return await this.getClient().getWithdrawalRequest(numericId);
    } catch (error) {
      logger.warn('Failed to get withdrawal request', 'getWithdrawalRequest', { requestId, error });
      return null;
    }
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * Get the appropriate crowdstacking service based on configuration.
 */
function createCrowdstackingService(): ICrowdstackingService {
  if (isChainContractsEnabled()) {
    logger.info('Using chain crowdstacking service', 'createCrowdstackingService');
    return new ChainCrowdstackingServiceImpl();
  }

  logger.info('Using mock crowdstacking service', 'createCrowdstackingService');
  return new CrowdstackingServiceImpl();
}

export const crowdstackingService: ICrowdstackingService = createCrowdstackingService();

/**
 * Check if the active service is chain-backed.
 */
export function isChainCrowdstackingService(): boolean {
  return isChainContractsEnabled();
}

// ============================================================
// Test Helpers
// ============================================================

/**
 * Clear all crowdstacking caches. Use in tests for isolation.
 */
export async function clearCrowdstackingCache(): Promise<void> {
  poolStateCache = null;
  positionsCache.clear();
  withdrawalsCache.length = 0;
  nextWithdrawalId = 1;

  await Promise.all([
    storage.clear(POOL_STATE_KEY),
    storage.clear(POSITIONS_KEY),
    storage.clear(WITHDRAWALS_KEY),
  ]);
}

/**
 * Seed pool state for testing.
 */
export function seedPoolState(state: PoolState): void {
  poolStateCache = state;
}

/**
 * Seed a contributor position for testing.
 */
export function seedPosition(position: ContributorPosition): void {
  positionsCache.set(position.contributor, position);
}
