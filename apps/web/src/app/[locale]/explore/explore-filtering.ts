/**
 * Pure filter/sort/derivation logic for the Explore page.
 *
 * Extracted from the view so it can be unit-tested without React, providers, or
 * i18n. The component (`ExploreExperience`) is a thin shell over these functions.
 */

import type { Post, ClaimPreview, ChainPreview } from '@cocuyo/types';

export type ExploreTab = 'signals' | 'claims' | 'chains';
export type ExploreSort = 'recent' | 'corroborated' | 'awaiting';

export interface ExploreQuery {
  /** Topic slug, or 'all' for no topic filter. */
  topic: string;
  /** Raw search text (may be empty / untrimmed). */
  query: string;
  /** Active sort order. */
  sort: ExploreSort;
}

/**
 * Sort rank for the "awaiting verification" order — lower sorts first.
 * Covers all 7 PostVerification statuses; verification-pending states lead.
 */
export const SIGNAL_AWAIT_RANK: Readonly<Record<string, number>> = {
  in_review: 0,
  pending: 1,
  unverified: 2,
  disputed: 3,
  verified: 4,
  false: 5,
  synthetic: 6,
};

/**
 * Sort rank for claims in "awaiting verification" order — lower sorts first.
 * Covers all 6 ClaimStatus values; verification-pending states lead.
 */
export const CLAIM_AWAIT_RANK: Readonly<Record<string, number>> = {
  under_review: 0,
  pending: 1,
  disputed: 2,
  verified: 3,
  unverifiable: 4,
  false: 5,
};

/** Rank lookup with a stable fallback for unknown statuses (sorted last). */
function rankOf(table: Readonly<Record<string, number>>, status: string): number {
  return table[status] ?? Number.MAX_SAFE_INTEGER;
}

/** Humanize a topic slug, e.g. "water-quality" -> "Water quality". */
export function humanizeTopic(slug: string): string {
  const s = slug.replace(/[-_]/g, ' ').trim();
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

function topicMatches(topics: readonly string[], topic: string): boolean {
  return topic === 'all' || topics.includes(topic);
}

function textMatches(haystack: string, needle: string): boolean {
  return needle === '' || haystack.toLowerCase().includes(needle);
}

function normalizedNeedle(query: string): string {
  return query.trim().toLowerCase();
}

/** Filter + sort signals for the active query. Pure; returns a new array. */
export function filterSortSignals(signals: readonly Post[], q: ExploreQuery): Post[] {
  const needle = normalizedNeedle(q.query);
  const filtered = signals.filter(
    (s) =>
      topicMatches(s.context.topics, q.topic) &&
      textMatches(
        `${s.content.text} ${s.author.pseudonym} ${s.context.locationName ?? ''} ${s.context.topics.join(' ')}`,
        needle
      )
  );
  return [...filtered].sort((a, b) => {
    if (q.sort === 'corroborated') {
      return b.corroborations.witnessCount - a.corroborations.witnessCount;
    }
    if (q.sort === 'awaiting') {
      const d =
        rankOf(SIGNAL_AWAIT_RANK, a.verification.status) -
        rankOf(SIGNAL_AWAIT_RANK, b.verification.status);
      return d !== 0 ? d : b.createdAt - a.createdAt;
    }
    return b.createdAt - a.createdAt;
  });
}

/** Filter + sort claims for the active query. Pure; returns a new array. */
export function filterSortClaims(claims: readonly ClaimPreview[], q: ExploreQuery): ClaimPreview[] {
  const needle = normalizedNeedle(q.query);
  const filtered = claims.filter(
    (c) =>
      topicMatches(c.topics, q.topic) && textMatches(`${c.statement} ${c.topics.join(' ')}`, needle)
  );
  return [...filtered].sort((a, b) => {
    if (q.sort === 'corroborated') return b.supportingCount - a.supportingCount;
    if (q.sort === 'awaiting') {
      const d = rankOf(CLAIM_AWAIT_RANK, a.status) - rankOf(CLAIM_AWAIT_RANK, b.status);
      return d !== 0 ? d : b.createdAt - a.createdAt;
    }
    return b.createdAt - a.createdAt;
  });
}

/**
 * Filter + sort chains. Chains have no verification-status axis, so "awaiting"
 * falls back to most-recent (the default), matching the design's intent.
 */
export function filterSortChains(chains: readonly ChainPreview[], q: ExploreQuery): ChainPreview[] {
  const needle = normalizedNeedle(q.query);
  const filtered = chains.filter(
    (ch) =>
      topicMatches(ch.topics, q.topic) && textMatches(`${ch.title} ${ch.topics.join(' ')}`, needle)
  );
  return [...filtered].sort((a, b) =>
    q.sort === 'corroborated' ? b.postCount - a.postCount : b.updatedAt - a.updatedAt
  );
}

/** Union of topic slugs present across all content types, sorted alphabetically. */
export function collectTopics(
  signals: readonly Post[],
  claims: readonly ClaimPreview[],
  chains: readonly ChainPreview[]
): string[] {
  const set = new Set<string>();
  signals.forEach((s) => s.context.topics.forEach((tp) => set.add(tp)));
  claims.forEach((c) => c.topics.forEach((tp) => set.add(tp)));
  chains.forEach((ch) => ch.topics.forEach((tp) => set.add(tp)));
  return [...set].sort();
}
