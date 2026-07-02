/**
 * Chain-backed implementation of the PostService.
 *
 * Stores and retrieves posts from the Bulletin Chain via the host storage APIs
 * (see lib/host/bulletin-storage).
 *
 * Uses the local IndexManager for post discovery by topic.
 * Content is stored on Bulletin Chain, indexes are stored locally.
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
} from '@cocuyo/types';
import { err, safeParsePost } from '@cocuyo/types';
import { getIndexManager } from '../chain/client';
import { fetchJsonFromHostStorage } from '../host/bulletin-storage';
import type { SignalIndexEntry } from '@cocuyo/bulletin';

/** Default topic used when no specific topic is requested */
const DEFAULT_TOPIC = 'general';

/**
 * Chain-backed post service.
 *
 * Provides real blockchain storage for posts via Bulletin Chain.
 * Query methods use the local IndexManager for discovery.
 */
export class ChainSignalService implements PostService {
  /**
   * Get a post by its CID.
   *
   * Fetches the post data from Bulletin Chain, validates, and parses it.
   * Returns null if the post doesn't exist or validation fails.
   */
  async getPost(id: PostId, _locale?: string): Promise<Post | null> {
    try {
      const data = await fetchJsonFromHostStorage<unknown>(id);
      return safeParsePost(data);
    } catch {
      return null;
    }
  }

  /**
   * Get all posts in a chain.
   *
   * NOTE: Chain-to-post relationships require a separate chain index.
   * Currently returns empty array - use seed data service for demos.
   */
  getChainPosts(_chainId: ChainId, _locale?: string): Promise<readonly Post[]> {
    // Chain-to-post index not yet implemented
    // Would need to index which posts link to which chains
    return Promise.resolve([]);
  }

  /**
   * Get recent posts by topic.
   *
   * Uses the IndexManager to find posts by topic, then fetches
   * the full post data from Bulletin Chain.
   */
  async getRecentPosts(params: {
    topic?: string;
    location?: string;
    status?: PostStatus;
    pagination: PaginationParams;
    locale?: string;
  }): Promise<PaginatedResult<PostPreview>> {
    const indexManager = getIndexManager();
    const topic = params.topic ?? DEFAULT_TOPIC;

    // Get index entries for this topic
    const entries = await indexManager.getSignalsByTopic(topic, {
      limit: params.pagination.offset + params.pagination.limit + 10, // Fetch extra for filtering
    });

    // Filter by location if specified
    let filtered = entries;
    const location = params.location;
    if (location !== undefined && location !== '') {
      const locationLower = location.toLowerCase();
      filtered = entries.filter((e) => e.location?.toLowerCase().includes(locationLower) === true);
    }

    // Apply pagination to entries
    const paginatedEntries = filtered.slice(
      params.pagination.offset,
      params.pagination.offset + params.pagination.limit
    );

    // Fetch posts and convert to previews
    const previews = await this.fetchPostPreviews(paginatedEntries);

    return {
      items: previews,
      total: filtered.length,
      hasMore: params.pagination.offset + params.pagination.limit < filtered.length,
    };
  }

  /**
   * Get recent posts with full data for display components.
   *
   * Uses the IndexManager to find posts by topic, then fetches
   * the full post data from Bulletin Chain.
   */
  async getRecentPostsForDisplay(params: {
    topic?: string;
    location?: string;
    status?: PostStatus;
    pagination: PaginationParams;
    locale?: string;
  }): Promise<PaginatedResult<Post>> {
    const indexManager = getIndexManager();
    const topic = params.topic ?? DEFAULT_TOPIC;

    // Get index entries for this topic
    const entries = await indexManager.getSignalsByTopic(topic, {
      limit: params.pagination.offset + params.pagination.limit + 10,
    });

    // Filter by location if specified
    let filtered = entries;
    const location = params.location;
    if (location !== undefined && location !== '') {
      const locationLower = location.toLowerCase();
      filtered = entries.filter((e) => e.location?.toLowerCase().includes(locationLower) === true);
    }

    // Apply pagination to entries
    const paginatedEntries = filtered.slice(
      params.pagination.offset,
      params.pagination.offset + params.pagination.limit
    );

    // Fetch full posts
    const posts = await this.fetchPosts(paginatedEntries);

    return {
      items: posts,
      total: filtered.length,
      hasMore: params.pagination.offset + params.pagination.limit < filtered.length,
    };
  }

  /**
   * Get all posts (for /posts page).
   *
   * Queries the default topic index. For comprehensive results,
   * posts should be indexed with the default topic.
   */
  async getAllPosts(params: {
    pagination: PaginationParams;
    locale?: string;
  }): Promise<PaginatedResult<PostPreview>> {
    return this.getRecentPosts({
      topic: DEFAULT_TOPIC,
      pagination: params.pagination,
      ...(params.locale !== undefined && { locale: params.locale }),
    });
  }

  /**
   * Illuminate a new post.
   *
   * GUARD: This method requires real DIM signing infrastructure.
   * Currently returns an error indicating signing is not yet implemented.
   * Use PostServiceImpl for demos.
   *
   * When signing is implemented, this will:
   * 1. Sign the post content with the user's DIM credential
   * 2. Compute the CID from the signed content
   * 3. Upload to Bulletin Chain
   * 4. Return the CID as PostId
   */
  illuminate(_post: NewPost): Promise<Result<PostId, string>> {
    // GUARD: Real signing infrastructure required
    //
    // To implement this properly, we need:
    // 1. DIM credential from the connected wallet
    // 2. Ring VRF proof generation for anonymous signing
    // 3. CID computation before upload (not after)
    //
    // For now, return a clear error directing to PostServiceImpl for demos.
    return Promise.resolve(
      err(
        'On-chain illumination requires DIM signing infrastructure. ' +
          'Use PostServiceImpl (NEXT_PUBLIC_USE_CHAIN=false) for demos.'
      )
    );
  }

  // --- Private Helpers ---

  /**
   * Fetch posts from index entries and convert to previews.
   */
  private async fetchPostPreviews(entries: readonly SignalIndexEntry[]): Promise<PostPreview[]> {
    const posts = await this.fetchPosts(entries);
    return posts.map((post) => ({
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
  }

  /**
   * Fetch full posts from index entries.
   * Filters out any posts that fail to fetch or validate.
   */
  private async fetchPosts(entries: readonly SignalIndexEntry[]): Promise<Post[]> {
    const results = await Promise.all(
      entries.map(async (entry) => {
        try {
          const data = await fetchJsonFromHostStorage<unknown>(entry.cid);
          return safeParsePost(data);
        } catch {
          return null;
        }
      })
    );
    return results.filter((post): post is Post => post !== null);
  }
}
