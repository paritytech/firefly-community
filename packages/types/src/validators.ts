/**
 * Zod validators for runtime type validation.
 *
 * These validators ensure data fetched from external sources (Bulletin Chain)
 * conforms to expected types before being used in the application.
 */

import { z } from 'zod';
import {
  createChainId,
  createPostId,
  createDIMCredential,
  createContentHash,
  createCollectiveId,
} from './brands';
import type { StoryChain, Post, ChainPreview, PostPreview, DIMCredential } from './index';

// ============================================================
// Brand validators (transform strings to branded types)
// ============================================================

const ChainIdSchema = z.string().transform(createChainId);
const PostIdSchema = z.string().transform(createPostId);
const DIMCredentialSchema = z.string().transform(createDIMCredential);
const ContentHashSchema = z.string().transform(createContentHash);
const CollectiveIdSchema = z.string().transform(createCollectiveId);

// ============================================================
// Enum validators
// ============================================================

const ChainStatusSchema = z.enum(['emerging', 'active', 'established', 'contested']);

const PostStatusSchema = z.enum(['published', 'archived']);

const DisclosureLevelSchema = z.enum(['anonymous', 'partial', 'public']);

const VerificationStatusSchema = z.enum([
  'unverified',
  'pending',
  'in_review',
  'verified',
  'disputed',
  'false',
  'synthetic',
]);

// ============================================================
// Chain validators
// ============================================================

const ChainStatsSchema = z.object({
  postCount: z.number(),
  corroborationCount: z.number(),
  challengeCount: z.number(),
  contributorCount: z.number(),
});

export const StoryChainSchema = z.object({
  id: ChainIdSchema,
  title: z.string(),
  description: z.string(),
  topics: z.array(z.string()),
  location: z.string().optional(),
  status: ChainStatusSchema,
  postIds: z.array(PostIdSchema),
  stats: ChainStatsSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const ChainPreviewSchema = z.object({
  id: ChainIdSchema,
  title: z.string(),
  topics: z.array(z.string()),
  location: z.string().optional(),
  status: ChainStatusSchema,
  postCount: z.number(),
  corroborationCount: z.number(),
  updatedAt: z.number(),
});

// ============================================================
// Post validators
// ============================================================

const GeoCoordinateSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().optional(),
});

const TimeRangeSchema = z.object({
  start: z.number(),
  end: z.number().optional(),
});

const MediaAttachmentSchema = z.object({
  hash: ContentHashSchema,
  mimeType: z.string(),
  altText: z.string().optional(),
  size: z.number(),
});

const PostContentSchema = z.object({
  title: z.string().optional(),
  text: z.string(),
  media: z.array(MediaAttachmentSchema).optional(),
  links: z.array(z.string()).optional(),
});

const PostContextSchema = z.object({
  topics: z.array(z.string()),
  location: GeoCoordinateSchema.optional(),
  locationName: z.string().optional(),
  timeframe: TimeRangeSchema.optional(),
});

const CorroborationSummarySchema = z.object({
  witnessCount: z.number(),
  evidenceCount: z.number(),
  expertiseCount: z.number(),
  challengeCount: z.number(),
});

const PostVerificationSchema = z.object({
  status: VerificationStatusSchema,
  verifiedBy: CollectiveIdSchema.optional(),
  verdictCid: z.string().optional(),
  verifiedAt: z.number().optional(),
});

const FireflyAuthorSchema = z.object({
  id: z.string(),
  credentialHash: DIMCredentialSchema,
  pseudonym: z.string(),
  disclosureLevel: DisclosureLevelSchema,
  displayName: z.string().optional(),
  location: z.string().optional(),
  reputation: z.number().optional(),
});

export const PostSchema = z.object({
  id: PostIdSchema,
  cid: z.string().optional(),
  author: FireflyAuthorSchema,
  content: PostContentSchema,
  context: PostContextSchema,
  dimSignature: DIMCredentialSchema,
  status: PostStatusSchema,
  chainLinks: z.array(ChainIdSchema),
  corroborations: CorroborationSummarySchema,
  verification: PostVerificationSchema,
  createdAt: z.number(),
});

