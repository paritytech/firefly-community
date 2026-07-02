/**
 * CrowdstackingPool Contract Client
 *
 * Provides a typed interface to the CrowdstackingPool smart contract.
 * Handles all read and write operations for the crowdstacking pool.
 */

import type { PolkadotSigner } from 'polkadot-api';
import type {
  PoolState,
  ContributorPosition,
  WithdrawalRequest,
  WithdrawalRequestId,
  PolkadotAddress,
  TransactionHash,
} from '@cocuyo/types';
import {
  createPoolId,
  createWithdrawalRequestId,
  createPolkadotAddress,
  createPUSDAmount,
  createTransactionHash,
  getTierForAmount,
} from '@cocuyo/types';
import { callContract, sendContractTx, type HexString } from '../revive';
import { CHAIN_CONFIG, requireContractAddress } from '../config';
import {
  encodeContribute,
  encodeRequestWithdrawal,
  encodeCompleteWithdrawal,
  encodeCancelWithdrawal,
  encodeSharePrice,
  decodeSharePrice,
  encodeGetPosition,
  decodeGetPosition,
  encodeGetWithdrawalRequest,
  decodeGetWithdrawalRequest,
  encodeConvertToShares,
  decodeConvertToShares,
  encodeConvertToAssets,
  decodeConvertToAssets,
  encodeTotalShares,
  decodeTotalShares,
  encodeTotalAssets,
  decodeTotalAssets,
  encodeContributorCount,
  decodeContributorCount,
  encodePaused,
  decodePaused,
  WithdrawalStatus,
  type ContractWithdrawalRequest,
} from '../abi/crowdstacking-pool';
import { encodeApprove, encodeAllowance, decodeAllowance } from '../abi/erc20';
import { createLogger } from '../../logging';
import { toH160 } from '@/lib/utils/address';

const logger = createLogger('CrowdstackingPoolClient');

// ============================================================
// Types
// ============================================================

export interface PoolClientConfig {
  /** Pool contract address */
  readonly poolAddress: HexString;
  /** pUSD token address */
  readonly tokenAddress: HexString;
}

// ============================================================
// Client Implementation
// ============================================================

/**
 * Client for interacting with the CrowdstackingPool contract.
 */
export class CrowdstackingPoolClient {
  private readonly poolAddress: HexString;
  private readonly tokenAddress: HexString;

  constructor(config?: Partial<PoolClientConfig>) {
    this.poolAddress = config?.poolAddress ?? requireContractAddress('crowdstackingPool');
    this.tokenAddress = config?.tokenAddress ?? CHAIN_CONFIG.pusd.address;

    logger.debug('Pool client initialized', 'constructor', {
      poolAddress: this.poolAddress,
      tokenAddress: this.tokenAddress,
    });
  }

  // ============================================================
  // Read Operations
  // ============================================================

