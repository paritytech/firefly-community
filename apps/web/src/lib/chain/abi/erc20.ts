/**
 * ERC20 ABI and Interface
 *
 * Standard ERC20 ABI for interacting with pUSD and other tokens.
 * Uses ethers.js Interface for ABI encoding/decoding.
 */

/* eslint-disable @typescript-eslint/no-unsafe-argument -- ethers Interface.decodeFunctionResult returns Result type with any[] elements */

import { Interface } from 'ethers';
import { toHex } from './utils';

// ============================================================
// ABI Definition
// ============================================================

/**
 * Standard ERC20 ABI with common functions and events.
 */
export const ERC20_ABI = [
  // Read functions
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',

  // Write functions
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',

  // Events
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
] as const;

// ============================================================
// Interface
// ============================================================

/**
 * ethers.js Interface for ERC20 encoding/decoding.
 */
export const erc20Interface = new Interface(ERC20_ABI);

// ============================================================
// Helper Functions
// ============================================================

/**
 * Encode an approve call.
 */
export function encodeApprove(spender: string, amount: bigint): string {
  return erc20Interface.encodeFunctionData('approve', [spender, amount]);
}

/**
 * Encode an allowance call.
 */
export function encodeAllowance(owner: string, spender: string): string {
  return erc20Interface.encodeFunctionData('allowance', [owner, spender]);
}

/**
 * Decode an allowance result.
 */
export function decodeAllowance(data: string | Uint8Array): bigint {
  const hexData = toHex(data);
  const result = erc20Interface.decodeFunctionResult('allowance', hexData);
  return BigInt(result[0]);
}
