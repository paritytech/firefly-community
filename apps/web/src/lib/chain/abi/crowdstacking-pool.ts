/**
 * CrowdstackingPool Contract ABI
 *
 * Generated from packages/contracts/contracts/CrowdstackingPool.sol
 *
 * Key functions:
 * - contribute(uint256 assets): Deposit pUSD, receive shares
 * - requestWithdrawal(uint256 shares): Start withdrawal cooldown
 * - completeWithdrawal(uint256 requestId): Complete after cooldown
 * - cancelWithdrawal(uint256 requestId): Cancel and return shares
 */

/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- ethers Interface.decodeFunctionResult returns Result type with any[] elements */

import { Interface } from 'ethers';
import { toHex } from './utils';

// ============================================================
// ABI Definition
// ============================================================

/**
 * CrowdstackingPool ABI.
 */
export const CROWDSTACKING_POOL_ABI = [
  // Read functions
  'function paymentToken() view returns (address)',
  'function totalShares() view returns (uint256)',
  'function totalAssets() view returns (uint256)',
  'function contributorCount() view returns (uint256)',
  'function paused() view returns (bool)',
  'function yieldSource() view returns (address)',
  'function outletRegistry() view returns (address)',
  'function nextWithdrawalId() view returns (uint256)',

  // Position and price functions
  'function sharePrice() view returns (uint256)',
  'function convertToShares(uint256 assets) view returns (uint256)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
  'function getPosition(address contributor) view returns (uint256 shares, uint256 cumulativeContributed)',
  'function positions(address contributor) view returns (uint256 shares, uint256 cumulativeContributed, uint256 createdAt, uint256 updatedAt)',

  // Withdrawal functions
  'function getWithdrawalRequest(uint256 requestId) view returns (tuple(address requester, uint256 shares, uint256 requestedAt, uint256 availableAt, uint8 status))',
  'function withdrawalRequests(uint256 requestId) view returns (address requester, uint256 shares, uint256 requestedAt, uint256 availableAt, uint8 status)',
  'function isWithdrawalReady(uint256 requestId) view returns (bool)',

  // Write functions
  'function contribute(uint256 assets) returns (uint256 shares)',
  'function requestWithdrawal(uint256 sharesToWithdraw) returns (uint256 requestId)',
  'function completeWithdrawal(uint256 requestId) returns (uint256 assets)',
  'function cancelWithdrawal(uint256 requestId)',

  // Admin functions
  'function receiveYield(uint256 amount)',
  'function recordLoss(uint256 amount)',
  'function setYieldSource(address newYieldSource)',
  'function setOutletRegistry(address newOutletRegistry)',
  'function pause()',
  'function unpause()',

  // Events
  'event Contributed(address indexed contributor, uint256 assets, uint256 shares, uint256 sharePrice)',
  'event WithdrawalRequested(uint256 indexed requestId, address indexed requester, uint256 shares, uint256 availableAt)',
  'event WithdrawalCompleted(uint256 indexed requestId, address indexed requester, uint256 shares, uint256 assets)',
  'event WithdrawalCancelled(uint256 indexed requestId, address indexed requester, uint256 shares)',
  'event YieldReceived(uint256 amount, uint256 newSharePrice, uint256 newTotalAssets)',
  'event LossRecorded(uint256 amount, uint256 newSharePrice, uint256 newTotalAssets)',
  'event YieldSourceUpdated(address indexed oldSource, address indexed newSource)',
  'event OutletRegistryUpdated(address indexed oldRegistry, address indexed newRegistry)',

  // Constants
  'function SHARE_PRECISION() view returns (uint256)',
  'function WITHDRAWAL_COOLDOWN() view returns (uint256)',
  'function MIN_CONTRIBUTION() view returns (uint256)',
] as const;

// ============================================================
// Interface
// ============================================================

/**
 * ethers.js Interface for CrowdstackingPool.
 */
export const crowdstackingPoolInterface = new Interface(CROWDSTACKING_POOL_ABI);

// ============================================================
// Types
// ============================================================

/** Withdrawal status enum matching Solidity */
export enum WithdrawalStatus {
  PENDING = 0,
  COMPLETED = 1,
  CANCELLED = 2,
}

/** Withdrawal request data */
export interface ContractWithdrawalRequest {
  readonly requester: string;
  readonly shares: bigint;
  readonly requestedAt: bigint;
  readonly availableAt: bigint;
  readonly status: WithdrawalStatus;
}

/** Position data */
export interface ContractPosition {
  readonly shares: bigint;
  readonly cumulativeContributed: bigint;
  readonly createdAt: bigint;
  readonly updatedAt: bigint;
}

// ============================================================
// Encoding Helpers
// ============================================================

/**
 * Encode a contribute call.
 */
export function encodeContribute(assets: bigint): string {
  return crowdstackingPoolInterface.encodeFunctionData('contribute', [assets]);
}

/**
 * Encode a requestWithdrawal call.
 */
export function encodeRequestWithdrawal(shares: bigint): string {
  return crowdstackingPoolInterface.encodeFunctionData('requestWithdrawal', [shares]);
}

/**
 * Decode a requestWithdrawal result.
 */
export function decodeRequestWithdrawal(data: string | Uint8Array): bigint {
  const hexData = toHex(data);
  const result = crowdstackingPoolInterface.decodeFunctionResult('requestWithdrawal', hexData);
  return BigInt(result[0]);
}

