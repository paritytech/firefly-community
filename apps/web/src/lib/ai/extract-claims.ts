/**
 * Frontend helper for claim extraction.
 *
 * Bring-your-own AI: calls the integrator-configured extraction endpoint. Any
 * API key lives in that service (e.g. an edge worker), never in the browser.
 */

import type { ExtractedClaim, ExtractClaimsResponse, ExtractClaimsError } from './types';

// Claim extraction endpoint — no shared/credentialed default. In development we
// fall back to the same-origin proxy route to avoid CORS; the static export has
// no API routes, so production requires an explicit endpoint.
const CONFIGURED_CLAIM_EXTRACTOR_URL = process.env.NEXT_PUBLIC_CLAIM_EXTRACTOR_URL;
const DEV_PROXY_URL = process.env.NODE_ENV === 'production' ? undefined : '/api/extract-claims';
const CLAIM_EXTRACTOR_URL = CONFIGURED_CLAIM_EXTRACTOR_URL ?? DEV_PROXY_URL;

/**
 * Extract verifiable claims from text using AI.
 *
 * @param text - The text to extract claims from
 * @returns Array of extracted claims, or empty array if none found
 * @throws Error if the API call fails
 *
 * @example
 * ```ts
 * const claims = await extractClaims("Gas prices have tripled since 2020");
 * // [{ claim: "Gas prices have tripled since 2020", checkable: true, ... }]
 * ```
 */
async function extractClaims(text: string): Promise<ExtractedClaim[]> {
  if (!text || text.trim().length === 0) {
    return [];
  }

  if (CLAIM_EXTRACTOR_URL === undefined || CLAIM_EXTRACTOR_URL === '') {
    throw new Error(
      'Claim extraction is not configured. Set NEXT_PUBLIC_CLAIM_EXTRACTOR_URL to your own AI extraction endpoint.'
    );
  }

  // Handle both local API route (/api/extract-claims) and external worker (https://.../extract-claims)
  const url = CLAIM_EXTRACTOR_URL.startsWith('/api')
    ? CLAIM_EXTRACTOR_URL
    : `${CLAIM_EXTRACTOR_URL}/extract-claims`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: text.trim() }),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as Partial<ExtractClaimsError>;
    throw new Error(error.error ?? `Claim extraction failed: ${response.status}`);
  }

  const data: unknown = await response.json();

  // Validate response shape at runtime
  if (
    typeof data !== 'object' ||
    data === null ||
    !Array.isArray((data as { claims?: unknown }).claims)
  ) {
    throw new Error('Invalid claim extraction response');
  }

  return (data as ExtractClaimsResponse).claims;
}

/** Whether a claim-extraction endpoint is configured for this build. */
export function isClaimExtractionConfigured(): boolean {
  return CLAIM_EXTRACTOR_URL !== undefined && CLAIM_EXTRACTOR_URL !== '';
}

/** Result of extractBestClaim - distinguishes between no claims and errors */
export type ExtractBestClaimResult =
  | { ok: true; claim: string }
  | { ok: true; claim: null; reason: 'no_claims' }
  | { ok: false; reason: 'not_configured' }
  | { ok: false; reason: 'ai_error'; error: string };

/**
 * Extract claims and return the best single claim for quick extraction.
 *
 * Used by the "Extract Claim" button for one-click extraction.
 * Returns the first checkable claim, or the first claim if none are checkable.
 *
 * @param text - The text to extract claims from
 * @returns Result object with the claim or error reason
 */
export async function extractBestClaim(text: string): Promise<ExtractBestClaimResult> {
  // No endpoint configured: a distinct outcome from a runtime AI failure — retrying won't help.
  if (!isClaimExtractionConfigured()) {
    return { ok: false, reason: 'not_configured' };
  }
  try {
    const claims = await extractClaims(text);

    if (claims.length === 0) {
      return { ok: true, claim: null, reason: 'no_claims' };
    }

    // Prefer checkable claims
    const checkable = claims.find((c) => c.checkable);
    if (checkable) {
      return { ok: true, claim: checkable.claim };
    }

    // Fall back to first claim
    const firstClaim = claims[0]?.claim;
    if (firstClaim !== undefined && firstClaim !== '') {
      return { ok: true, claim: firstClaim };
    }

    return { ok: true, claim: null, reason: 'no_claims' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI extraction failed';
    return { ok: false, reason: 'ai_error', error: message };
  }
}
