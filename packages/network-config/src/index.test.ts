import { describe, expect, it } from 'vitest';
import {
  NETWORKS,
  isEvmAddress,
  requireKnownNetworkId,
  resolveNetwork,
  selectNetworkId,
  type NetworkConfig,
} from './index';

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX_GENESIS = /^0x[0-9a-fA-F]{64}$/;

describe('NETWORKS registry', () => {
  it('is internally well-formed for every entry', () => {
    for (const [key, net] of Object.entries(NETWORKS)) {
      expect(net.id).toBe(key);
      expect(net.label.length).toBeGreaterThan(0);
      expect(net.assetHub.substrateWs).toMatch(/^wss?:\/\//);
      expect(net.assetHub.evmRpc).toMatch(/^https?:\/\//);
      expect(Number.isInteger(net.assetHub.chainId)).toBe(true);
      expect(net.assetHub.genesisHash).toMatch(HEX_GENESIS);
      expect(net.pusd.asset).toMatch(HEX_ADDRESS);
      expect(net.bulletin.ipfsGateway).toMatch(/^https?:\/\//);
      expect(net.dim.genesisHash).toMatch(HEX_GENESIS);
    }
  });

  it('has canonical Paseo Next v2 endpoints', () => {
    const p = NETWORKS.paseo;
    expect(p.label).toBe('Paseo Next v2');
    expect(p.chainEnvironment).toBe('paseo');
    expect(p.assetHub.substrateWs).toBe('wss://paseo-asset-hub-next-rpc.polkadot.io');
    expect(p.assetHub.evmRpc).toBe('https://eth-rpc-paseo-next.polkadot.io');
    expect(p.assetHub.chainId).toBe(420420417);
    expect(p.bulletin.substrateWs).toBe('wss://paseo-bulletin-next-rpc.polkadot.io');
    expect(p.bulletin.ipfsGateway).toBe('https://paseo-bulletin-next-ipfs.polkadot.io/ipfs/');
    expect(p.contracts.bountyEscrow).toBe('0x276DA2f00730E98c621832919153ca84eC4981eD');
    expect(p.contracts.fireflyReputation).toBe('0xCD455CCb96Ed177609Daedcb4ec9884ECcC9688c');
    expect(p.contracts.crowdstackingPool).toBe('0x9C18b15B8875ee2134d3BDD95277D406e38eACF8');
    expect(p.contracts.allianceGovernance).toBe('0x21Be8596A58852AE871a49A2B21e0342036cfec3');
    expect(p.contracts.outletRegistry).toBe('0x1f50918664B5a1e2FAD7044dC4Ccf3A3f2e878A1');
    expect(p.contracts.contributorRegistry).toBe('0x0B5b2c18f7C631DBe5544CFAC933ecCd80A28567');
  });

  it('models localhost as an EVM-only target with paseo fallback for chain paths', () => {
    const l = NETWORKS.localhost;
    expect(l.assetHub.evmRpc).toBe('http://127.0.0.1:8545');
    expect(l.assetHub.chainId).toBe(31337);
    expect(l.contracts.bountyEscrow).toBe('0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512');
    // Substrate/Bulletin/DIM reuse paseo testnet in local dev.
    expect(l.bulletin.substrateWs).toBe(NETWORKS.paseo.bulletin.substrateWs);
    expect(l.dim.genesisHash).toBe(NETWORKS.paseo.dim.genesisHash);
  });

  it('uses one Asset Hub genesis hash for assetHub and dim', () => {
    expect(NETWORKS.paseo.dim.genesisHash).toBe(NETWORKS.paseo.assetHub.genesisHash);
  });
});

describe('isEvmAddress', () => {
  it('accepts a well-formed address and rejects length/hex violations', () => {
    expect(isEvmAddress('0x1234567890123456789012345678901234567890')).toBe(true);
    expect(isEvmAddress('0xABCDEF7890123456789012345678901234567890')).toBe(true);
    expect(isEvmAddress('0xnope')).toBe(false); // too short
    expect(isEvmAddress('0xZZZZ567890123456789012345678901234567890')).toBe(false); // non-hex
    expect(isEvmAddress('1234567890123456789012345678901234567890')).toBe(false); // no 0x
  });
});

describe('selectNetworkId (lenient — never throws)', () => {
  it('honours an explicit NEXT_PUBLIC_NETWORK', () => {
    expect(selectNetworkId({ NEXT_PUBLIC_NETWORK: 'paseo' })).toBe('paseo');
    expect(selectNetworkId({ NEXT_PUBLIC_NETWORK: 'localhost' })).toBe('localhost');
  });

  it('trims surrounding whitespace on the selector', () => {
    expect(selectNetworkId({ NEXT_PUBLIC_NETWORK: '  paseo  ' })).toBe('paseo');
  });

  it('falls back to the default for an explicit unknown id', () => {
    expect(selectNetworkId({ NEXT_PUBLIC_NETWORK: 'mainnet' })).toBe('localhost');
  });

  it('lets an explicit selector WIN over the legacy variable (no fall-through)', () => {
    // An explicit (even unknown) NEXT_PUBLIC_NETWORK must not be overridden by the legacy var.
    expect(
      selectNetworkId({ NEXT_PUBLIC_NETWORK: 'bogus', NEXT_PUBLIC_CHAIN_ENVIRONMENT: 'paseo' })
    ).toBe('localhost');
    expect(
      selectNetworkId({ NEXT_PUBLIC_NETWORK: 'localhost', NEXT_PUBLIC_CHAIN_ENVIRONMENT: 'paseo' })
    ).toBe('localhost');
  });

  it('consults legacy NEXT_PUBLIC_CHAIN_ENVIRONMENT only when NEXT_PUBLIC_NETWORK is absent', () => {
    expect(selectNetworkId({ NEXT_PUBLIC_CHAIN_ENVIRONMENT: 'paseo' })).toBe('paseo');
    expect(selectNetworkId({ NEXT_PUBLIC_CHAIN_ENVIRONMENT: 'localhost' })).toBe('localhost');
    // An unmapped upstream env (e.g. polkadot) has no registry entry → default.
    expect(selectNetworkId({ NEXT_PUBLIC_CHAIN_ENVIRONMENT: 'polkadot' })).toBe('localhost');
  });

  it('defaults to localhost when nothing is set', () => {
    expect(selectNetworkId({})).toBe('localhost');
    expect(selectNetworkId({ NEXT_PUBLIC_NETWORK: '   ' })).toBe('localhost');
  });
});

describe('requireKnownNetworkId (build-time guard)', () => {
  it('returns the id for known/legacy/unset selectors', () => {
    expect(requireKnownNetworkId({ NEXT_PUBLIC_NETWORK: 'paseo' })).toBe('paseo');
    expect(requireKnownNetworkId({ NEXT_PUBLIC_CHAIN_ENVIRONMENT: 'paseo' })).toBe('paseo');
    expect(requireKnownNetworkId({})).toBe('localhost');
  });

  it('throws on an explicit unknown NEXT_PUBLIC_NETWORK (incl. after trimming)', () => {
    expect(() => requireKnownNetworkId({ NEXT_PUBLIC_NETWORK: 'mainnet' })).toThrow(
      /Unknown network/
    );
    expect(() => requireKnownNetworkId({ NEXT_PUBLIC_NETWORK: '  mainnet  ' })).toThrow(/mainnet/);
  });
});

describe('resolveNetwork', () => {
  it('returns the selected registry entry', () => {
    expect(resolveNetwork({ NEXT_PUBLIC_NETWORK: 'paseo' }).id).toBe('paseo');
    expect(resolveNetwork({}).id).toBe('localhost');
  });

  it('returns an independent object (no shared mutation across calls)', () => {
    const a = resolveNetwork({ NEXT_PUBLIC_NETWORK: 'paseo' });
    const b = resolveNetwork({ NEXT_PUBLIC_NETWORK: 'paseo' });
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('routes a WS override to substrateWs and an HTTP override to evmRpc', () => {
    const ws = resolveNetwork({
      NEXT_PUBLIC_NETWORK: 'paseo',
      NEXT_PUBLIC_ASSET_HUB_RPC: 'wss://custom.example/ws',
    });
    expect(ws.assetHub.substrateWs).toBe('wss://custom.example/ws');
    expect(ws.assetHub.evmRpc).toBe(NETWORKS.paseo.assetHub.evmRpc);

    const http = resolveNetwork({
      NEXT_PUBLIC_NETWORK: 'paseo',
      NEXT_PUBLIC_ASSET_HUB_RPC: 'https://custom.example/rpc',
    });
    expect(http.assetHub.evmRpc).toBe('https://custom.example/rpc');
    expect(http.assetHub.substrateWs).toBe(NETWORKS.paseo.assetHub.substrateWs);
  });

  it('ignores an asset-hub RPC override with an unrecognised protocol', () => {
    const net = resolveNetwork({
      NEXT_PUBLIC_NETWORK: 'paseo',
      NEXT_PUBLIC_ASSET_HUB_RPC: 'ftp://custom.example',
    });
    expect(net.assetHub.substrateWs).toBe(NETWORKS.paseo.assetHub.substrateWs);
    expect(net.assetHub.evmRpc).toBe(NETWORKS.paseo.assetHub.evmRpc);
  });

  it('applies bulletin / ipfs / chainId overrides', () => {
    const net: NetworkConfig = resolveNetwork({
      NEXT_PUBLIC_NETWORK: 'paseo',
      NEXT_PUBLIC_BULLETIN_ENDPOINT: 'wss://bulletin.example/ws',
      NEXT_PUBLIC_IPFS_GATEWAY: 'https://ipfs.example/ipfs/',
      NEXT_PUBLIC_CHAIN_ID: '999',
    });
    expect(net.bulletin.substrateWs).toBe('wss://bulletin.example/ws');
    expect(net.bulletin.ipfsGateway).toBe('https://ipfs.example/ipfs/');
    expect(net.assetHub.chainId).toBe(999);
  });

  it('ignores bulletin / ipfs overrides with the wrong protocol', () => {
    const net = resolveNetwork({
      NEXT_PUBLIC_NETWORK: 'paseo',
      NEXT_PUBLIC_BULLETIN_ENDPOINT: 'https://not-a-ws-endpoint',
      NEXT_PUBLIC_IPFS_GATEWAY: 'ftp://nope',
    });
    expect(net.bulletin.substrateWs).toBe(NETWORKS.paseo.bulletin.substrateWs);
    expect(net.bulletin.ipfsGateway).toBe(NETWORKS.paseo.bulletin.ipfsGateway);
  });

  it('applies a valid pUSD asset override', () => {
    const net = resolveNetwork({
      NEXT_PUBLIC_NETWORK: 'paseo',
      NEXT_PUBLIC_PUSD_ASSET_ADDRESS: '0x1234567890123456789012345678901234567890',
    });
    expect(net.pusd.asset).toBe('0x1234567890123456789012345678901234567890');
  });

  it('ignores a pUSD override that is the wrong length OR contains non-hex characters', () => {
    const tooShort = resolveNetwork({
      NEXT_PUBLIC_NETWORK: 'paseo',
      NEXT_PUBLIC_PUSD_ASSET_ADDRESS: '0xnope',
    });
    expect(tooShort.pusd.asset).toBe(NETWORKS.paseo.pusd.asset);

    // 42 chars but non-hex — must be rejected (the length-only check would have passed this).
    const nonHex = resolveNetwork({
      NEXT_PUBLIC_NETWORK: 'paseo',
      NEXT_PUBLIC_PUSD_ASSET_ADDRESS: '0xZZZZ567890123456789012345678901234567890',
    });
    expect(nonHex.pusd.asset).toBe(NETWORKS.paseo.pusd.asset);
  });

  it('ignores blank and malformed (incl. hex-string) chain ids', () => {
    const net = resolveNetwork({
      NEXT_PUBLIC_NETWORK: 'paseo',
      NEXT_PUBLIC_ASSET_HUB_RPC: '   ',
      NEXT_PUBLIC_CHAIN_ID: 'not-a-number',
    });
    expect(net.assetHub.substrateWs).toBe(NETWORKS.paseo.assetHub.substrateWs);
    expect(net.assetHub.chainId).toBe(420420417);
    // '0x10' must NOT be silently read as decimal 16.
    expect(
      resolveNetwork({ NEXT_PUBLIC_NETWORK: 'paseo', NEXT_PUBLIC_CHAIN_ID: '0x10' }).assetHub
        .chainId
    ).toBe(420420417);
  });
});
