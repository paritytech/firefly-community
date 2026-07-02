/**
 * @cocuyo/network-config — single source of truth for Firefly Network chain configuration.
 *
 * Leaf package: no app or sibling-package imports, no runtime dependencies. Both `apps/web` and
 * the `packages/*` consume the resolved {@link NetworkConfig} (or a {@link NetworkId}); they must
 * never read `process.env` for network specifics themselves.
 *
 * IMPORTANT — build-time, not runtime. `apps/web` is a Next.js static export
 * (`output: 'export'`), so every `NEXT_PUBLIC_*` value is baked into the bundle at build time.
 * One built artifact therefore targets exactly one network; "switching networks" means rebuild +
 * redeploy. {@link resolveNetwork} takes an explicit `source` map so a future runtime-config
 * mechanism (a fetched JSON / host-injected object) can reuse it unchanged.
 */

/** EVM (Ethereum-style) address. */
export type EvmAddress = `0x${string}`;

/** A `0x`-prefixed hex string (e.g. a genesis hash). */
export type HexString = `0x${string}`;

/**
 * Stable network identifiers. Deliberately equal to the legacy `NetworkName` values
 * (`'paseo' | 'localhost'`) used by `apps/web` contract hooks, so the migration needs no caller
 * churn. `'polkadot'` / `'kusama'` are added here when they become real deployment targets (their
 * endpoint/contract values are not yet known and are intentionally not invented).
 */
export type NetworkId = 'paseo' | 'localhost';

/**
 * Upstream `@polkadot-apps/chain-client` environment key. The live chain + Bulletin connection is
 * created from this via `getChainAPI(env)` / `BulletinClient.create(env)`, which use upstream
 * presets and accept no endpoint override.
 *
 * NOTE: upstream's `'paseo'` preset currently targets *legacy* Paseo, not Paseo Next v2. The
 * `assetHub.substrateWs` / `bulletin.*` fields below are the intended Next v2 endpoints; they only
 * take effect on the live connection if the app is switched to the lower-level
 * `createChainClient({ rpcs })` / `BulletinClient.from(api, gateway)` path (see
 * NETWORK_CONFIG_PLAN §8, PR-3). Today they drive the EVM-contracts, IPFS-gateway, and DIM paths.
 */
export type ChainEnvironment = 'polkadot' | 'kusama' | 'paseo';

/** Complete, self-contained configuration for one network. */
export interface NetworkConfig {
  readonly id: NetworkId;
  /** Human-readable label, e.g. "Paseo Next v2". */
  readonly label: string;
  /** Upstream preset key for the live chain/Bulletin connection. */
  readonly chainEnvironment: ChainEnvironment;
  readonly assetHub: {
    /** Substrate WS endpoint (for `@polkadot-apps/chain-client` / papi). */
    readonly substrateWs: string;
    /** Additional Substrate WS endpoints, tried in order after the primary. */
    readonly substrateFallbackWs: readonly string[];
    /** EVM HTTP JSON-RPC endpoint (for ethers / contract calls). */
    readonly evmRpc: string;
    /** EVM chain id. */
    readonly chainId: number;
    /** Genesis hash (used by the DIM host provider and chain verification). */
    readonly genesisHash: HexString;
  };
  readonly pusd: {
    /** pUSD asset address. Every network needs one to function, so this is never null. */
    readonly asset: EvmAddress;
    readonly decimals: number;
    readonly symbol: string;
  };
  readonly bulletin: {
    /** Bulletin chain Substrate WS endpoint. */
    readonly substrateWs: string;
    /** IPFS gateway for content retrieval (CID is appended). */
    readonly ipfsGateway: string;
  };
  readonly dim: {
    /** Substrate WS endpoint for DIM (Asset Hub). */
    readonly substrateWs: string;
    /** Asset Hub genesis hash for the DIM host provider. */
    readonly genesisHash: HexString;
  };
  readonly contracts: {
    readonly crowdstackingPool: EvmAddress | null;
    readonly allianceGovernance: EvmAddress | null;
    readonly outletRegistry: EvmAddress | null;
    readonly contributorRegistry: EvmAddress | null;
    readonly bountyEscrow: EvmAddress | null;
    readonly fireflyReputation: EvmAddress | null;
  };
}

