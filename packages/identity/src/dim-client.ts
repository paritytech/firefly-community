/**
 * DIM Client — Decentralized Identity Module integration.
 *
 * DIM provides proof-of-personhood on Paseo Asset Hub.
 * This client handles credential verification and signing.
 */

import type { DIMCredential } from '@cocuyo/types';
import { createDIMCredential } from '@cocuyo/types';
import { NETWORKS } from '@cocuyo/network-config';

/**
 * DIM credential with metadata.
 */
export interface DIMCredentialInfo {
  /** The credential hash (public identifier) */
  readonly hash: DIMCredential;
  /** Whether the credential is currently valid */
  readonly isValid: boolean;
  /** When the credential was verified */
  readonly verifiedAt: number;
  /** When the credential expires (if applicable) */
  readonly expiresAt?: number;
}

/**
 * Status of DIM verification.
 */
export type DIMStatus =
  | 'unknown' // Haven't checked yet
  | 'checking' // Checking credential status
  | 'unverified' // No valid credential
  | 'verified' // Has valid credential
  | 'expired' // Credential has expired
  | 'error'; // Error during verification

/**
 * DIM client for credential management.
 */
export interface DIMClient {
  /** Check current credential status */
  getStatus(): Promise<DIMStatus>;

  /** Get credential info if verified */
  getCredential(): Promise<DIMCredentialInfo | null>;

  /** Start verification process (redirects to DIM) */
  verify(): Promise<DIMCredentialInfo>;

  /** Sign data with credential */
  sign(data: Uint8Array): Promise<Uint8Array>;

  /** Verify a signature from another credential */
  verifySignature(
    data: Uint8Array,
    signature: Uint8Array,
    credential: DIMCredential
  ): Promise<boolean>;
}

// DIM lives on Asset Hub. Endpoint + genesis are sourced from the single network registry
// (@cocuyo/network-config) rather than hardcoded here; DIM is only available on the paseo testnet.
const PASEO_ASSET_HUB_GENESIS = NETWORKS.paseo.dim.genesisHash;

// WebSocket RPC endpoint for Desktop fallback.
const WS_RPC_ENDPOINT = NETWORKS.paseo.dim.substrateWs;

/**
 * Check if running in Polkadot Desktop (native webview).
 *
 * createPapiProvider() routes via the deprecated host_jsonrpc_message_* channel
 * which is NOT wired into Desktop's chainConnectionManager.
 */
function isDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as unknown as Record<string, unknown>).__HOST_WEBVIEW_MARK__ === true;
}

/**
 * Create a DIM client.
 *
 * In Triangle host, this uses the chain provider.
 * In standalone mode, this returns a mock client.
 */
export async function createDIMClient(options?: {
  /** For testing: provide a mock credential */
  mockCredential?: DIMCredentialInfo;
}): Promise<DIMClient> {
  // Check if we're in Triangle host
  const isInHost = typeof window !== 'undefined' && window.self !== window.top;

  if (!isInHost || options?.mockCredential) {
    // Return mock client for development/testing
    return createMockDIMClient(options?.mockCredential);
  }

  // In production Triangle environment, use real chain client
  return createProductionDIMClient();
}

/**
 * Mock DIM client for development.
 */
function createMockDIMClient(mockCredential?: DIMCredentialInfo): DIMClient {
  let credential = mockCredential ?? null;

  return {
    getStatus(): Promise<DIMStatus> {
      if (credential === null) return Promise.resolve('unverified');
      if (credential.expiresAt !== undefined && credential.expiresAt < Date.now()) {
        return Promise.resolve('expired');
      }
      return Promise.resolve(credential.isValid ? 'verified' : 'unverified');
    },

    getCredential(): Promise<DIMCredentialInfo | null> {
      return Promise.resolve(credential);
    },

    async verify(): Promise<DIMCredentialInfo> {
      // Simulate verification delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Generate mock credential
      const hash = `dim-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      credential = {
        hash: createDIMCredential(hash),
        isValid: true,
        verifiedAt: Date.now(),
      };

      return credential;
    },

    sign(_data: Uint8Array): Promise<Uint8Array> {
      if (credential === null) {
        return Promise.reject(new Error('No credential available for signing'));
      }
      // Mock signature (in production, this would use actual cryptography)
      const mockSig = new Uint8Array(64);
      crypto.getRandomValues(mockSig);
      return Promise.resolve(mockSig);
    },

    verifySignature(
      _data: Uint8Array,
      _signature: Uint8Array,
      _credential: DIMCredential
    ): Promise<boolean> {
      // Mock verification always succeeds
      return Promise.resolve(true);
    },
  };
}

/**
 * Production DIM client using Polkadot API.
 */
async function createProductionDIMClient(): Promise<DIMClient> {
  // Create provider - Desktop needs WebSocket fallback due to routing bug
  // in createPapiProvider's host_jsonrpc_message channel
  let _provider: unknown;

  if (isDesktop()) {
    // Desktop: use direct WebSocket (createPapiProvider broken in Desktop)
    const { getWsProvider } = await import('@polkadot-api/ws-provider');
    _provider = getWsProvider(WS_RPC_ENDPOINT);
  } else {
    // Hosted (dot.li): use Host API provider
    const { createPapiProvider } = await import('@novasamatech/host-api-wrapper');
    _provider = createPapiProvider(PASEO_ASSET_HUB_GENESIS);
  }

  // Provider created but unused until DIM pallet integration is complete
  void _provider;

  // TODO: Implement actual DIM pallet interactions
  // For now, return a partial implementation that will be completed
  // when we have the full DIM pallet specification

  return {
    getStatus(): Promise<DIMStatus> {
      // TODO: Query DIM pallet for credential status
      return Promise.resolve('unverified');
    },

    getCredential(): Promise<DIMCredentialInfo | null> {
      // TODO: Query DIM pallet for credential
      return Promise.resolve(null);
    },

    verify(): Promise<DIMCredentialInfo> {
      // TODO: Initiate DIM verification flow
      return Promise.reject(new Error('DIM verification not yet implemented'));
    },

    sign(_data: Uint8Array): Promise<Uint8Array> {
      // TODO: Sign with DIM credential
      return Promise.reject(new Error('DIM signing not yet implemented'));
    },

    verifySignature(
      _data: Uint8Array,
      _signature: Uint8Array,
      _credential: DIMCredential
    ): Promise<boolean> {
      // TODO: Verify signature against DIM credential
      return Promise.resolve(false);
    },
  };
}

/**
 * Generate a deterministic pseudonym from a credential hash.
 * Used as a default pseudonym suggestion.
 */
export function generatePseudonym(credential: DIMCredential): string {
  // Use adjective + noun pattern
  const adjectives = [
    'Bright',
    'Swift',
    'Quiet',
    'Bold',
    'Keen',
    'Wise',
    'True',
    'Clear',
    'Deep',
    'Free',
  ];
  const nouns = [
    'Firefly',
    'Beacon',
    'Signal',
    'Light',
    'Spark',
    'Voice',
    'Witness',
    'Seeker',
    'Watcher',
    'Guide',
  ];

  // Deterministic selection based on credential
  const hash = credential.toString();
  const adjIndex = hash.charCodeAt(0) % adjectives.length;
  const nounIndex = hash.charCodeAt(1) % nouns.length;
  const suffix = hash.slice(-4).toUpperCase();

  return `${adjectives[adjIndex]}${nouns[nounIndex]}-${suffix}`;
}
