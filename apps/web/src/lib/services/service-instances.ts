/**
 * Chain-aware service instances.
 *
 * These instances are selected at module load based on the
 * NEXT_PUBLIC_USE_CHAIN environment variable:
 * - false (default): session-cached services with Bulletin fallback
 * - true: chain services with Bulletin Chain storage
 *
 * Services whose implementation does NOT vary by chain mode are exported
 * directly from their own module (e.g. `campaignService` from
 * `./campaign-service`); only the genuinely chain-selecting instances live
 * here.
 */

import type { ChainService, PostService } from '@cocuyo/types';
import { SignalServiceImpl } from './signal-service';
import { ChainServiceImpl } from './chain-service';
import { ChainSignalService } from './chain-signal-service';
import { OnChainChainService } from './chain-service.onchain';
import { personhoodService as mockPersonhoodService } from './personhood-service';
import { chainPersonhoodService } from './chain-personhood-service';

/**
 * Whether to use chain-backed services.
 * Set NEXT_PUBLIC_USE_CHAIN=true to enable blockchain storage.
 */
const USE_CHAIN_SERVICES = process.env.NEXT_PUBLIC_USE_CHAIN === 'true';

/**
 * Signal service instance (now uses Post types).
 *
 * Provides access to post data:
 * - getPost: Fetch a single post by ID
 * - getChainPosts: Get all posts in a story chain
 * - getRecentPosts: Paginated post listing
 * - illuminate: Create a new post
 *
 * Note: Named "signalService" for backwards compatibility.
 */
export const signalService: PostService = USE_CHAIN_SERVICES
  ? new ChainSignalService()
  : new SignalServiceImpl();

/**
 * Chain service instance.
 *
 * Provides access to story chain data:
 * - getChain: Fetch a single chain by ID
 * - getChains: Paginated chain listing with filters
 * - getFeaturedChains: Top chains by corroboration
 */
export const chainService: ChainService = USE_CHAIN_SERVICES
  ? new OnChainChainService()
  : new ChainServiceImpl();

/**
 * Post service instance.
 *
 * Alias to signalService for consistent naming.
 * Use this for new code; signalService is kept for backwards compatibility.
 */
export const postService: PostService = signalService;

/**
 * Personhood service instance.
 *
 * When USE_CHAIN_SERVICES=true:
 * - Queries the Individuality chain's PeopleLite pallet
 * - Returns 'lite' level if account is registered, 'none' otherwise
 * - Verification upgrade not available (handled on-chain)
 *
 * When USE_CHAIN_SERVICES=false (default):
 * - Uses mock implementation with 'lite' level for all credentials
 * - Supports verification flow and level setting for demos
 */
export const personhoodService = USE_CHAIN_SERVICES
  ? chainPersonhoodService
  : mockPersonhoodService;

/**
 * Check if the active personhood service is chain-backed.
 * Used by hooks to determine if verification/upgrade features are available.
 */
export function isChainPersonhoodService(): boolean {
  return USE_CHAIN_SERVICES;
}