/**
 * Paseo Asset Hub genesis hash. Matches the value `packages/identity` currently uses for the DIM
 * host provider; Asset Hub and DIM share it (DIM lives on Asset Hub).
 */
const PASEO_ASSET_HUB_GENESIS: HexString =
  '0x862c83e6860dd53eb70de3a93e8e7bbab6bef3dc8fbf9a3e8c532f6e364fd7f2';

/** pUSD (dotUSD) token on Paseo Asset Hub. Mirrors `apps/web` chain config. */
const PASEO_PUSD_ASSET: EvmAddress = '0xFbBd09cF4a6d1F160473537FB8A4Fc502ED49FB2';

/**
 * Canonical endpoint values sourced from `triangle-status/environments.json` (env id
 * `paseo-next-v2`); EVM RPC confirmed via `devops-cloud-infra` Cloudflare DNS. All six contracts
 * deployed to Paseo Asset Hub (eth-rpc-paseo-next) on 2026-06-28 and verified on-chain
 * (`eth_getCode` non-empty); addresses from `packages/contracts/deployments/paseo.json`.
 */
const PASEO_NEXT_V2: NetworkConfig = {
  id: 'paseo',
  label: 'Paseo Next v2',
  chainEnvironment: 'paseo',
  assetHub: {
    substrateWs: 'wss://paseo-asset-hub-next-rpc.polkadot.io',
    substrateFallbackWs: [],
    evmRpc: 'https://eth-rpc-paseo-next.polkadot.io',
    chainId: 420420417,
    genesisHash: PASEO_ASSET_HUB_GENESIS,
  },
  pusd: {
    asset: PASEO_PUSD_ASSET,
    decimals: 6,
    symbol: 'dotUSD',
  },
  bulletin: {
    substrateWs: 'wss://paseo-bulletin-next-rpc.polkadot.io',
    ipfsGateway: 'https://paseo-bulletin-next-ipfs.polkadot.io/ipfs/',
  },
  dim: {
    substrateWs: 'wss://paseo-asset-hub-next-rpc.polkadot.io',
    genesisHash: PASEO_ASSET_HUB_GENESIS,
  },
  contracts: {
    crowdstackingPool: '0x9C18b15B8875ee2134d3BDD95277D406e38eACF8',
    allianceGovernance: '0x21Be8596A58852AE871a49A2B21e0342036cfec3',
    outletRegistry: '0x1f50918664B5a1e2FAD7044dC4Ccf3A3f2e878A1',
    contributorRegistry: '0x0B5b2c18f7C631DBe5544CFAC933ecCd80A28567',
    bountyEscrow: '0x276DA2f00730E98c621832919153ca84eC4981eD',
    fireflyReputation: '0xCD455CCb96Ed177609Daedcb4ec9884ECcC9688c',
  },
};

/**
 * Local hardhat node for EVM contract development. There is no local Substrate node, so the
 * chain/Bulletin/DIM fields fall back to Paseo Next v2 (a dev hitting those paths talks to the
 * testnet) while the EVM RPC, chain id, and contract addresses point at the local deployment.
 */
const LOCALHOST: NetworkConfig = {
  id: 'localhost',
  label: 'Localhost (hardhat)',
  chainEnvironment: 'paseo',
  assetHub: {
    substrateWs: PASEO_NEXT_V2.assetHub.substrateWs,
    substrateFallbackWs: [],
    evmRpc: 'http://127.0.0.1:8545',
    chainId: 31337,
    genesisHash: PASEO_ASSET_HUB_GENESIS,
  },
  pusd: PASEO_NEXT_V2.pusd,
  bulletin: PASEO_NEXT_V2.bulletin,
  dim: PASEO_NEXT_V2.dim,
  contracts: {
    crowdstackingPool: null,
    allianceGovernance: null,
    outletRegistry: null,
    contributorRegistry: null,
    bountyEscrow: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    fireflyReputation: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
  },
};