/**
 * Encode a completeWithdrawal call.
 */
export function encodeCompleteWithdrawal(requestId: number | bigint): string {
  return crowdstackingPoolInterface.encodeFunctionData('completeWithdrawal', [requestId]);
}

/**
 * Decode a completeWithdrawal result.
 */
export function decodeCompleteWithdrawal(data: string | Uint8Array): bigint {
  const hexData = toHex(data);
  const result = crowdstackingPoolInterface.decodeFunctionResult('completeWithdrawal', hexData);
  return BigInt(result[0]);
}

/**
 * Encode a cancelWithdrawal call.
 */
export function encodeCancelWithdrawal(requestId: number | bigint): string {
  return crowdstackingPoolInterface.encodeFunctionData('cancelWithdrawal', [requestId]);
}

/**
 * Encode a sharePrice call.
 */
export function encodeSharePrice(): string {
  return crowdstackingPoolInterface.encodeFunctionData('sharePrice');
}

/**
 * Decode a sharePrice result.
 */
export function decodeSharePrice(data: string | Uint8Array): bigint {
  const hexData = toHex(data);
  const result = crowdstackingPoolInterface.decodeFunctionResult('sharePrice', hexData);
  return BigInt(result[0]);
}

/**
 * Encode a getPosition call.
 */
export function encodeGetPosition(contributor: string): string {
  return crowdstackingPoolInterface.encodeFunctionData('getPosition', [contributor]);
}

/**
 * Decode a getPosition result.
 */
export function decodeGetPosition(data: string | Uint8Array): {
  shares: bigint;
  cumulativeContributed: bigint;
} {
  const hexData = toHex(data);
  const result = crowdstackingPoolInterface.decodeFunctionResult('getPosition', hexData);
  return {
    shares: BigInt(result[0]),
    cumulativeContributed: BigInt(result[1]),
  };
}

/**
 * Encode a getWithdrawalRequest call.
 */
export function encodeGetWithdrawalRequest(requestId: number | bigint): string {
  return crowdstackingPoolInterface.encodeFunctionData('getWithdrawalRequest', [requestId]);
}

/**
 * Decode a getWithdrawalRequest result.
 */
export function decodeGetWithdrawalRequest(data: string | Uint8Array): ContractWithdrawalRequest {
  const hexData = toHex(data);
  const result = crowdstackingPoolInterface.decodeFunctionResult('getWithdrawalRequest', hexData);
  const tuple = result[0];
  return {
    requester: tuple[0],
    shares: BigInt(tuple[1]),
    requestedAt: BigInt(tuple[2]),
    availableAt: BigInt(tuple[3]),
    status: Number(tuple[4]) as WithdrawalStatus,
  };
}

/**
 * Encode a convertToShares call.
 */
export function encodeConvertToShares(assets: bigint): string {
  return crowdstackingPoolInterface.encodeFunctionData('convertToShares', [assets]);
}

/**
 * Decode a convertToShares result.
 */
export function decodeConvertToShares(data: string | Uint8Array): bigint {
  const hexData = toHex(data);
  const result = crowdstackingPoolInterface.decodeFunctionResult('convertToShares', hexData);
  return BigInt(result[0]);
}

/**
 * Encode a convertToAssets call.
 */
export function encodeConvertToAssets(shares: bigint): string {
  return crowdstackingPoolInterface.encodeFunctionData('convertToAssets', [shares]);
}

/**
 * Decode a convertToAssets result.
 */
export function decodeConvertToAssets(data: string | Uint8Array): bigint {
  const hexData = toHex(data);
  const result = crowdstackingPoolInterface.decodeFunctionResult('convertToAssets', hexData);
  return BigInt(result[0]);
}

/**
 * Encode a totalShares call.
 */
export function encodeTotalShares(): string {
  return crowdstackingPoolInterface.encodeFunctionData('totalShares');
}

/**
 * Decode a totalShares result.
 */
export function decodeTotalShares(data: string | Uint8Array): bigint {
  const hexData = toHex(data);
  const result = crowdstackingPoolInterface.decodeFunctionResult('totalShares', hexData);
  return BigInt(result[0]);
}

/**
 * Encode a totalAssets call.
 */
export function encodeTotalAssets(): string {
  return crowdstackingPoolInterface.encodeFunctionData('totalAssets');
}

/**
 * Decode a totalAssets result.
 */
export function decodeTotalAssets(data: string | Uint8Array): bigint {
  const hexData = toHex(data);
  const result = crowdstackingPoolInterface.decodeFunctionResult('totalAssets', hexData);
  return BigInt(result[0]);
}

/**
 * Encode a paused call.
 */
export function encodePaused(): string {
  return crowdstackingPoolInterface.encodeFunctionData('paused');
}

/**
 * Decode a paused result.
 */
export function decodePaused(data: string | Uint8Array): boolean {
  const hexData = toHex(data);
  const result = crowdstackingPoolInterface.decodeFunctionResult('paused', hexData);
  return Boolean(result[0]);
}

/**
 * Encode a contributorCount call.
 */
export function encodeContributorCount(): string {
  return crowdstackingPoolInterface.encodeFunctionData('contributorCount');
}

/**
 * Decode a contributorCount result.
 */
export function decodeContributorCount(data: string | Uint8Array): bigint {
  const hexData = toHex(data);
  const result = crowdstackingPoolInterface.decodeFunctionResult('contributorCount', hexData);
  return BigInt(result[0]);
}
