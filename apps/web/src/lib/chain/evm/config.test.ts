/**
 * Tests for the contract-config adapter over @cocuyo/network-config.
 *
 * Registry shape (addresses, RPC URLs, network names) is tested in @cocuyo/network-config; here we
 * verify the adapter's public behaviour that callers depend on.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { getDefaultNetwork, getContractAddress, getRpcUrl } from './config';

describe('contract config adapter', () => {
  describe('getDefaultNetwork', () => {
    const originalEnv = process.env.NEXT_PUBLIC_NETWORK;

    afterEach(() => {
      process.env.NEXT_PUBLIC_NETWORK = originalEnv;
    });

    it('returns localhost by default', () => {
      delete process.env.NEXT_PUBLIC_NETWORK;
      expect(getDefaultNetwork()).toBe('localhost');
    });

    it('returns paseo when env is set', () => {
      process.env.NEXT_PUBLIC_NETWORK = 'paseo';
      expect(getDefaultNetwork()).toBe('paseo');
    });

    it('falls back to localhost for an unknown env value (lenient)', () => {
      process.env.NEXT_PUBLIC_NETWORK = 'unknown';
      expect(getDefaultNetwork()).toBe('localhost');
    });
  });

  describe('getContractAddress', () => {
    it('returns the deployed localhost addresses', () => {
      expect(getContractAddress('bountyEscrow', 'localhost')).toBe(
        '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
      );
      expect(getContractAddress('fireflyReputation', 'localhost')).toBe(
        '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'
      );
    });

    it('returns the deployed paseo addresses', () => {
      expect(getContractAddress('bountyEscrow', 'paseo')).toBe(
        '0x276DA2f00730E98c621832919153ca84eC4981eD'
      );
      expect(getContractAddress('fireflyReputation', 'paseo')).toBe(
        '0xCD455CCb96Ed177609Daedcb4ec9884ECcC9688c'
      );
    });

    it('uses the default network when none is specified', () => {
      const originalEnv = process.env.NEXT_PUBLIC_NETWORK;
      delete process.env.NEXT_PUBLIC_NETWORK;
      expect(getContractAddress('bountyEscrow')).toBe('0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512');
      process.env.NEXT_PUBLIC_NETWORK = originalEnv;
    });
  });

  describe('getRpcUrl', () => {
    it('returns the localhost EVM RPC URL', () => {
      expect(getRpcUrl('localhost')).toBe('http://127.0.0.1:8545');
    });

    it('returns the paseo EVM RPC URL', () => {
      expect(getRpcUrl('paseo')).toBe('https://eth-rpc-paseo-next.polkadot.io');
    });
  });

  describe('EVM RPC override on the default network', () => {
    const originalNetwork = process.env.NEXT_PUBLIC_NETWORK;
    const originalRpc = process.env.NEXT_PUBLIC_ASSET_HUB_RPC;

    afterEach(() => {
      process.env.NEXT_PUBLIC_NETWORK = originalNetwork;
      process.env.NEXT_PUBLIC_ASSET_HUB_RPC = originalRpc;
    });

    it('honours an https NEXT_PUBLIC_ASSET_HUB_RPC override on the default path', () => {
      // Regression guard: the default path must resolve overrides, not read the raw registry.
      process.env.NEXT_PUBLIC_NETWORK = 'paseo';
      process.env.NEXT_PUBLIC_ASSET_HUB_RPC = 'https://custom-evm.example/rpc';
      expect(getRpcUrl()).toBe('https://custom-evm.example/rpc');
    });

    it('ignores the override when an explicit network is passed', () => {
      process.env.NEXT_PUBLIC_ASSET_HUB_RPC = 'https://custom-evm.example/rpc';
      expect(getRpcUrl('paseo')).toBe('https://eth-rpc-paseo-next.polkadot.io');
    });
  });
});
