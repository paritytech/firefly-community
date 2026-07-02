/**
 * Route parameter guards for branded types.
 *
 * These functions perform basic guards (non-empty string checks) before
 * branding route parameters. They do NOT validate ID format - that
 * validation happens at the service layer which returns null for
 * non-existent entities.
 *
 * Purpose: Avoid unsafe type assertions (`as`) in route handlers by
 * providing a consistent guard pattern that rejects obviously invalid
 * inputs (empty strings, non-strings) before service calls.
 */

import {
  createChainId,
  createCampaignId,
  createPostId,
  createClaimId,
  type ChainId,
  type CampaignId,
  type PostId,
  type ClaimId,
} from '@cocuyo/types';

/**
 * Guard and brand a route parameter as ChainId.
 * Returns null for empty/non-string inputs. Service layer validates existence.
 */
export function validateChainId(id: unknown): ChainId | null {
  if (typeof id !== 'string' || id.length === 0) {
    return null;
  }
  return createChainId(id);
}

/**
 * Guard and brand a route parameter as CampaignId.
 * Returns null for empty/non-string inputs. Service layer validates existence.
 */
export function validateCampaignId(id: unknown): CampaignId | null {
  if (typeof id !== 'string' || id.length === 0) {
    return null;
  }
  return createCampaignId(id);
}

/**
 * Guard and brand a route parameter as PostId.
 * Returns null for empty/non-string inputs. Service layer validates existence.
 */
export function validatePostId(id: unknown): PostId | null {
  if (typeof id !== 'string' || id.length === 0) {
    return null;
  }
  return createPostId(id);
}

/**
 * Guard and brand a route parameter as ClaimId.
 * Returns null for empty/non-string inputs. Service layer validates existence.
 */
export function validateClaimId(id: unknown): ClaimId | null {
  if (typeof id !== 'string' || id.length === 0) {
    return null;
  }
  return createClaimId(id);
}

/**
 * Validate locale parameter.
 * Returns the locale if valid, or 'en' as default.
 */
export function validateLocale(locale: unknown): 'en' | 'es' {
  if (locale === 'en' || locale === 'es') {
    return locale;
  }
  return 'en';
}
