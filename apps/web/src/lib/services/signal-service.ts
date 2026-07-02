/**
 * Signal Service implementation with real Bulletin storage.
 *
 * Note: This service is named "Signal" for backwards compatibility.
 * In the new UX model, "Signal" has been renamed to "Post" in user-facing contexts.
 *
 * This service provides:
 * - Bulletin Chain storage for posts (writes)
 * - Session cache for immediate feedback
 * - Empty results for queries until indexing is implemented
 *
 * Posts are stored on Bulletin Chain and can be fetched by CID.
 */

import type {
  PostService,
  Post,
  PostId,
  PostPreview,
  PostStatus,
  ChainId,
  PaginationParams,
  PaginatedResult,
  Result,
  NewPost,
  ContentHash,
} from '@cocuyo/types';
import { ok, err, createPostId, emptyCorroborationSummary } from '@cocuyo/types';
import {
  setConnectedWallet as setWallet,
  requireConnectedWallet,
  generatePseudonym,
  paginate,
  filterByTopic,
  filterByString,
  uploadToBulletin,
  fetchFromBulletin,
} from './service-utils';
import { getSeedPostsForLocale } from '@/lib/seed-data';
import { getIndexManager } from '@/lib/chain/client';
import { createLogger } from '../logging';
import {
  generateIdempotencyKey,
  tryStartOperation,
  markOperationCompleted,
  markOperationFailed,
} from '../utils/idempotency';

const logger = createLogger('SignalService');

export type Locale = 'en' | 'es';

// Session cache for user-created posts (non-seed data only)
const userCreatedPosts: Post[] = [];

// Re-export for backwards compatibility
export { setWallet as setConnectedWallet };

/**
 * SignalServiceImpl - now works with Post types.
 * The name is kept for backwards compatibility.
 */
export class SignalServiceImpl implements PostService {
  async getPost(id: PostId, locale: Locale = 'en'): Promise<Post | null> {
    // Check user-created posts first
    const userPost = userCreatedPosts.find((p) => p.id === id);
    if (userPost) return userPost;

    // Check localized seed data
    const seedPost = getSeedPostsForLocale(locale).get(id);
    if (seedPost) return seedPost;

    // Try fetching from Bulletin Chain
    return fetchFromBulletin<Post>(id);
  }

  getChainPosts(chainId: ChainId, locale: Locale = 'en'): Promise<readonly Post[]> {
    const allPosts = [...userCreatedPosts, ...getSeedPostsForLocale(locale).values()];
    const chainPosts = allPosts.filter((p) => p.chainLinks.includes(chainId));
    return Promise.resolve(chainPosts);
  }

  getRecentPosts(params: {
    topic?: string;
    location?: string;
    status?: PostStatus;
    pagination: PaginationParams;
    locale?: Locale;
  }): Promise<PaginatedResult<PostPreview>> {
    const locale = params.locale ?? 'en';
    const allPosts = [...userCreatedPosts, ...getSeedPostsForLocale(locale).values()];
    let filtered = [...allPosts];

    // Filter by topic and location using shared utilities
    filtered = filterByTopic(filtered, (p) => [...p.context.topics], params.topic);
    filtered = filterByString(filtered, (p) => p.context.locationName, params.location);

    // Sort by creation time (newest first)
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    // Convert to previews
    const previews: PostPreview[] = filtered.map((post) => ({
      id: post.id,
      ...(post.content.title !== undefined && { title: post.content.title }),
      excerpt: post.content.text.slice(0, 200),
      topics: [...post.context.topics],
      ...(post.context.locationName !== undefined && { locationName: post.context.locationName }),
      status: post.status,
      corroborationCount: post.corroborations.witnessCount + post.corroborations.expertiseCount,
      challengeCount: post.corroborations.challengeCount,
      createdAt: post.createdAt,
    }));

    // Apply pagination using shared utility
    return Promise.resolve(paginate(previews, params.pagination));
  }

