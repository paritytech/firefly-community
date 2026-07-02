/**
 * OutletRegistry Contract Client
 *
 * Provides a typed interface to the OutletRegistry smart contract.
 * Handles outlet management, weight allocation, and fund distribution.
 */

import type { PolkadotSigner } from 'polkadot-api';
import type { PolkadotAddress, TransactionHash, PUSDAmount } from '@cocuyo/types';
import { createPolkadotAddress, createTransactionHash, createPUSDAmount } from '@cocuyo/types';
import { callContract, sendContractTx, type HexString } from '../revive';
import { requireContractAddress } from '../config';
import {
  encodeGetOutlet,
  decodeGetOutlet,
  encodeGetOutletIds,
  decodeGetOutletIds,
  encodeGetActiveOutletCount,
  decodeGetActiveOutletCount,
  encodeTotalWeight,
  decodeTotalWeight,
  encodeTotalDistributed,
  decodeTotalDistributed,
  encodeCalculateDistributions,
  decodeCalculateDistributions,
  encodeAddOutlet,
  encodeRemoveOutlet,
  encodeUpdateWeights,
  encodeDistribute,
  type ContractOutlet,
} from '../abi/outlet-registry';
import { createLogger } from '../../logging';
import { toH160 } from '@/lib/utils/address';

const logger = createLogger('OutletRegistryClient');

// ============================================================
// Types
// ============================================================

export interface OutletRegistryClientConfig {
  /** Registry contract address */
  readonly registryAddress: HexString;
}

/** Domain outlet representation */
export interface Outlet {
  readonly id: string;
  readonly treasury: PolkadotAddress;
  readonly weight: number; // Basis points (10000 = 100%)
  readonly weightPercentage: number; // Convenience (0-100)
  readonly isActive: boolean;
  readonly addedAt: number; // Unix timestamp
  readonly totalDistributed: PUSDAmount;
}

/** Distribution preview for an outlet */
export interface OutletDistribution {
  readonly outletId: string;
  readonly amount: PUSDAmount;
}

/** Registry statistics */
export interface RegistryStats {
  readonly activeOutletCount: number;
  readonly totalWeight: number;
  readonly totalDistributed: PUSDAmount;
}

// ============================================================
// Client Implementation
// ============================================================

/**
 * Client for interacting with the OutletRegistry contract.
 */
export class OutletRegistryClient {
  private readonly registryAddress: HexString;

  constructor(config?: Partial<OutletRegistryClientConfig>) {
    this.registryAddress = config?.registryAddress ?? requireContractAddress('outletRegistry');

    logger.debug('Registry client initialized', 'constructor', {
      registryAddress: this.registryAddress,
    });
  }

  // ============================================================
  // Read Operations
  // ============================================================

  /**
   * Get an outlet by ID.
   */
  async getOutlet(outletId: string): Promise<Outlet | null> {
    try {
      const bytes32Id = this.toBytes32(outletId);
      const calldata = encodeGetOutlet(bytes32Id) as HexString;

      const result = await callContract({
        contract: this.registryAddress,
        calldata,
      });

      const outlet = decodeGetOutlet(result);

      if (outlet.treasury === '0x0000000000000000000000000000000000000000') {
        return null;
      }

      return this.mapContractOutlet(outletId, outlet);
    } catch (error) {
      logger.warn('Failed to get outlet', 'getOutlet', { outletId, error });
      return null;
    }
  }

  /**
   * Get all outlet IDs.
   */
  async getOutletIds(): Promise<string[]> {
    const calldata = encodeGetOutletIds() as HexString;

    const result = await callContract({
      contract: this.registryAddress,
      calldata,
    });

    const bytes32Ids = decodeGetOutletIds(result);
    return bytes32Ids.map((id) => this.fromBytes32(id));
  }

  /**
   * Get all outlets.
   */
  async getAllOutlets(): Promise<Outlet[]> {
    const ids = await this.getOutletIds();
    const outlets: Outlet[] = [];

    for (const id of ids) {
      const outlet = await this.getOutlet(id);
      if (outlet) {
        outlets.push(outlet);
      }
    }

    return outlets;
  }

  /**
   * Get active outlets only.
   */
  async getActiveOutlets(): Promise<Outlet[]> {
    const outlets = await this.getAllOutlets();
    return outlets.filter((o) => o.isActive);
  }

  /**
   * Get the count of active outlets.
   */
  async getActiveOutletCount(): Promise<number> {
    const calldata = encodeGetActiveOutletCount() as HexString;

    const result = await callContract({
      contract: this.registryAddress,
      calldata,
    });

    return Number(decodeGetActiveOutletCount(result));
  }

  /**
   * Get registry statistics.
   */
  async getStats(): Promise<RegistryStats> {
    const [activeCount, totalWeight, totalDistributed] = await Promise.all([
      this.getActiveOutletCount(),
      this.getTotalWeight(),
      this.getTotalDistributed(),
    ]);

    return {
      activeOutletCount: activeCount,
      totalWeight,
      totalDistributed: createPUSDAmount(totalDistributed),
    };
  }

  /**
   * Get total weight of all active outlets.
   */
  async getTotalWeight(): Promise<number> {
    const calldata = encodeTotalWeight() as HexString;

    const result = await callContract({
      contract: this.registryAddress,
      calldata,
    });

    return Number(decodeTotalWeight(result));
  }

