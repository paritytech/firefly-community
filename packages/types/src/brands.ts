/**
 * Branded types for domain identifiers.
 * These provide compile-time type safety for IDs that will map to on-chain storage keys.
 */

/** Unique identifier for a story chain */
export type ChainId = string & { readonly __brand: 'ChainId' };

/** Unique identifier for a corroboration */
export type CorroborationId = string & { readonly __brand: 'CorroborationId' };

/** Unique identifier for a campaign */
export type CampaignId = string & { readonly __brand: 'CampaignId' };

/** Unique identifier for a firefly (verified human) */
export type FireflyId = string & { readonly __brand: 'FireflyId' };

/** Unique identifier for a fact-checking collective */
export type CollectiveId = string & { readonly __brand: 'CollectiveId' };

/** Unique identifier for a verification request */
export type VerificationRequestId = string & { readonly __brand: 'VerificationRequestId' };

/** DIM credential hash — proves a verified human without revealing identity */
export type DIMCredential = string & { readonly __brand: 'DIMCredential' };

/** Content hash — references content stored on Bulletin Chain */
export type ContentHash = string & { readonly __brand: 'ContentHash' };

/** SS58-encoded Polkadot address */
export type PolkadotAddress = string & { readonly __brand: 'PolkadotAddress' };

/** Transaction hash for on-chain transactions */
export type TransactionHash = string & { readonly __brand: 'TransactionHash' };

/** Unique identifier for a campaign escrow */
export type EscrowId = string & { readonly __brand: 'EscrowId' };

/** Public key for a Coinage coin (single-use, never reused) */
export type CoinPublicKey = string & { readonly __brand: 'CoinPublicKey' };

/** H160 (Ethereum-style) address */
export type H160Address = string & { readonly __brand: 'H160Address' };

/** Unique identifier for a post */
export type PostId = string & { readonly __brand: 'PostId' };

/** Unique identifier for a claim (truth target extracted from a post) */
export type ClaimId = string & { readonly __brand: 'ClaimId' };

/** Unique identifier for a verdict (collective determination on a claim) */
export type VerdictId = string & { readonly __brand: 'VerdictId' };

/** Unique identifier for a news outlet */
export type OutletId = string & { readonly __brand: 'OutletId' };

/** Unique identifier for a community-funded campaign */
export type CommunityId = string & { readonly __brand: 'CommunityId' };

/** Unique identifier for an organization */
export type OrganizationId = string & { readonly __brand: 'OrganizationId' };

/** Unique identifier for an organization treasury */
export type TreasuryId = string & { readonly __brand: 'TreasuryId' };

/** Unique identifier for a crowdstacking pool */
export type PoolId = string & { readonly __brand: 'PoolId' };

/** Unique identifier for a withdrawal request */
export type WithdrawalRequestId = string & { readonly __brand: 'WithdrawalRequestId' };

/**
 * Type guard utilities for branded types.
 * These are used to create branded values from raw strings.
 */

export function createChainId(id: string): ChainId {
  return id as ChainId;
}

export function createCorroborationId(id: string): CorroborationId {
  return id as CorroborationId;
}

export function createCampaignId(id: string): CampaignId {
  return id as CampaignId;
}

export function createFireflyId(id: string): FireflyId {
  return id as FireflyId;
}

export function createCollectiveId(id: string): CollectiveId {
  return id as CollectiveId;
}

export function createVerificationRequestId(id: string): VerificationRequestId {
  return id as VerificationRequestId;
}

export function createDIMCredential(credential: string): DIMCredential {
  return credential as DIMCredential;
}

export function createContentHash(hash: string): ContentHash {
  return hash as ContentHash;
}

export function createPolkadotAddress(address: string): PolkadotAddress {
  return address as PolkadotAddress;
}

export function createH160Address(address: string): H160Address {
  return address as H160Address;
}

export function createTransactionHash(hash: string): TransactionHash {
  return hash as TransactionHash;
}

export function createEscrowId(id: string): EscrowId {
  return id as EscrowId;
}

export function createCoinPublicKey(key: string): CoinPublicKey {
  return key as CoinPublicKey;
}

export function createPostId(id: string): PostId {
  return id as PostId;
}

export function createClaimId(id: string): ClaimId {
  return id as ClaimId;
}

export function createVerdictId(id: string): VerdictId {
  return id as VerdictId;
}

export function createOutletId(id: string): OutletId {
  return id as OutletId;
}

export function createCommunityId(id: string): CommunityId {
  return id as CommunityId;
}

export function createOrganizationId(id: string): OrganizationId {
  return id as OrganizationId;
}

export function createTreasuryId(id: string): TreasuryId {
  return id as TreasuryId;
}

export function createPoolId(id: string): PoolId {
  return id as PoolId;
}

export function createWithdrawalRequestId(id: string): WithdrawalRequestId {
  return id as WithdrawalRequestId;
}