export const PostPreviewSchema = z.object({
  id: PostIdSchema,
  title: z.string().optional(),
  excerpt: z.string(),
  topics: z.array(z.string()),
  locationName: z.string().optional(),
  status: PostStatusSchema,
  corroborationCount: z.number(),
  challengeCount: z.number(),
  createdAt: z.number(),
});

// ============================================================
// Validation helpers
// ============================================================

// NOTE ON CASTS: The `as Type` casts below are safe because:
// 1. The zod schemas validate all required fields with correct types
// 2. The .transform() calls convert strings to branded types (ChainId, PostId, etc.)
// 3. The only difference is zod's optional() returns `T | undefined` while
//    TypeScript's optional properties with exactOptionalPropertyTypes require `?: T`
// 4. Tests in validators.test.ts verify schema output matches expected types

/**
 * Validate and parse data as a StoryChain.
 * Throws ZodError if validation fails.
 */
export function parseStoryChain(data: unknown): StoryChain {
  return StoryChainSchema.parse(data) as StoryChain;
}

/**
 * Safely validate data as a StoryChain.
 * Returns null if validation fails.
 */
export function safeParseStoryChain(data: unknown): StoryChain | null {
  const result = StoryChainSchema.safeParse(data);
  return result.success ? (result.data as StoryChain) : null;
}

/**
 * Validate and parse data as a Post.
 * Throws ZodError if validation fails.
 */
export function parsePost(data: unknown): Post {
  return PostSchema.parse(data) as Post;
}

/**
 * Safely validate data as a Post.
 * Returns null if validation fails.
 */
export function safeParsePost(data: unknown): Post | null {
  const result = PostSchema.safeParse(data);
  return result.success ? (result.data as Post) : null;
}

/**
 * Validate and parse data as a ChainPreview.
 * Throws ZodError if validation fails.
 */
export function parseChainPreview(data: unknown): ChainPreview {
  return ChainPreviewSchema.parse(data) as ChainPreview;
}

/**
 * Safely validate data as a ChainPreview.
 * Returns null if validation fails.
 */
export function safeParseChainPreview(data: unknown): ChainPreview | null {
  const result = ChainPreviewSchema.safeParse(data);
  return result.success ? (result.data as ChainPreview) : null;
}

/**
 * Validate and parse data as a PostPreview.
 * Throws ZodError if validation fails.
 */
export function parsePostPreview(data: unknown): PostPreview {
  return PostPreviewSchema.parse(data) as PostPreview;
}

/**
 * Safely validate data as a PostPreview.
 * Returns null if validation fails.
 */
export function safeParsePostPreview(data: unknown): PostPreview | null {
  const result = PostPreviewSchema.safeParse(data);
  return result.success ? (result.data as PostPreview) : null;
}

// ============================================================
// DIM Credential validators
// ============================================================

// ============================================================
// CoinPayment validators (RFC 0017)
// ============================================================

import {
  createCoinPaymentPurseId,
  createCoinPaymentBalance,
  createCoinPaymentReceivable,
} from './coin-payment';
import type { CoinPaymentPurseInfo, CoinPaymentCheque } from './coin-payment';

/** Validate and transform a purse ID */
export const CoinPaymentPurseIdSchema = z
  .number()
  .int()
  .min(0)
  .max(0xffffffff)
  .transform((n) => createCoinPaymentPurseId(n));

/** Validate and transform a balance in cents */
export const CoinPaymentBalanceSchema = z
  .number()
  .int()
  .min(0)
  .max(0xffffffff)
  .transform((n) => createCoinPaymentBalance(n));

