/**
 * Post types — the fundamental unit of information in the Firefly Network.
 *
 * A post is what users create. It can be an observation, a piece of evidence,
 * a witness account, or a data point contributed by a verified human.
 *
 * This replaces the previous "Signal" type - the vocabulary has been unified
 * so users only see "Post" in the UI.
 */

import type { ChainId, CollectiveId, ContentHash, DIMCredential, PostId } from './brands';
import type { CorroborationSummary } from './corroboration';
import type { VerificationStatus } from './verification';
import type { FireflyAuthor } from './identity';

/** Maximum number of photos allowed per post */
export const MAX_POST_PHOTOS = 3;

/** Status of a post */
export type PostStatus =
  | 'published' // Live and visible
  | 'archived'; // Hidden but preserved

/** Geographic coordinate for location context */
export interface GeoCoordinate {
  readonly latitude: number;
  readonly longitude: number;
  /** Optional accuracy radius in meters */
  readonly accuracy?: number;
}

/** Time range for when an observed event occurred */
export interface TimeRange {
  /** Start of the observed timeframe (Unix timestamp) */
  readonly start: number;
  /** End of the observed timeframe (Unix timestamp) */
  readonly end?: number;
}

/** Media attachment reference */
export interface MediaAttachment {
  /** Content hash pointing to Bulletin Chain storage */
  readonly hash: ContentHash;
  /** MIME type of the attachment */
  readonly mimeType: string;
  /** Human-readable description for accessibility */
  readonly altText?: string;
  /** File size in bytes */
  readonly size: number;
}

/** The content of a post */
export interface PostContent {
  /** Optional title (displayed prominently if present) */
  readonly title?: string;
  /** The text content of the post */
  readonly text: string;
  /** Attached media (images, documents) */
  readonly media?: readonly MediaAttachment[];
  /** External reference links */
  readonly links?: readonly string[];
}

/** Contextual metadata for a post */
export interface PostContext {
  /** Topic tags categorizing this post */
  readonly topics: readonly string[];
  /** Optional geographic context */
  readonly location?: GeoCoordinate;
  /** Optional location name (human-readable, not for identification) */
  readonly locationName?: string;
  /** When the observed event occurred (not when the post was created) */
  readonly timeframe?: TimeRange;
}

/**
 * Verification info attached to a post.
 */
export interface PostVerification {
  /** Current verification status */
  readonly status: VerificationStatus;
  /** Collective that verified (if applicable) */
  readonly verifiedBy?: CollectiveId;
  /** CID of the verification verdict record */
  readonly verdictCid?: string;
  /** When verification was completed */
  readonly verifiedAt?: number;
}

/**
 * A post — the fundamental unit of information in the network.
 *
 * Every post:
 * - Is created by a verified human (via DIM)
 * - Can be linked to story chains
 * - Carries a corroboration summary
 * - Can be verified by collectives
 */
export interface Post {
  /** Unique identifier (deterministic hash of content + signature) */
  readonly id: PostId;
  /** CID on Bulletin Chain */
  readonly cid?: string;
  /** Author info (privacy-controlled) */
  readonly author: FireflyAuthor;
  /** The content of this post */
  readonly content: PostContent;
  /** Contextual metadata */
  readonly context: PostContext;
  /** DIM signature proving a verified human created this */
  readonly dimSignature: DIMCredential;
  /** Current status */
  readonly status: PostStatus;
  /** Story chains this post is linked to */
  readonly chainLinks: readonly ChainId[];
  /** Summary of corroborations received */
  readonly corroborations: CorroborationSummary;
  /** Verification status and info */
  readonly verification: PostVerification;
  /** When this post was illuminated (Unix timestamp) */
  readonly createdAt: number;
}

/**
 * A lightweight preview of a post for list views.
 */
export interface PostPreview {
  readonly id: PostId;
  readonly title?: string;
  readonly excerpt: string;
  readonly topics: readonly string[];
  readonly locationName?: string;
  readonly status: PostStatus;
  readonly corroborationCount: number;
  readonly challengeCount: number;
  readonly createdAt: number;
}

/**
 * Input type for creating a new post.
 * The id, dimSignature, corroborations, and createdAt are set by the system.
 */
export interface NewPost {
  readonly content: PostContent;
  readonly context: PostContext;
  /** Optional: link to existing chains */
  readonly chainLinks?: readonly ChainId[];
}