  getRecentPostsForDisplay(params: {
    topic?: string;
    location?: string;
    status?: PostStatus;
    pagination: PaginationParams;
    locale?: Locale;
  }): Promise<PaginatedResult<Post>> {
    const locale = params.locale ?? 'en';
    const allPosts = [...userCreatedPosts, ...getSeedPostsForLocale(locale).values()];
    let filtered = [...allPosts];

    // Filter by topic and location using shared utilities
    filtered = filterByTopic(filtered, (p) => [...p.context.topics], params.topic);
    filtered = filterByString(filtered, (p) => p.context.locationName, params.location);

    // Sort by creation time (newest first)
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    // Apply pagination using shared utility
    return Promise.resolve(paginate(filtered, params.pagination));
  }

  async illuminate(post: NewPost): Promise<Result<PostId, string>> {
    const walletCheck = requireConnectedWallet('your wallet to illuminate');
    if (!walletCheck.ok) {
      return err(walletCheck.error);
    }
    const { wallet: connectedAddress, credential: dimCredential } = walletCheck.value;

    // Generate idempotency key to prevent duplicate submissions
    const idempotencyKey = generateIdempotencyKey(dimCredential, {
      content: post.content,
      context: post.context,
      chainLinks: post.chainLinks,
    });

    // Atomically try to start the operation (prevents race conditions)
    const startResult = tryStartOperation(idempotencyKey);
    if (!startResult.started) {
      if (startResult.reason === 'in_flight') {
        return err('This post is already being submitted. Please wait.');
      }
      if (startResult.reason === 'recently_completed') {
        return err(
          'This exact post was recently submitted. Please modify your content to submit again.'
        );
      }
      // server_side - shouldn't happen in browser, but handle gracefully
    }

    const now = Date.now();

    // Build full post with author info
    const fullPost: Post = {
      id: '' as PostId, // Will be replaced with CID
      author: {
        id: connectedAddress,
        credentialHash: dimCredential,
        pseudonym: generatePseudonym(connectedAddress),
        disclosureLevel: 'anonymous',
      },
      content: {
        ...(post.content.title !== undefined && { title: post.content.title }),
        text: post.content.text,
        ...(post.content.links && { links: post.content.links }),
        ...(post.content.media && { media: post.content.media }),
      },
      context: {
        topics: [...post.context.topics],
        ...(post.context.locationName !== undefined && { locationName: post.context.locationName }),
        ...(post.context.location !== undefined && { location: post.context.location }),
        ...(post.context.timeframe !== undefined && { timeframe: post.context.timeframe }),
      },
      dimSignature: dimCredential,
      status: 'published',
      corroborations: emptyCorroborationSummary(),
      verification: {
        status: 'unverified',
      },
      chainLinks: post.chainLinks ?? [],
      createdAt: now,
    };

    // Upload to Bulletin Chain
    const uploadResult = await uploadToBulletin(fullPost);
    if (!uploadResult.ok) {
      markOperationFailed(idempotencyKey);
      return err(uploadResult.error);
    }

    // Update with CID
    const postWithId: Post = {
      ...fullPost,
      id: createPostId(uploadResult.value.cid),
    };

    // Index the post for discovery
    try {
      const indexManager = getIndexManager();
      const locationName = post.context.locationName;
      await indexManager.indexSignal({
        cid: uploadResult.value.cid as ContentHash,
        timestamp: now,
        author: dimCredential,
        topics: [...post.context.topics],
        ...(locationName !== undefined && { location: locationName }),
      });
    } catch (indexError) {
      // Indexing failure is non-fatal - post is still stored on chain
      // Log for debugging - discovery will still work for directly shared links
      logger.swallowed('Failed to index post for discovery', 'illuminate', indexError, {
        cid: uploadResult.value.cid,
      });
    }

    // Add to session cache
    userCreatedPosts.unshift(postWithId);

    // Mark operation as completed
    markOperationCompleted(idempotencyKey);

    return ok(postWithId.id);
  }

  getAllPosts(params: {
    pagination: PaginationParams;
    locale?: Locale;
  }): Promise<PaginatedResult<PostPreview>> {
    return this.getRecentPosts({
      pagination: params.pagination,
      ...(params.locale !== undefined && { locale: params.locale }),
    });
  }
}

// Export a singleton instance
export const signalService = new SignalServiceImpl();

// Legacy alias for backward compatibility
export { SignalServiceImpl as MockSignalService };
