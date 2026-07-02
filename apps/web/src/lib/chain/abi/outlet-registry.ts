/**
 * OutletRegistry Contract ABI
 *
 * Generated from packages/contracts/contracts/OutletRegistry.sol
 *
 * Key functions:
 * - addOutlet(outletId, treasury, weight): Add a new outlet
 * - removeOutlet(outletId): Remove an outlet
 * - updateWeights(ids, weights): Update allocation weights
 * - distribute(amount): Distribute funds to outlets
 */

/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- ethers Interface.decodeFunctionResult returns Result type with any[] elements */

import { Interface } from 'ethers';
import { toHex } from './utils';

// ============================================================
// ABI Definition
// ============================================================

/**
 * OutletRegistry ABI.
 */
export const OUTLET_REGISTRY_ABI = [
  // Read functions
  'function paymentToken() view returns (address)',
  'function totalWeight() view returns (uint256)',
  'function totalDistributedAllTime() view returns (uint256)',
  'function governance() view returns (address)',

  // Outlet access
  'function outlets(bytes32 outletId) view returns (address treasury, uint256 weight, bool isActive, uint256 addedAt, uint256 totalDistributed)',
  'function outletIds(uint256 index) view returns (bytes32)',
  'function getOutlet(bytes32 outletId) view returns (tuple(address treasury, uint256 weight, bool isActive, uint256 addedAt, uint256 totalDistributed))',
  'function getOutletIds() view returns (bytes32[])',
  'function getActiveOutletCount() view returns (uint256)',

  // Distribution
  'function calculateDistributions(uint256 totalAmount) view returns (bytes32[] ids, uint256[] amounts)',
  'function distributors(address distributor) view returns (bool)',

  // Write functions - governance
  'function addOutlet(bytes32 outletId, address treasury, uint256 weight)',
  'function removeOutlet(bytes32 outletId)',
  'function updateWeights(bytes32[] ids, uint256[] weights)',

  // Write functions - distribution
  'function distribute(uint256 amount)',

  // Admin functions
  'function setDistributor(address distributor, bool authorized)',
  'function setGovernance(address newGovernance)',
  'function pause()',
  'function unpause()',

  // Events
  'event OutletAdded(bytes32 indexed outletId, address indexed treasury, uint256 weight)',
  'event OutletRemoved(bytes32 indexed outletId, address indexed treasury)',
  'event OutletUpdated(bytes32 indexed outletId, uint256 oldWeight, uint256 newWeight)',
  'event WeightsUpdated(bytes32[] outletIds, uint256[] newWeights)',
  'event Distributed(uint256 totalAmount, uint256 outletCount)',
  'event DistributorUpdated(address indexed distributor, bool authorized)',
  'event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance)',

  // Constants
  'function BASIS_POINTS() view returns (uint256)',
] as const;

// ============================================================
// Interface
// ============================================================

/**
 * ethers.js Interface for OutletRegistry.
 */
export const outletRegistryInterface = new Interface(OUTLET_REGISTRY_ABI);

// ============================================================
// Types
// ============================================================

/** Contract outlet data */
export interface ContractOutlet {
  readonly treasury: string;
  readonly weight: bigint;
  readonly isActive: boolean;
  readonly addedAt: bigint;
  readonly totalDistributed: bigint;
}

// ============================================================
// Encoding Helpers
// ============================================================

/**
 * Encode a getOutlet call.
 */
export function encodeGetOutlet(outletId: string): string {
  return outletRegistryInterface.encodeFunctionData('getOutlet', [outletId]);
}

/**
 * Decode a getOutlet result.
 */
export function decodeGetOutlet(data: string | Uint8Array): ContractOutlet {
  const hexData = toHex(data);
  const result = outletRegistryInterface.decodeFunctionResult('getOutlet', hexData);
  const tuple = result[0];
  return {
    treasury: tuple[0],
    weight: BigInt(tuple[1]),
    isActive: Boolean(tuple[2]),
    addedAt: BigInt(tuple[3]),
    totalDistributed: BigInt(tuple[4]),
  };
}

/**
 * Encode a getOutletIds call.
 */
export function encodeGetOutletIds(): string {
  return outletRegistryInterface.encodeFunctionData('getOutletIds');
}

/**
 * Decode a getOutletIds result.
 */
export function decodeGetOutletIds(data: string | Uint8Array): string[] {
  const hexData = toHex(data);
  const result = outletRegistryInterface.decodeFunctionResult('getOutletIds', hexData);
  return result[0] as string[];
}

/**
 * Encode a getActiveOutletCount call.
 */
export function encodeGetActiveOutletCount(): string {
  return outletRegistryInterface.encodeFunctionData('getActiveOutletCount');
}

/**
 * Decode a getActiveOutletCount result.
 */
export function decodeGetActiveOutletCount(data: string | Uint8Array): bigint {
  const hexData = toHex(data);
  const result = outletRegistryInterface.decodeFunctionResult('getActiveOutletCount', hexData);
  return BigInt(result[0]);
}

/**
 * Encode a totalWeight call.
 */
export function encodeTotalWeight(): string {
  return outletRegistryInterface.encodeFunctionData('totalWeight');
}

/**
 * Decode a totalWeight result.
 */
export function decodeTotalWeight(data: string | Uint8Array): bigint {
  const hexData = toHex(data);
  const result = outletRegistryInterface.decodeFunctionResult('totalWeight', hexData);
  return BigInt(result[0]);
}

/**
 * Encode a totalDistributedAllTime call.
 */
export function encodeTotalDistributed(): string {
  return outletRegistryInterface.encodeFunctionData('totalDistributedAllTime');
}

/**
 * Decode a totalDistributedAllTime result.
 */
export function decodeTotalDistributed(data: string | Uint8Array): bigint {
  const hexData = toHex(data);
  const result = outletRegistryInterface.decodeFunctionResult('totalDistributedAllTime', hexData);
  return BigInt(result[0]);
}

/**
 * Encode a calculateDistributions call.
 */
export function encodeCalculateDistributions(totalAmount: bigint): string {
  return outletRegistryInterface.encodeFunctionData('calculateDistributions', [totalAmount]);
}

/**
 * Decode a calculateDistributions result.
 */
export function decodeCalculateDistributions(data: string | Uint8Array): {
  ids: string[];
  amounts: bigint[];
} {
  const hexData = toHex(data);
  const result = outletRegistryInterface.decodeFunctionResult('calculateDistributions', hexData);
  return {
    ids: result[0] as string[],
    amounts: result[1] as bigint[],
  };
}

/**
 * Encode an addOutlet call.
 */
export function encodeAddOutlet(outletId: string, treasury: string, weight: bigint): string {
  return outletRegistryInterface.encodeFunctionData('addOutlet', [outletId, treasury, weight]);
}

/**
 * Encode a removeOutlet call.
 */
export function encodeRemoveOutlet(outletId: string): string {
  return outletRegistryInterface.encodeFunctionData('removeOutlet', [outletId]);
}

/**
 * Encode an updateWeights call.
 */
export function encodeUpdateWeights(ids: string[], weights: bigint[]): string {
  return outletRegistryInterface.encodeFunctionData('updateWeights', [ids, weights]);
}

/**
 * Encode a distribute call.
 */
export function encodeDistribute(amount: bigint): string {
  return outletRegistryInterface.encodeFunctionData('distribute', [amount]);
}
