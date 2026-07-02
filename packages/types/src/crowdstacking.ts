/**
 * Crowdstacking types — share-based pooled capital for funding outlets.
 *
 * Crowdstacking allows contributors to pool capital together, receive shares
 * representing their stake, and collectively fund news outlets through
 * governance-controlled distributions.
 *
 * Key concepts:
 * - Contributors deposit pUSD and receive shares at current share price
 * - Share price appreciates as yield is received, depreciates on losses
 * - Withdrawals require a 30-day cooldown period for stability
 * - Contributor tiers are based on cumulative contribution amounts
 * - Governance weight for Alliance proposals is tier-based
 */

import type { PolkadotAddress, OutletId, TreasuryId } from './brands';
import type { PUSDAmount } from './currency';

// ============================================================================
// Branded Types (also exported from brands.ts)
// ============================================================================

/** Unique identifier for a crowdstacking pool */
export type PoolId = string & { readonly __brand: 'PoolId' };

/** Unique identifier for a withdrawal request */
export type WithdrawalRequestId = string & { readonly __brand: 'WithdrawalRequestId' };

// ============================================================================
// Contributor Tiers
// ============================================================================

/**
 * Contributor tier levels based on cumulative contribution amount.
 * Tiers determine governance weight and access to Alliance features.
 */
export type ContributorTier = 'none' | 'spark' | 'flame' | 'beacon' | 'lighthouse';

/**
 * Tier threshold configuration (amounts in cents for precision).
 * Each tier has a minimum and maximum contribution range.
 */
export const TIER_THRESHOLDS = {
  /** $0 - $4.99: No tier benefits */
  none: { min: 0, max: 4_99 },
  /** $5 - $49.99: Basic Alliance participation */
  spark: { min: 5_00, max: 49_99 },
  /** $50 - $499.99: Enhanced voting weight */
  flame: { min: 50_00, max: 499_99 },
  /** $500 - $4,999.99: Proposal creation rights */
  beacon: { min: 500_00, max: 4999_99 },
  /** $5,000+: Full Alliance leadership access */
  lighthouse: { min: 5000_00, max: Infinity },
} as const;

/**
 * Governance weight multipliers by tier.
 * Used for voting on Alliance proposals.
 */
export const TIER_GOVERNANCE_WEIGHTS = {
  none: 0,
  spark: 1,
  flame: 3,
  beacon: 10,
  lighthouse: 25,
} as const;

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * A contributor's position in the crowdstacking pool.
 */
export interface ContributorPosition {
  /** Pool this position belongs to */
  readonly poolId: PoolId;
  /** Contributor's wallet address */
  readonly contributor: PolkadotAddress;
  /** Number of shares owned */
  readonly shares: bigint;
  /** Cumulative amount contributed (for tier calculation) */
  readonly cumulativeContributed: PUSDAmount;
  /** Current tier based on cumulative contributions */
  readonly tier: ContributorTier;
  /** When the position was first created (Unix timestamp) */
  readonly createdAt: number;
  /** When the position was last updated (Unix timestamp) */
  readonly updatedAt: number;
}

/**
 * Status of a withdrawal request.
 */
export type WithdrawalRequestStatus = 'pending' | 'ready' | 'completed' | 'cancelled';

/**
 * A request to withdraw shares from the pool.
 * Withdrawals have a mandatory cooldown period before completion.
 */
export interface WithdrawalRequest {
  /** Unique request identifier */
  readonly id: WithdrawalRequestId;
  /** Pool this request is for */
  readonly poolId: PoolId;
  /** Requester's wallet address */
  readonly requester: PolkadotAddress;
  /** Number of shares to withdraw */
  readonly shares: bigint;
  /** Current status of the request */
  readonly status: WithdrawalRequestStatus;
  /** When the request was created (Unix timestamp) */
  readonly requestedAt: number;
  /** When the cooldown ends and withdrawal can complete (Unix timestamp) */
  readonly availableAt: number;
  /** When completed (Unix timestamp), if applicable */
  readonly completedAt?: number;
  /** Amount received on completion (may differ from expected due to price changes) */
  readonly amountReceived?: PUSDAmount;
}

/**
 * Current state of a crowdstacking pool.
 */
