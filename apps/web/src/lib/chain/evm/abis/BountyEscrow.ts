/**
 * BountyEscrow ABI - Essential functions for frontend interaction.
 */
export const BOUNTY_ESCROW_ABI = [
  // View functions
  {
    inputs: [{ name: 'bountyId_', type: 'bytes32' }],
    name: 'getBounty',
    outputs: [
      {
        components: [
          { name: 'funder', type: 'address' },
          { name: 'paymentAsset', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'expiresAt', type: 'uint256' },
          { name: 'status', type: 'uint8' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'bountyId_', type: 'bytes32' }],
    name: 'bountyExists',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'bountyId_', type: 'bytes32' }],
    name: 'isExpired',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },

  // Write functions
  {
    inputs: [
      { name: 'bountyId_', type: 'bytes32' },
      { name: 'paymentAsset_', type: 'address' },
      { name: 'amount_', type: 'uint256' },
      { name: 'expiresAt_', type: 'uint256' },
    ],
    name: 'fundBounty',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'bountyId_', type: 'bytes32' },
      {
        components: [
          { name: 'recipient', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        name: 'allocations_',
        type: 'tuple[]',
      },
    ],
    name: 'releaseBounty',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'bountyId_', type: 'bytes32' }],
    name: 'cancelBounty',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'bountyId_', type: 'bytes32' }],
    name: 'claimExpired',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'bountyId', type: 'bytes32' },
      { indexed: true, name: 'funder', type: 'address' },
      { indexed: false, name: 'paymentAsset', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'expiresAt', type: 'uint256' },
    ],
    name: 'BountyFunded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'bountyId', type: 'bytes32' },
      { indexed: false, name: 'recipientCount', type: 'uint256' },
      { indexed: false, name: 'totalAmount', type: 'uint256' },
    ],
    name: 'BountyReleased',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'bountyId', type: 'bytes32' },
      { indexed: false, name: 'refundAmount', type: 'uint256' },
    ],
    name: 'BountyCancelled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'bountyId', type: 'bytes32' },
      { indexed: false, name: 'refundAmount', type: 'uint256' },
    ],
    name: 'BountyExpired',
    type: 'event',
  },
] as const;

// Bounty status enum matching contract
export enum BountyStatus {
  OPEN = 0,
  CLOSED = 1,
  CANCELLED = 2,
  EXPIRED = 3,
}

// TypeScript types for contract interactions
export interface OnChainBounty {
  funder: string;
  paymentAsset: string;
  amount: bigint;
  expiresAt: bigint;
  status: BountyStatus;
}

export interface Allocation {
  recipient: string;
  amount: bigint;
}
