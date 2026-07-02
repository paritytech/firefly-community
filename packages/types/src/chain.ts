/**
 * Story Chain types — emergent structures formed when posts connect.
 *
 * A story chain is not "created" by anyone. It crystallizes as fireflies
 * link their posts to related observations. The chain represents
 * collective understanding built through distributed corroboration.
 */

import type { ChainId, PostId } from './brands';

/** Status of a story chain */
export type ChainStatus =
  | 'emerging' // Few posts, still forming
  | 'active' // Actively receiving posts and corroborations
  | 'established' // Well-corroborated, stable
  | 'contested'; // Significant challenges, under dispute

/** Summary statistics for a chain */
export interface ChainStats {
  /** Total number of posts in this chain */
  readonly postCount: number;
  /** Total corroborations across all posts */
  readonly corroborationCount: number;
  /** Total challenges across all posts */
  readonly challengeCount: number;
  /** Number of unique fireflies who contributed */
  readonly contributorCount: number;
}

/**
 * A story chain — an emergent structure of connected posts.
 *
 * Chains form organically when posts reference each other or share topics.
 * They represent the collective understanding of an event, situation, or question.
 */
export interface StoryChain {
  /** Unique identifier for this chain */
  readonly id: ChainId;
  /** Human-readable title (derived from topics or first post) */
  readonly title: string;
  /** Brief description of what this chain is about */
  readonly description: string;
  /** Primary topics covered by this chain */
  readonly topics: readonly string[];
  /** Optional geographic focus */
  readonly location?: string;
  /** Current status of the chain */
  readonly status: ChainStatus;
  /** IDs of posts in this chain, ordered by creation time */
  readonly postIds: readonly PostId[];
  /** Summary statistics */
  readonly stats: ChainStats;
  /** When this chain first emerged (Unix timestamp) */
  readonly createdAt: number;
  /** When this chain was last updated (Unix timestamp) */
  readonly updatedAt: number;
}

/**
 * A lightweight preview of a chain for list views.
 */
export interface ChainPreview {
  readonly id: ChainId;
  readonly title: string;
  readonly topics: readonly string[];
  readonly location?: string;
  readonly status: ChainStatus;
  readonly postCount: number;
  readonly corroborationCount: number;
  readonly updatedAt: number;
}
