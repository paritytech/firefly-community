/**
 * Hook for interacting with the BountyEscrow contract.
 *
 * Provides methods to:
 * - Read bounty state
 * - Fund new bounties
 * - Release funds to contributors
 * - Cancel or claim expired bounties
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { getContractAddress, getRpcUrl, type NetworkName } from '@/lib/chain/evm/config';
import { createLogger } from '@/lib/logging';

const log = createLogger('useBountyEscrow');
import {
  BOUNTY_ESCROW_ABI,
  BountyStatus,
  type OnChainBounty,
  type Allocation,
} from '@/lib/chain/evm/abis';

// Native asset sentinel (address(0) in contract)
const NATIVE_ASSET = ethers.ZeroAddress;

export interface UseBountyEscrowOptions {
  network?: NetworkName;
}

export interface BountyEscrowState {
  isLoading: boolean;
  error: string | null;
}

export interface UseBountyEscrowResult extends BountyEscrowState {
  contractAddress: string | null;
  getBounty: (bountyId: string) => Promise<OnChainBounty | null>;
  bountyExists: (bountyId: string) => Promise<boolean>;
  isExpired: (bountyId: string) => Promise<boolean>;
  isPaused: () => Promise<boolean>;
  fundBounty: (
    signer: ethers.Signer,
    bountyId: string,
    amount: bigint,
    expiresAt: number,
    paymentAsset?: string
  ) => Promise<string>;
  releaseBounty: (
    signer: ethers.Signer,
    bountyId: string,
    allocations: Allocation[]
  ) => Promise<string>;
  cancelBounty: (signer: ethers.Signer, bountyId: string) => Promise<string>;
  claimExpired: (signer: ethers.Signer, bountyId: string) => Promise<string>;
  toBountyId: (id: string) => string;
  NATIVE_ASSET: string;
  BountyStatus: typeof BountyStatus;
}

export function useBountyEscrow(options: UseBountyEscrowOptions = {}): UseBountyEscrowResult {
  const { network } = options;
  const [state, setState] = useState<BountyEscrowState>({
    isLoading: false,
    error: null,
  });

  // Get contract instance (read-only)
  const getReadContract = useCallback((): ethers.Contract => {
    const address = getContractAddress('bountyEscrow', network);
    if (address === null) {
      throw new Error('BountyEscrow contract not deployed on this network');
    }
    const provider = new ethers.JsonRpcProvider(getRpcUrl(network));
    return new ethers.Contract(address, BOUNTY_ESCROW_ABI, provider);
  }, [network]);

  // Get contract instance (with signer for writes)
  const getWriteContract = useCallback(
    (signer: ethers.Signer): ethers.Contract => {
      const address = getContractAddress('bountyEscrow', network);
      if (address === null) {
        throw new Error('BountyEscrow contract not deployed on this network');
      }
      return new ethers.Contract(address, BOUNTY_ESCROW_ABI, signer);
    },
    [network]
  );

  // Convert bounty ID string to bytes32
  const toBountyId = useCallback((id: string): string => {
    return ethers.keccak256(ethers.toUtf8Bytes(id));
  }, []);

  // Read: Get bounty details
  const getBounty = useCallback(
    async (bountyId: string): Promise<OnChainBounty | null> => {
      try {
        const contract = getReadContract();
        const id = toBountyId(bountyId);
        const exists = (await contract.getFunction('bountyExists')(id)) as boolean;
        if (!exists) return null;

        const bounty = (await contract.getFunction('getBounty')(id)) as {
          funder: string;
          paymentAsset: string;
          amount: bigint;
          expiresAt: bigint;
          status: bigint;
        };
        return {
          funder: bounty.funder,
          paymentAsset: bounty.paymentAsset,
          amount: bounty.amount,
          expiresAt: bounty.expiresAt,
          status: Number(bounty.status) as BountyStatus,
        };
      } catch (err) {
        log.error('Failed to get bounty', 'getBounty', err, { bountyId });
        return null;
      }
    },
    [getReadContract, toBountyId]
  );

  // Read: Check if bounty exists
  const bountyExists = useCallback(
    async (bountyId: string): Promise<boolean> => {
      try {
        const contract = getReadContract();
        const result = (await contract.getFunction('bountyExists')(
          toBountyId(bountyId)
        )) as boolean;
        return result;
      } catch {
        return false;
      }
    },
    [getReadContract, toBountyId]
  );

  // Read: Check if bounty is expired
  const isExpired = useCallback(
    async (bountyId: string): Promise<boolean> => {
      try {
        const contract = getReadContract();
        const result = (await contract.getFunction('isExpired')(toBountyId(bountyId))) as boolean;
        return result;
      } catch {
        return false;
      }
    },
    [getReadContract, toBountyId]
  );

  // Read: Check if contract is paused
  const isPaused = useCallback(async (): Promise<boolean> => {
    try {
      const contract = getReadContract();
      const result = (await contract.getFunction('paused')()) as boolean;
      return result;
    } catch {
      return false;
    }
  }, [getReadContract]);

  // Write: Fund a new bounty
  const fundBounty = useCallback(
    async (
      signer: ethers.Signer,
      bountyId: string,
      amount: bigint,
      expiresAt: number,
      paymentAsset: string = NATIVE_ASSET
    ): Promise<string> => {
      setState({ isLoading: true, error: null });
      try {
        const contract = getWriteContract(signer);
        const id = toBountyId(bountyId);

        const tx = (await contract.getFunction('fundBounty')(id, paymentAsset, amount, expiresAt, {
          value: paymentAsset === NATIVE_ASSET ? amount : 0n,
        })) as ethers.ContractTransactionResponse;

        const receipt = await tx.wait();
        setState({ isLoading: false, error: null });
        return receipt?.hash ?? '';
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fund bounty';
        setState({ isLoading: false, error: message });
        throw err;
      }
    },
    [getWriteContract, toBountyId]
  );

  // Write: Release bounty funds to recipients
  const releaseBounty = useCallback(
    async (signer: ethers.Signer, bountyId: string, allocations: Allocation[]): Promise<string> => {
      setState({ isLoading: true, error: null });
      try {
        const contract = getWriteContract(signer);
        const id = toBountyId(bountyId);

        const tx = (await contract.getFunction('releaseBounty')(
          id,
          allocations
        )) as ethers.ContractTransactionResponse;
        const receipt = await tx.wait();
        setState({ isLoading: false, error: null });
        return receipt?.hash ?? '';
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to release bounty';
        setState({ isLoading: false, error: message });
        throw err;
      }
    },
    [getWriteContract, toBountyId]
  );

  // Write: Cancel bounty and refund
  const cancelBounty = useCallback(
    async (signer: ethers.Signer, bountyId: string): Promise<string> => {
      setState({ isLoading: true, error: null });
      try {
        const contract = getWriteContract(signer);
        const id = toBountyId(bountyId);

        const tx = (await contract.getFunction('cancelBounty')(
          id
        )) as ethers.ContractTransactionResponse;
        const receipt = await tx.wait();
        setState({ isLoading: false, error: null });
        return receipt?.hash ?? '';
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to cancel bounty';
        setState({ isLoading: false, error: message });
        throw err;
      }
    },
    [getWriteContract, toBountyId]
  );

  // Write: Claim expired bounty (refund to funder)
  const claimExpired = useCallback(
    async (signer: ethers.Signer, bountyId: string): Promise<string> => {
      setState({ isLoading: true, error: null });
      try {
        const contract = getWriteContract(signer);
        const id = toBountyId(bountyId);

        const tx = (await contract.getFunction('claimExpired')(
          id
        )) as ethers.ContractTransactionResponse;
        const receipt = await tx.wait();
        setState({ isLoading: false, error: null });
        return receipt?.hash ?? '';
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to claim expired bounty';
        setState({ isLoading: false, error: message });
        throw err;
      }
    },
    [getWriteContract, toBountyId]
  );

  // Contract address for display
  const contractAddress = useMemo(() => getContractAddress('bountyEscrow', network), [network]);

  return {
    // State
    ...state,
    contractAddress,

    // Read methods
    getBounty,
    bountyExists,
    isExpired,
    isPaused,

    // Write methods
    fundBounty,
    releaseBounty,
    cancelBounty,
    claimExpired,

    // Utilities
    toBountyId,
    NATIVE_ASSET,
    BountyStatus,
  };
}