/** Validate and transform a 32-byte receivable */
export const CoinPaymentReceivableSchema = z
  .instanceof(Uint8Array)
  .refine((arr) => arr.length === 32, { message: 'Receivable must be 32 bytes' })
  .transform((arr) => createCoinPaymentReceivable(arr));

/** Validate purse info */
export const CoinPaymentPurseInfoSchema = z.object({
  id: CoinPaymentPurseIdSchema,
  name: z.string().max(64),
  balance: CoinPaymentBalanceSchema,
});

/** Validate a cheque */
export const CoinPaymentChequeSchema = z.object({
  from: CoinPaymentPurseIdSchema,
  to: CoinPaymentReceivableSchema,
  amount: CoinPaymentBalanceSchema,
  encryptedData: z.instanceof(Uint8Array),
});

/** Validate a clearing reference */
export const CoinPaymentClearingReferenceSchema = z.object({
  txHash: z.string(),
  blockNumber: z.number().int().min(0),
  timestamp: z.number().int().min(0),
});

/** Validate CoinPayment errors */
export const CoinPaymentErrorSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('BalanceLow'),
    available: z.number().int().min(0),
    required: z.number().int().min(0),
  }),
  z.object({ type: z.literal('Denied'), reason: z.string() }),
  z.object({ type: z.literal('BadCoins') }),
  z.object({ type: z.literal('SnipedCoins') }),
  z.object({ type: z.literal('PurseNotFound'), purseId: z.number().int().min(0) }),
  z.object({ type: z.literal('ReceivableNotFound') }),
  z.object({ type: z.literal('UnsupportedChannel') }),
  z.object({ type: z.literal('UserAgentCapabilityUnavailable') }),
  z.object({ type: z.literal('Internal'), message: z.string() }),
]);

/**
 * Parse and validate purse info.
 * @throws ZodError if validation fails
 */
export function parseCoinPaymentPurseInfo(data: unknown): CoinPaymentPurseInfo {
  return CoinPaymentPurseInfoSchema.parse(data) as CoinPaymentPurseInfo;
}

/**
 * Safely parse purse info.
 * @returns Parsed purse info or null if invalid
 */
export function safeParseCoinPaymentPurseInfo(data: unknown): CoinPaymentPurseInfo | null {
  const result = CoinPaymentPurseInfoSchema.safeParse(data);
  return result.success ? (result.data as CoinPaymentPurseInfo) : null;
}

/**
 * Parse and validate a cheque.
 * @throws ZodError if validation fails
 */
export function parseCoinPaymentCheque(data: unknown): CoinPaymentCheque {
  return CoinPaymentChequeSchema.parse(data) as CoinPaymentCheque;
}

/**
 * Safely parse a cheque.
 * @returns Parsed cheque or null if invalid
 */
export function safeParseCoinPaymentCheque(data: unknown): CoinPaymentCheque | null {
  const result = CoinPaymentChequeSchema.safeParse(data);
  return result.success ? (result.data as CoinPaymentCheque) : null;
}

// ============================================================
// DIM Credential validators
// ============================================================

/**
 * Validate a string as a DIM credential.
 *
 * DIM credentials must:
 * - Be a non-empty string
 * - Start with 'dim-' prefix (for seed data) or be a valid hash
 * - Not contain path traversal characters
 *
 * Returns the branded DIMCredential if valid, null otherwise.
 */
export function validateDIMCredential(id: unknown): DIMCredential | null {
  // Must be a string
  if (typeof id !== 'string') {
    return null;
  }

  // Must not be empty
  if (id.length === 0) {
    return null;
  }

  // Security: prevent path traversal
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    return null;
  }

  // Security: prevent excessively long inputs
  if (id.length > 256) {
    return null;
  }

  // Must match expected format:
  // - dim-* prefix (seed data)
  // - or alphanumeric/hex hash (real credentials)
  const validPattern = /^(dim-[a-zA-Z0-9-]+|[a-fA-F0-9]{32,64})$/;
  if (!validPattern.test(id)) {
    return null;
  }

  return createDIMCredential(id);
}