  /**
   * Get the current pool state.
   */
  async getPoolState(): Promise<PoolState> {
    const [totalShares, totalAssets, sharePrice, contributorCount, isPaused] = await Promise.all([
      this.getTotalShares(),
      this.getTotalAssets(),
      this.getSharePrice(),
      this.getContributorCount(),
      this.getPaused(),
    ]);

    return {
      id: createPoolId('main'),
      name: 'Firefly Alliance Pool',
      totalShares,
      totalAssets: createPUSDAmount(totalAssets),
      sharePrice,
      contributorCount: Number(contributorCount),
      // Real on-chain `paused()` read. A paused pool rejects `contribute()`
      // (Solidity `whenNotPaused`), so `isOpen` is the inverse of `isPaused`.
      isOpen: !isPaused,
      isPaused,
      paymentToken: createPolkadotAddress(this.tokenAddress),
      outletRegistry: createPolkadotAddress('0x0000000000000000000000000000000000000000'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Get a contributor's position.
   */
  async getPosition(address: PolkadotAddress): Promise<ContributorPosition | null> {
    const h160 = toH160(address);
    const calldata = encodeGetPosition(h160) as HexString;

    try {
      const result = await callContract({
        contract: this.poolAddress,
        calldata,
      });

      const position = decodeGetPosition(result);

      if (position.shares === 0n && position.cumulativeContributed === 0n) {
        return null;
      }

      const cumulativeContributed = createPUSDAmount(position.cumulativeContributed);
      // pUSD has 6 decimals, so divide by 10000n to get cents (6 decimals -> 2 decimals)
      const tier = getTierForAmount(Number(position.cumulativeContributed / 10000n));

      return {
        poolId: createPoolId('main'),
        contributor: address,
        shares: position.shares,
        cumulativeContributed,
        tier,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    } catch (error) {
      logger.warn('Failed to get position', 'getPosition', { error });
      return null;
    }
  }

  /**
   * Get the current share price.
   */
  async getSharePrice(): Promise<bigint> {
    const calldata = encodeSharePrice() as HexString;
    const result = await callContract({
      contract: this.poolAddress,
      calldata,
    });
    return decodeSharePrice(result);
  }

  /**
   * Get total shares outstanding.
   */
  async getTotalShares(): Promise<bigint> {
    const calldata = encodeTotalShares() as HexString;
    const result = await callContract({
      contract: this.poolAddress,
      calldata,
    });
    return decodeTotalShares(result);
  }

  /**
   * Get total assets in the pool.
   */
  async getTotalAssets(): Promise<bigint> {
    const calldata = encodeTotalAssets() as HexString;
    const result = await callContract({
      contract: this.poolAddress,
      calldata,
    });
    return decodeTotalAssets(result);
  }

  /**
   * Read whether the pool is paused (`paused()` view, OpenZeppelin Pausable).
   *
   * FAILS CLOSED: if the read reverts or the chain is unreachable, the pool is
   * reported as PAUSED rather than open, so a transient failure never presents a
   * paused/halted pool as accepting contributions.
   */
  async getPaused(): Promise<boolean> {
    const calldata = encodePaused() as HexString;
    try {
      const result = await callContract({
        contract: this.poolAddress,
        calldata,
      });
      return decodePaused(result);
    } catch (error) {
      logger.warn('Failed to read pool paused state; assuming paused', 'getPaused', { error });
      return true;
    }
  }

  /**
   * Get the number of contributors.
   */
  async getContributorCount(): Promise<bigint> {
    const calldata = encodeContributorCount() as HexString;
    const result = await callContract({
      contract: this.poolAddress,
      calldata,
    });
    return decodeContributorCount(result);
  }

  /**
   * Convert assets to shares at current price.
   */
  async convertToShares(assets: bigint): Promise<bigint> {
    const calldata = encodeConvertToShares(assets) as HexString;
    const result = await callContract({
      contract: this.poolAddress,
      calldata,
    });
    return decodeConvertToShares(result);
  }

  /**
   * Convert shares to assets at current price.
   */
  async convertToAssets(shares: bigint): Promise<bigint> {
    const calldata = encodeConvertToAssets(shares) as HexString;
    const result = await callContract({
      contract: this.poolAddress,
      calldata,
    });
    return decodeConvertToAssets(result);
  }

  /**
   * Get a withdrawal request by ID.
   */
  async getWithdrawalRequest(requestId: number | bigint): Promise<WithdrawalRequest | null> {
    const calldata = encodeGetWithdrawalRequest(requestId) as HexString;

    try {
      const result = await callContract({
        contract: this.poolAddress,
        calldata,
      });

      const request = decodeGetWithdrawalRequest(result);

      if (request.requester === '0x0000000000000000000000000000000000000000') {
        return null;
      }

      return this.mapContractRequest(requestId, request);
    } catch (error) {
      logger.warn('Failed to get withdrawal request', 'getWithdrawalRequest', { requestId, error });
      return null;
    }
  }

  /**
   * Check pUSD allowance for the pool.
   */
  async getAllowance(owner: PolkadotAddress): Promise<bigint> {
    const h160Owner = toH160(owner);
    const calldata = encodeAllowance(h160Owner, this.poolAddress) as HexString;

    const result = await callContract({
      contract: this.tokenAddress,
      calldata,
    });

    return decodeAllowance(result);
  }

  // ============================================================
  // Write Operations
  // ============================================================

  /**
   * Approve the pool to spend pUSD.
   */
  async approve(amount: bigint, signer: PolkadotSigner): Promise<TransactionHash> {
    const calldata = encodeApprove(this.poolAddress, amount) as HexString;

    const result = await sendContractTx({
      contract: this.tokenAddress,
      calldata,
      signer,
    });

    return createTransactionHash(result.txHash);
  }

  /**
   * Contribute pUSD to the pool.
   * Returns the number of shares received.
   */
  async contribute(
    assets: bigint,
    signer: PolkadotSigner
  ): Promise<{ txHash: TransactionHash; shares: bigint }> {
    logger.info('Contributing to pool', 'contribute', { assets: assets.toString() });

    const calldata = encodeContribute(assets) as HexString;

    const result = await sendContractTx({
      contract: this.poolAddress,
      calldata,
      signer,
    });

    // In production, we'd decode the return value from the receipt
    // For now, estimate shares
    const shares = await this.convertToShares(assets);

    return {
      txHash: createTransactionHash(result.txHash),
      shares,
    };
  }

  /**
   * Request a withdrawal (starts cooldown).
   */
  async requestWithdrawal(
    shares: bigint,
    signer: PolkadotSigner
  ): Promise<{ requestId: WithdrawalRequestId; txHash: TransactionHash }> {
    logger.info('Requesting withdrawal', 'requestWithdrawal', { shares: shares.toString() });

    const calldata = encodeRequestWithdrawal(shares) as HexString;

    await sendContractTx({
      contract: this.poolAddress,
      calldata,
      signer,
    });

    // The real requestId is assigned on-chain (the contract's `nextWithdrawalId`)
    // and emitted only via the `WithdrawalRequested` event. `sendContractTx`
    // returns just the tx/block hash — Revive extrinsics expose no event logs or
    // return data here — so the id cannot be read back without an event indexer.
    // FAIL CLOSED: throw rather than return a fabricated `wr-${Date.now()}` id,
    // which the completion flow would then track against a non-existent request.
    throw new Error(
      'Withdrawal submitted on-chain, but the requestId cannot be confirmed: ' +
        'reading it requires event-log indexing of WithdrawalRequested, which is ' +
        'not yet available. Re-query the chain to locate the new request.'
    );
  }

  /**
   * Complete a withdrawal after cooldown.
   */
  async completeWithdrawal(
    requestId: number | bigint,
    signer: PolkadotSigner
  ): Promise<{ assets: bigint | null; txHash: TransactionHash }> {
    logger.info('Completing withdrawal', 'completeWithdrawal', { requestId: requestId.toString() });

    const calldata = encodeCompleteWithdrawal(requestId) as HexString;

    const result = await sendContractTx({
      contract: this.poolAddress,
      calldata,
      signer,
    });

    // The withdrawn `assets` is the contract return value of `completeWithdrawal`
    // (also carried by the `WithdrawalCompleted` event). `sendContractTx` exposes
    // neither return data nor event logs, so the real amount is unknown here.
    // The tx is genuinely finalized (success or it would have thrown), so we
    // return the confirmed `txHash` but report `assets` as honestly unknown
    // (`null`) rather than fabricating `0n` as if nothing was withdrawn.
    return {
      assets: null,
      txHash: createTransactionHash(result.txHash),
    };
  }

  /**
   * Cancel a pending withdrawal.
   */
  async cancelWithdrawal(
    requestId: number | bigint,
    signer: PolkadotSigner
  ): Promise<TransactionHash> {
    logger.info('Cancelling withdrawal', 'cancelWithdrawal', { requestId: requestId.toString() });

    const calldata = encodeCancelWithdrawal(requestId) as HexString;

    const result = await sendContractTx({
      contract: this.poolAddress,
      calldata,
      signer,
    });

    return createTransactionHash(result.txHash);
  }

  // ============================================================
  // Helpers
  // ============================================================

  /**
   * Map contract withdrawal request to domain type.
   */
  private mapContractRequest(
    requestId: number | bigint,
    request: ContractWithdrawalRequest
  ): WithdrawalRequest {
    const statusMap: Record<WithdrawalStatus, 'pending' | 'completed' | 'cancelled'> = {
      [WithdrawalStatus.PENDING]: 'pending',
      [WithdrawalStatus.COMPLETED]: 'completed',
      [WithdrawalStatus.CANCELLED]: 'cancelled',
    };

    // The on-chain request struct exposes only requester/shares/requestedAt/
    // availableAt/status — NOT the completion timestamp or the assets received
    // (those live in the WithdrawalCompleted event). Leave `completedAt` and
    // `amountReceived` undefined (both optional) for completed requests rather
    // than fabricating `Date.now()` / `ZERO_PUSD`, which would misreport a real
    // withdrawal as having received nothing.
    return {
      id: createWithdrawalRequestId(`wr-${requestId}`),
      poolId: createPoolId('main'),
      requester: createPolkadotAddress(request.requester),
      shares: request.shares,
      status: statusMap[request.status],
      requestedAt: Number(request.requestedAt),
      availableAt: Number(request.availableAt),
    };
  }
}

// ============================================================
// Singleton Export
// ============================================================

let clientInstance: CrowdstackingPoolClient | null = null;

/**
 * Get the pool client singleton.
 */
export function getCrowdstackingPoolClient(): CrowdstackingPoolClient {
  clientInstance ??= new CrowdstackingPoolClient();
  return clientInstance;
}
