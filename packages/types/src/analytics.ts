/**
 * Analytics types — metrics and insights for the Firefly Network.
 *
 * Provides funding metrics, impact metrics, and network health
 * for organizations, outlets, and the overall network.
 */

import type { CollectiveId, OrganizationId, OutletId } from './brands';
import type { PUSDAmount } from './currency';

// ============================================================================
// Time Period
// ============================================================================

/**
 * Time period for analytics queries.
 */
export interface AnalyticsPeriod {
  /** Start of period (Unix timestamp) */
  readonly from: number;
  /** End of period (Unix timestamp) */
  readonly to: number;
}

// ============================================================================
// Funding Metrics
// ============================================================================

/**
 * Breakdown of funding sources.
 */
export interface FundingBreakdown {
  /** Revenue from campaigns */
  readonly campaigns: PUSDAmount;
  /** Revenue from grants */
  readonly grants: PUSDAmount;
  /** Direct donations */
  readonly donations: PUSDAmount;
  /** Yield from staking or DeFi */
  readonly yield: PUSDAmount;
}

/**
 * Funding metrics for an organization.
 */
export interface FundingMetrics {
  /** Organization being measured */
  readonly organizationId: OrganizationId;
  /** Time period for these metrics */
  readonly period: AnalyticsPeriod;
  /** Total funds received during period */
  readonly totalReceived: PUSDAmount;
  /** Breakdown by funding source */
  readonly bySource: FundingBreakdown;
  /** Monthly burn rate (average expenses) */
  readonly burnRate: PUSDAmount;
  /** Estimated runway in months */
  readonly runway: number;
  /** Total disbursed during period */
  readonly totalDisbursed: PUSDAmount;
  /** Net change (received - disbursed) */
  readonly netChange: PUSDAmount;
}

// ============================================================================
// Impact Metrics
// ============================================================================

/**
 * Reach metrics — how content has spread.
 */
export interface ReachMetrics {
  /** Unique readers/viewers */
  readonly uniqueReaders: number;
  /** Total corroborations received */
  readonly corroborations: number;
  /** External shares (if trackable) */
  readonly shares: number;
  /** Impressions (page views) */
  readonly impressions: number;
}

/**
 * Topic distribution with counts.
 */
export interface TopicCount {
  /** Topic name */
  readonly topic: string;
  /** Number of posts/claims in this topic */
  readonly count: number;
  /** Percentage of total */
  readonly percentage: number;
}

/**
 * Verdict accuracy breakdown.
 */
export interface VerdictAccuracy {
  /** Total verdicts issued */
  readonly totalVerdicts: number;
  /** Verdicts that were upheld (not overturned) */
  readonly upheld: number;
  /** Verdicts that were overturned on appeal/review */
  readonly overturned: number;
  /** Accuracy percentage (upheld / total) */
  readonly accuracyRate: number;
}

/**
 * Impact metrics for an organization or outlet.
 */
export interface ImpactMetrics {
  /** Organization being measured */
  readonly organizationId: OrganizationId;
  /** Time period for these metrics */
  readonly period: AnalyticsPeriod;
  /** Number of posts published */
  readonly postsPublished: number;
  /** Number of claims verified */
  readonly claimsVerified: number;
  /** Verdict accuracy metrics */
  readonly verdictAccuracy: VerdictAccuracy;
  /** Reach metrics */
  readonly reach: ReachMetrics;
  /** Top topics by volume */
  readonly topTopics: readonly TopicCount[];
  /** Average time to verdict (in hours) */
  readonly averageVerdictTime: number;
  /** Number of active fact-checkers */
  readonly activeFactCheckers: number;
}

// ============================================================================
// Network Health Metrics
// ============================================================================

/**
 * Activity metrics for the network.
 */
export interface NetworkActivity {
  /** New posts this period */
  readonly newPosts: number;
  /** New claims this period */
  readonly newClaims: number;
  /** Corroborations this period */
  readonly corroborations: number;
  /** Verdicts issued this period */
  readonly verdicts: number;
}

/**
 * Network-wide health metrics.
 */
export interface NetworkHealthMetrics {
  /** When these metrics were computed (Unix timestamp) */
  readonly computedAt: number;
  /** Period for activity metrics */
  readonly period: AnalyticsPeriod;
  /** Total active fireflies (contributed in period) */
  readonly activeFireflies: number;
  /** Total active organizations */
  readonly activeOrganizations: number;
  /** Total active campaigns */
  readonly activeCampaigns: number;
  /** Total active collectives */
  readonly activeCollectives: number;
  /** Total funds in escrow across all campaigns */
  readonly totalFundsEscrowed: PUSDAmount;
  /** Activity metrics for the period */
  readonly activity: NetworkActivity;
  /** Average time from claim to verdict (in hours) */
  readonly averageVerdictTime: number;
  /** Network decentralization score (0-100) */
  readonly decentralizationScore: number;
}

// ============================================================================
// Leaderboard / Rankings
// ============================================================================

/**
 * Ranking category for leaderboards.
 */
export type RankingCategory =
  | 'verdicts' // Most verdicts issued
  | 'accuracy' // Highest verdict accuracy
  | 'reach' // Highest reach/impressions
  | 'funding' // Most funding received
  | 'contributors'; // Most active contributors

/**
 * A ranked outlet or organization.
 */
export interface OutletRanking {
  /** Rank position (1-indexed) */
  readonly rank: number;
  /** Organization ID */
  readonly organizationId: OrganizationId;
  /** Organization name */
  readonly name: string;
  /** Outlet ID (if this is an outlet) */
  readonly outletId?: OutletId;
  /** Collective ID (if this is a collective) */
  readonly collectiveId?: CollectiveId;
  /** The metric value for ranking */
  readonly value: number;
  /** Human-readable metric (e.g., "1,234 verdicts") */
  readonly formattedValue: string;
  /** Change from previous period (-1 = down, 0 = same, 1 = up) */
  readonly trend: -1 | 0 | 1;
  /** Positions changed from previous period */
  readonly positionChange: number;
}

/**
 * Leaderboard result.
 */
export interface LeaderboardResult {
  /** Ranking category */
  readonly category: RankingCategory;
  /** Time period */
  readonly period: AnalyticsPeriod;
  /** Ranked entries */
  readonly rankings: readonly OutletRanking[];
  /** Total entries in the full leaderboard */
  readonly totalEntries: number;
}

// ============================================================================
// Contributor Analytics
// ============================================================================

/**
 * Metrics for an individual contributor (firefly).
 */
export interface ContributorMetrics {
  /** Number of posts created */
  readonly postsCreated: number;
  /** Number of claims extracted */
  readonly claimsExtracted: number;
  /** Number of corroborations given */
  readonly corroborationsGiven: number;
  /** Number of verdicts participated in */
  readonly verdictsParticipated: number;
  /** Reputation earned in period */
  readonly reputationEarned: number;
  /** Funds earned in period */
  readonly fundsEarned: PUSDAmount;
}

// ============================================================================
// Comparison Analytics
// ============================================================================

/**
 * Period-over-period comparison.
 */
export interface PeriodComparison<T> {
  /** Current period metrics */
  readonly current: T;
  /** Previous period metrics */
  readonly previous: T;
  /** Percentage change */
  readonly percentageChange: number;
}
