/**
 * Chain Configuration
 *
 * Centralized configuration for Asset Hub, pUSD, and smart contract addresses.
 * Uses environment variables with sensible testnet defaults.
 *
 * Supports fallback RPC endpoints for network resilience (pattern from t3rminal).
 *
 * Asset Hub / pUSD / contract values are sourced from @cocuyo/network-config (the single network
 * registry); feature flags remain network-independent build-time toggles.
 */

import { isEvmAddress, resolveNetwork } from '@cocuyo/network-config';

// ============================================================
// Types
// ============================================================

export interface ChainConfig {
  readonly assetHub: {
    /** Primary RPC endpoint */
    readonly rpc: string;
    /** Fallback RPC endpoints (tried in order if primary fails) */
    readonly fallbackRpcs: readonly string[];
    readonly chainId: number;
  };
  readonly pusd: {
    readonly address: `0x${string}`;
    readonly decimals: number;
    readonly symbol: string;
  };
  readonly contracts: {
    readonly crowdstackingPool: `0x${string}` | undefined;
    readonly allianceGovernance: `0x${string}` | undefined;
    readonly outletRegistry: `0x${string}` | undefined;
    readonly contributorRegistry: `0x${string}` | undefined;
  };
  readonly features: {
    readonly useMockPayment: boolean;
    readonly useChainContracts: boolean;
  };
  readonly payments: {
    /** SS58 recipient for on-chain native-PAS payments (e.g. bounty funding). */
    readonly recipient: string | undefined;
  };
}

// ============================================================
// Environment Helpers
// ============================================================

function getEnvAddress(key: string): `0x${string}` | undefined {
  const value = process.env[key]?.trim();
  if (value === undefined || value === '') return undefined;
  if (!isEvmAddress(value)) {
    console.warn(`Invalid address format for ${key}: ${value}`);
    return undefined;
  }
  // `value` is narrowed to `0x${string}` by isEvmAddress — no assertion needed.
  return value;
}

function getEnvBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === 'true') return true;
  if (value === 'false') return false;
  return defaultValue;
}

/** Read an SS58 address env var, validating the base58 shape; undefined if absent/invalid. */
function getEnvSs58(key: string): string | undefined {
  const value = process.env[key]?.trim();
  if (value === undefined || value.length === 0) return undefined;
  // Substrate SS58 addresses are base58 and typically 47-48 chars.
  if (!/^[1-9A-HJ-NP-Za-km-z]{46,50}$/.test(value)) {
    console.warn(`Invalid SS58 address format for ${key}: ${value}`);
    return undefined;
  }
  return value;
}

// ============================================================
// Configuration
// ============================================================

/**
 * Chain configuration constants.
 *
 * Defaults to Paseo testnet (Asset Hub) for development.
 * Set environment variables in .env.local for different environments.
 */
/**
 * Parse comma-separated RPC endpoints from environment variable.
 */
function parseRpcEndpoints(envVar: string | undefined): readonly string[] {
  if (envVar === undefined || envVar === '') return [];
  return envVar
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Active network, resolved once from the build-time environment. For a static export every
 * NEXT_PUBLIC_* value is baked in at build time, so a single resolution at module load is correct.
 * The resolver applies per-field overrides (NEXT_PUBLIC_ASSET_HUB_RPC routed by protocol,
 * NEXT_PUBLIC_PUSD_ASSET_ADDRESS, NEXT_PUBLIC_CHAIN_ID) on top of the selected registry entry.
 */
const NETWORK = resolveNetwork(process.env);

export const CHAIN_CONFIG: ChainConfig = {
  assetHub: {
    // Substrate WS endpoint (consumed by asset-hub-provider's getWsProvider). A wss:// value in
    // NEXT_PUBLIC_ASSET_HUB_RPC overrides this; an https:// value is routed to the EVM RPC instead
    // of being mis-fed to the WS provider.
    rpc: NETWORK.assetHub.substrateWs,
    fallbackRpcs: (() => {
      const parsed = parseRpcEndpoints(process.env.NEXT_PUBLIC_ASSET_HUB_FALLBACK_RPCS);
      return parsed.length > 0 ? parsed : [...NETWORK.assetHub.substrateFallbackWs];
    })(),
    chainId: NETWORK.assetHub.chainId,
  },
  pusd: {
    address: NETWORK.pusd.asset,
    decimals: NETWORK.pusd.decimals,
    symbol: NETWORK.pusd.symbol,
  },
  contracts: {
    // These four have no per-network default yet; env override wins, else the registry value.
    crowdstackingPool:
      getEnvAddress('NEXT_PUBLIC_CROWDSTACKING_POOL_ADDRESS') ??
      NETWORK.contracts.crowdstackingPool ??
      undefined,
    allianceGovernance:
      getEnvAddress('NEXT_PUBLIC_ALLIANCE_GOVERNANCE_ADDRESS') ??
      NETWORK.contracts.allianceGovernance ??
      undefined,
    outletRegistry:
      getEnvAddress('NEXT_PUBLIC_OUTLET_REGISTRY_ADDRESS') ??
      NETWORK.contracts.outletRegistry ??
      undefined,
    contributorRegistry:
      getEnvAddress('NEXT_PUBLIC_CONTRIBUTOR_REGISTRY_ADDRESS') ??
      NETWORK.contracts.contributorRegistry ??
      undefined,
  },
  features: {
    // Network-independent build-time toggles. Default to mock payment + session cache in dev.
    useMockPayment: getEnvBool('NEXT_PUBLIC_USE_MOCK_PAYMENT', true),
    useChainContracts: getEnvBool('NEXT_PUBLIC_USE_CHAIN_CONTRACTS', false),
  },
  payments: {
    recipient: getEnvSs58('NEXT_PUBLIC_PAYMENT_RECIPIENT'),
  },
};

// ============================================================
// Helpers
// ============================================================

/**
 * Check if chain contracts are configured and enabled.
 */
export function isChainContractsEnabled(): boolean {
  return (
    CHAIN_CONFIG.features.useChainContracts &&
    CHAIN_CONFIG.contracts.crowdstackingPool !== undefined
  );
}

/**
 * Check if a specific contract is configured.
 */
export function isContractConfigured(contract: keyof ChainConfig['contracts']): boolean {
  return CHAIN_CONFIG.contracts[contract] !== undefined;
}

/**
 * Get a contract address, throwing if not configured.
 * Use when contract address is required for operation.
 */
export function requireContractAddress(contract: keyof ChainConfig['contracts']): `0x${string}` {
  const address = CHAIN_CONFIG.contracts[contract];
  if (address === undefined) {
    throw new Error(
      `Contract ${contract} is not configured. Set NEXT_PUBLIC_${contract.toUpperCase().replace(/([A-Z])/g, '_$1')}_ADDRESS in environment.`
    );
  }
  return address;
}

/**
 * Parse a pUSD amount string to raw bigint.
 * @param amount Amount string (e.g., "10.50")
 * @returns Raw amount as bigint
 */
export function parsePUSDToRaw(amount: string): bigint {
  const { decimals } = CHAIN_CONFIG.pusd;
  const parts = amount.split('.');
  const whole = parts[0] ?? '0';
  const fraction = parts[1] ?? '';
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFraction);
}