export interface PoolState {
  /** Pool identifier */
  readonly id: PoolId;
  /** Human-readable pool name */
  readonly name: string;
  /** Total shares outstanding */
  readonly totalShares: bigint;
  /** Total assets (pUSD) in the pool */
  readonly totalAssets: PUSDAmount;
  /** Current share price (scaled by SHARE_PRECISION) */
  readonly sharePrice: bigint;
  /** Number of unique contributors */
  readonly contributorCount: number;
  /** Whether the pool is accepting new contributions */
  readonly isOpen: boolean;
  /** Whether the pool is paused (no operations allowed) */
  readonly isPaused: boolean;
  /** Payment token address (pUSD contract) */
  readonly paymentToken: PolkadotAddress;
  /** OutletRegistry address for distributions */
  readonly outletRegistry: PolkadotAddress;
  /** When the pool was created (Unix timestamp) */
  readonly createdAt: number;
  /** When last updated (Unix timestamp) */
  readonly updatedAt: number;
}

/**
 * An outlet's allocation in the registry.
 * Allocations determine how pool distributions are split.
 */
export interface OutletAllocation {
  /** Outlet identifier */
  readonly outletId: OutletId;
  /** Outlet's treasury address for receiving funds */
  readonly treasury: TreasuryId;
  /** Human-readable outlet name */
  readonly name: string;
  /** Allocation weight (basis points, 10000 = 100%) */
  readonly weight: number;
  /** Whether the outlet is actively receiving distributions */
  readonly isActive: boolean;
  /** When added to the registry (Unix timestamp) */
  readonly addedAt: number;
  /** Cumulative amount distributed to this outlet */
  readonly totalDistributed: PUSDAmount;
}

/**
 * A distribution event from the pool to outlets.
 */
export interface DistributionEvent {
  /** Pool that distributed */
  readonly poolId: PoolId;
  /** Total amount distributed */
  readonly totalAmount: PUSDAmount;
  /** Amounts by outlet */
  readonly distributions: readonly {
    readonly outletId: OutletId;
    readonly amount: PUSDAmount;
    readonly treasury: TreasuryId;
  }[];
  /** Transaction hash on-chain */
  readonly txHash: string;
  /** When distributed (Unix timestamp) */
  readonly distributedAt: number;
}

// ============================================================================
// Pool Statistics
// ============================================================================

/**
 * Aggregate statistics for a pool.
 */