/** The network registry. Exhaustive over {@link NetworkId}. */
export const NETWORKS: Readonly<Record<NetworkId, NetworkConfig>> = {
  paseo: PASEO_NEXT_V2,
  localhost: LOCALHOST,
};

/** All known network ids (internal — used for selection and error messages). */
const NETWORK_IDS: readonly NetworkId[] = ['paseo', 'localhost'];

/** Type guard: is `value` a known {@link NetworkId}? (internal) */
function isNetworkId(value: string | undefined): value is NetworkId {
  return value === 'paseo' || value === 'localhost';
}

/**
 * Default network when no (or an unrecognised) selector is set. Mirrors today's conservative
 * behaviour in `contracts/config.ts` (anything that is not `paseo` → `localhost`).
 */
const DEFAULT_NETWORK_ID: NetworkId = 'localhost';

/** Read a config value, trimmed. Returns `undefined` for an absent or blank value. */
function read(
  source: Readonly<Record<string, string | undefined>>,
  key: string
): string | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Build error message listing valid ids. */
function unknownNetworkError(value: string): Error {
  return new Error(
    `Unknown network "${value}". Valid ids: ${NETWORK_IDS.join(', ')}. ` +
      `Set NEXT_PUBLIC_NETWORK to one of these.`
  );
}

/**
 * Select the {@link NetworkId} from a config source. **Lenient — never throws.**
 *
 * An explicit `NEXT_PUBLIC_NETWORK` wins outright: a known value is used; any other non-blank value
 * falls back to {@link DEFAULT_NETWORK_ID} and is NOT overridden by the legacy variable. Only when
 * `NEXT_PUBLIC_NETWORK` is absent is the legacy `NEXT_PUBLIC_CHAIN_ENVIRONMENT` consulted
 * (`'paseo'`/`'localhost'` map; one-release fallback). Use {@link requireKnownNetworkId} for a
 * build-time guard that rejects an explicit typo instead of defaulting.
 */
export function selectNetworkId(source: Readonly<Record<string, string | undefined>>): NetworkId {
  const explicit = read(source, 'NEXT_PUBLIC_NETWORK');
  if (explicit !== undefined) return isNetworkId(explicit) ? explicit : DEFAULT_NETWORK_ID;

  const legacy = read(source, 'NEXT_PUBLIC_CHAIN_ENVIRONMENT');
  if (legacy === 'paseo' || legacy === 'localhost') return legacy;

  return DEFAULT_NETWORK_ID;
}

/**
 * Like {@link selectNetworkId}, but **throws** on an explicit but unrecognised
 * `NEXT_PUBLIC_NETWORK`. Intended for a build-time guard (NETWORK_CONFIG_PLAN PR-5) so a
 * misconfigured production build fails loudly instead of silently shipping the localhost default.
 */
export function requireKnownNetworkId(
  source: Readonly<Record<string, string | undefined>>
): NetworkId {
  const explicit = read(source, 'NEXT_PUBLIC_NETWORK');
  if (explicit !== undefined && !isNetworkId(explicit)) {
    throw unknownNetworkError(explicit);
  }
  return selectNetworkId(source);
}

/** Optional per-field build-time overrides layered on top of the selected registry entry. */
interface NetworkOverrides {
  readonly assetHubSubstrateWs?: string;
  readonly assetHubEvmRpc?: string;
  readonly chainId?: number;
  readonly pusdAsset?: EvmAddress;
  readonly bulletinSubstrateWs?: string;
  readonly ipfsGateway?: string;
}

