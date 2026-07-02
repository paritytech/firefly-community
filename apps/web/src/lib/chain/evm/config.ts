/**
 * Contract configuration for BountyEscrow and FireflyReputation.
 *
 * Thin adapter over @cocuyo/network-config (the single network registry): contract addresses and
 * the EVM JSON-RPC URL come from the resolved network. The public API (`NetworkName`,
 * `getDefaultNetwork`, `getContractAddress`, `getRpcUrl`) is preserved for existing callers
 * (`useBountyEscrow`, `useFireflyReputation`).
 */

import {
  NETWORKS,
  resolveNetwork,
  selectNetworkId,
  type NetworkConfig,
  type NetworkId,
} from '@cocuyo/network-config';

/** Network name. Equal to {@link NetworkId} (`'paseo' | 'localhost'`). */
export type NetworkName = NetworkId;

/** Contracts addressed by the EVM hooks. */
type ContractName = 'bountyEscrow' | 'fireflyReputation';

/**
 * The network to read from: the explicit one when given (its raw registry entry), otherwise the
 * build-time resolved network — which applies per-field env overrides (e.g. an `https://`
 * `NEXT_PUBLIC_ASSET_HUB_RPC` overriding the EVM RPC).
 */
function networkFor(network?: NetworkName): NetworkConfig {
  return network ? NETWORKS[network] : resolveNetwork(process.env);
}

/** The active network id, selected from the build-time environment. */
export function getDefaultNetwork(): NetworkName {
  return selectNetworkId(process.env);
}

/** Get the deployed contract address for a network, or `null` if not deployed there. */
export function getContractAddress(contract: ContractName, network?: NetworkName): string | null {
  return networkFor(network).contracts[contract];
}

/** Get the EVM HTTP JSON-RPC URL for a network. */
export function getRpcUrl(network?: NetworkName): string {
  return networkFor(network).assetHub.evmRpc;
}