export interface PoolStats {
  /** Pool identifier */
  readonly poolId: PoolId;
  /** Total value locked (TVL) in pUSD */
  readonly tvl: PUSDAmount;
  /** Number of active contributors */
  readonly activeContributors: number;
  /** Contributors by tier */
  readonly contributorsByTier: Readonly<Record<ContributorTier, number>>;
  /** Number of funded outlets */
  readonly fundedOutlets: number;
  /** Total distributed all-time */
  readonly totalDistributed: PUSDAmount;
  /** 30-day distribution amount */
  readonly distributedLast30Days: PUSDAmount;
  /** Annualized yield (percentage, scaled by 100 for precision) */
  readonly annualizedYield: number;
  /** Snapshot timestamp */
  readonly snapshotAt: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Share price precision (18 decimals like ETH) */
export const SHARE_PRECISION = 10n ** 18n;

/** Initial share price (1:1 with pUSD, scaled) */
export const INITIAL_SHARE_PRICE = SHARE_PRECISION;

/** Withdrawal cooldown period in seconds (30 days) */
export const WITHDRAWAL_COOLDOWN_SECONDS = 30 * 24 * 60 * 60;

/** Minimum contribution amount ($5 pUSD = 5_000_000 units) */
export const MIN_CONTRIBUTION = 5_000_000n;

/** Basis points denominator (10000 = 100%) */
export const BASIS_POINTS = 10000;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the contributor tier for a given amount in cents.
 */
export function getTierForAmount(cents: number): ContributorTier {
  if (cents >= TIER_THRESHOLDS.lighthouse.min) return 'lighthouse';
  if (cents >= TIER_THRESHOLDS.beacon.min) return 'beacon';
  if (cents >= TIER_THRESHOLDS.flame.min) return 'flame';
  if (cents >= TIER_THRESHOLDS.spark.min) return 'spark';
  return 'none';
}

/**
 * Get the governance weight for a tier.
 */
export function getGovernanceWeight(tier: ContributorTier): number {
  return TIER_GOVERNANCE_WEIGHTS[tier];
}

/**
 * Get the next tier above the current tier.
 * @returns The next tier, or null if already at lighthouse (max tier)
 */
export function getNextTier(tier: ContributorTier): ContributorTier | null {
  switch (tier) {
    case 'none':
      return 'spark';
    case 'spark':
      return 'flame';
    case 'flame':
      return 'beacon';
    case 'beacon':
      return 'lighthouse';
    case 'lighthouse':
      return null;
  }
}

/**
 * Calculate the pUSD value of shares at a given share price.
 * @param shares Number of shares
 * @param sharePrice Current share price (scaled by SHARE_PRECISION)
 * @returns Value in pUSD units
 */
export function calculateShareValue(shares: bigint, sharePrice: bigint): bigint {
  return (shares * sharePrice) / SHARE_PRECISION;
}

/**
 * Calculate shares received for a contribution amount.
 * @param assets Amount of pUSD to contribute
 * @param sharePrice Current share price (scaled by SHARE_PRECISION)
 * @returns Number of shares to receive
 */
export function calculateSharesForContribution(assets: bigint, sharePrice: bigint): bigint {
  return (assets * SHARE_PRECISION) / sharePrice;
}

/**
 * Calculate new share price after yield is received.
 * @param totalAssets Current total assets before yield
 * @param totalShares Total shares outstanding
 * @param yieldAmount Yield received
 * @returns New share price
 */
export function calculateSharePriceAfterYield(
  totalAssets: bigint,
  totalShares: bigint,
  yieldAmount: bigint
): bigint {
  if (totalShares === 0n) return INITIAL_SHARE_PRICE;
  const newTotalAssets = totalAssets + yieldAmount;
  return (newTotalAssets * SHARE_PRECISION) / totalShares;
}

/**
 * Calculate new share price after a loss.
 * @param totalAssets Current total assets before loss
 * @param totalShares Total shares outstanding
 * @param lossAmount Loss amount
 * @returns New share price (will not go below 0)
 */
export function calculateSharePriceAfterLoss(
  totalAssets: bigint,
  totalShares: bigint,
  lossAmount: bigint
): bigint {
  if (totalShares === 0n) return INITIAL_SHARE_PRICE;
  const newTotalAssets = totalAssets > lossAmount ? totalAssets - lossAmount : 0n;
  return (newTotalAssets * SHARE_PRECISION) / totalShares;
}

/**
 * Check if an amount meets the minimum contribution requirement.
 */
export function meetsMinimumContribution(amount: bigint): boolean {
  return amount >= MIN_CONTRIBUTION;
}

/**
 * Calculate the time remaining on a withdrawal request cooldown.
 * @param request The withdrawal request
 * @param currentTime Current Unix timestamp in seconds
 * @returns Seconds remaining, or 0 if ready
 */
export function getWithdrawalCooldownRemaining(
  request: WithdrawalRequest,
  currentTime: number
): number {
  const remaining = request.availableAt - currentTime;
  return remaining > 0 ? remaining : 0;
}

/**
 * Check if a withdrawal request is ready to complete.
 */
export function isWithdrawalReady(request: WithdrawalRequest, currentTime: number): boolean {
  return request.status === 'pending' && currentTime >= request.availableAt;
}

/**
 * Validate that outlet weights sum to 100% (10000 basis points).
 */
export function validateOutletWeights(outlets: readonly OutletAllocation[]): boolean {
  const activeOutlets = outlets.filter((o) => o.isActive);
  if (activeOutlets.length === 0) return true; // Empty is valid
  const totalWeight = activeOutlets.reduce((sum, o) => sum + o.weight, 0);
  return totalWeight === BASIS_POINTS;
}

/**
 * Calculate distribution amounts for each outlet.
 * @param totalAmount Total amount to distribute
 * @param outlets Outlet allocations
 * @returns Map of outletId to distribution amount
 */
export function calculateDistributions(
  totalAmount: bigint,
  outlets: readonly OutletAllocation[]
): Map<OutletId, bigint> {
  const distributions = new Map<OutletId, bigint>();
  const activeOutlets = outlets.filter((o) => o.isActive);

  for (const outlet of activeOutlets) {
    const amount = (totalAmount * BigInt(outlet.weight)) / BigInt(BASIS_POINTS);
    distributions.set(outlet.outletId, amount);
  }

  return distributions;
}