/** Parse a positive decimal integer; `undefined` for blank or non-decimal input. */
function parseChainId(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return n > 0 ? n : undefined;
}

/** Type guard for a well-formed EVM address (`0x` + 40 hex chars). */
export function isEvmAddress(value: string): value is EvmAddress {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function readOverrides(source: Readonly<Record<string, string | undefined>>): NetworkOverrides {
  const overrides: { -readonly [K in keyof NetworkOverrides]: NetworkOverrides[K] } = {};

  // NEXT_PUBLIC_ASSET_HUB_RPC historically held an EVM HTTP RPC in deploy configs but a Substrate
  // WS endpoint in code defaults. Route by protocol so neither role is silently mis-assigned; an
  // unrecognised protocol is ignored.
  const assetHubRpc = read(source, 'NEXT_PUBLIC_ASSET_HUB_RPC');
  if (assetHubRpc !== undefined) {
    if (assetHubRpc.startsWith('wss://') || assetHubRpc.startsWith('ws://')) {
      overrides.assetHubSubstrateWs = assetHubRpc;
    } else if (assetHubRpc.startsWith('https://') || assetHubRpc.startsWith('http://')) {
      overrides.assetHubEvmRpc = assetHubRpc;
    }
  }

  const pusd = read(source, 'NEXT_PUBLIC_PUSD_ASSET_ADDRESS');
  if (pusd !== undefined && isEvmAddress(pusd)) overrides.pusdAsset = pusd;

  // Bulletin is a Substrate WS endpoint; the IPFS gateway is an HTTP(S) URL. Validate the
  // protocol at the boundary (consistent with the pUSD/chain-id overrides); ignore malformed.
  const bulletin = read(source, 'NEXT_PUBLIC_BULLETIN_ENDPOINT');
  if (bulletin !== undefined && (bulletin.startsWith('wss://') || bulletin.startsWith('ws://'))) {
    overrides.bulletinSubstrateWs = bulletin;
  }

  const ipfs = read(source, 'NEXT_PUBLIC_IPFS_GATEWAY');
  if (ipfs !== undefined && (ipfs.startsWith('https://') || ipfs.startsWith('http://'))) {
    overrides.ipfsGateway = ipfs;
  }

  const chainId = parseChainId(read(source, 'NEXT_PUBLIC_CHAIN_ID'));
  if (chainId !== undefined) overrides.chainId = chainId;

  return overrides;
}

function applyOverrides(base: NetworkConfig, o: NetworkOverrides): NetworkConfig {
  return {
    ...base,
    assetHub: {
      ...base.assetHub,
      substrateWs: o.assetHubSubstrateWs ?? base.assetHub.substrateWs,
      evmRpc: o.assetHubEvmRpc ?? base.assetHub.evmRpc,
      chainId: o.chainId ?? base.assetHub.chainId,
    },
    pusd: {
      ...base.pusd,
      asset: o.pusdAsset ?? base.pusd.asset,
    },
    bulletin: {
      ...base.bulletin,
      substrateWs: o.bulletinSubstrateWs ?? base.bulletin.substrateWs,
      ipfsGateway: o.ipfsGateway ?? base.bulletin.ipfsGateway,
    },
  };
}

/**
 * Resolve the active {@link NetworkConfig} from a config source (build-time `process.env`, or a
 * runtime config object later). Pure: no globals, no caching, no side effects — the same source
 * always yields an equal-but-independent object. The app layer is responsible for any caching.
 *
 * Selection is lenient (see {@link selectNetworkId}); pair with {@link requireKnownNetworkId} in a
 * build step if you want a misconfigured selector to fail the build.
 *
 * @param source - key/value config (typically `process.env`).
 */
export function resolveNetwork(
  source: Readonly<Record<string, string | undefined>>
): NetworkConfig {
  const base = NETWORKS[selectNetworkId(source)];
  return applyOverrides(base, readOverrides(source));
}