  /**
   * Get total amount distributed all-time.
   */
  async getTotalDistributed(): Promise<bigint> {
    const calldata = encodeTotalDistributed() as HexString;

    const result = await callContract({
      contract: this.registryAddress,
      calldata,
    });

    return decodeTotalDistributed(result);
  }

  /**
   * Calculate distribution amounts for a given total.
   */
  async calculateDistributions(totalAmount: bigint): Promise<OutletDistribution[]> {
    const calldata = encodeCalculateDistributions(totalAmount) as HexString;

    const result = await callContract({
      contract: this.registryAddress,
      calldata,
    });

    const { ids, amounts } = decodeCalculateDistributions(result);

    return ids.map((id, i) => {
      const amount = amounts[i];
      if (amount === undefined) {
        throw new Error('calculateDistributions returned mismatched ids/amounts lengths');
      }
      return {
        outletId: this.fromBytes32(id),
        amount: createPUSDAmount(amount),
      };
    });
  }

  // ============================================================
  // Write Operations (Governance)
  // ============================================================

  /**
   * Add a new outlet to the registry.
   * Requires governance role.
   */
  async addOutlet(
    outletId: string,
    treasury: PolkadotAddress,
    weight: bigint,
    signer: PolkadotSigner
  ): Promise<TransactionHash> {
    logger.info('Adding outlet', 'addOutlet', { outletId, treasury, weight: weight.toString() });

    const bytes32Id = this.toBytes32(outletId);
    const h160Treasury = toH160(treasury);
    const calldata = encodeAddOutlet(bytes32Id, h160Treasury, weight) as HexString;

    const result = await sendContractTx({
      contract: this.registryAddress,
      calldata,
      signer,
    });

    return createTransactionHash(result.txHash);
  }

  /**
   * Remove an outlet from the registry.
   * Requires governance role.
   */
  async removeOutlet(outletId: string, signer: PolkadotSigner): Promise<TransactionHash> {
    logger.info('Removing outlet', 'removeOutlet', { outletId });

    const bytes32Id = this.toBytes32(outletId);
    const calldata = encodeRemoveOutlet(bytes32Id) as HexString;

    const result = await sendContractTx({
      contract: this.registryAddress,
      calldata,
      signer,
    });

    return createTransactionHash(result.txHash);
  }

  /**
   * Update weights for multiple outlets.
   * Requires governance role. Weights must sum to BASIS_POINTS (10000).
   */
  async updateWeights(
    outlets: Array<{ outletId: string; weight: bigint }>,
    signer: PolkadotSigner
  ): Promise<TransactionHash> {
    logger.info('Updating weights', 'updateWeights', {
      outlets: outlets.map((o) => ({ id: o.outletId, weight: o.weight.toString() })),
    });

    const ids = outlets.map((o) => this.toBytes32(o.outletId));
    const weights = outlets.map((o) => o.weight);
    const calldata = encodeUpdateWeights(ids, weights) as HexString;

    const result = await sendContractTx({
      contract: this.registryAddress,
      calldata,
      signer,
    });

    return createTransactionHash(result.txHash);
  }

  // ============================================================
  // Write Operations (Distribution)
  // ============================================================

  /**
   * Distribute funds to all active outlets.
   * Requires distributor role.
   */
  async distribute(amount: bigint, signer: PolkadotSigner): Promise<TransactionHash> {
    logger.info('Distributing to outlets', 'distribute', { amount: amount.toString() });

    const calldata = encodeDistribute(amount) as HexString;

    const result = await sendContractTx({
      contract: this.registryAddress,
      calldata,
      signer,
    });

    return createTransactionHash(result.txHash);
  }

  // ============================================================
  // Helpers
  // ============================================================

  /**
   * Convert outlet ID string to bytes32.
   */
  private toBytes32(outletId: string): string {
    // If already bytes32 format, return as-is
    if (outletId.startsWith('0x') && outletId.length === 66) {
      return outletId;
    }

    // Pad string to 32 bytes
    const bytes = new TextEncoder().encode(outletId);
    const padded = new Uint8Array(32);
    padded.set(bytes.slice(0, 32));
    return `0x${Array.from(padded)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`;
  }

  /**
   * Convert bytes32 to readable outlet ID.
   */
  private fromBytes32(bytes32: string): string {
    // Remove 0x prefix and convert hex to bytes
    const hex = bytes32.startsWith('0x') ? bytes32.slice(2) : bytes32;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }

    // Find null terminator and decode
    const nullIndex = bytes.indexOf(0);
    const trimmed = nullIndex >= 0 ? bytes.slice(0, nullIndex) : bytes;
    return new TextDecoder().decode(trimmed);
  }

  /**
   * Map contract outlet to domain type.
   */
  private mapContractOutlet(outletId: string, outlet: ContractOutlet): Outlet {
    const weight = Number(outlet.weight);
    return {
      id: outletId,
      treasury: createPolkadotAddress(outlet.treasury),
      weight,
      weightPercentage: weight / 100, // Convert basis points to percentage
      isActive: outlet.isActive,
      addedAt: Number(outlet.addedAt) * 1000, // Convert to JS timestamp
      totalDistributed: createPUSDAmount(outlet.totalDistributed),
    };
  }
}

// ============================================================
// Singleton Export
// ============================================================

let clientInstance: OutletRegistryClient | null = null;

/**
 * Get the outlet registry client singleton.
 */
export function getOutletRegistryClient(): OutletRegistryClient {
  clientInstance ??= new OutletRegistryClient();
  return clientInstance;
}
