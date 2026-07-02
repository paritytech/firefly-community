/**
 * Tests for the Explore page's pure filter/sort/derivation logic.
 */

import { describe, it, expect } from 'vitest';
import type { Post, ClaimPreview, ChainPreview, PostVerification } from '@cocuyo/types';
import { createPostId, createChainId, createClaimId, createDIMCredential } from '@cocuyo/types';
import {
  humanizeTopic,
  collectTopics,
  filterSortSignals,
  filterSortClaims,
  filterSortChains,
  SIGNAL_AWAIT_RANK,
  CLAIM_AWAIT_RANK,
} from './explore-filtering';

// ── fixtures ────────────────────────────────────────────────────────────────

function makeSignal(over: {
  id: string;
  text?: string;
  pseudonym?: string;
  locationName?: string;
  topics?: string[];
  witnessCount?: number;
  status?: PostVerification['status'];
  createdAt?: number;
}): Post {
  return {
    id: createPostId(over.id),
    author: {
      id: over.id,
      credentialHash: createDIMCredential(`dim-${over.id}`),
      pseudonym: over.pseudonym ?? 'Firefly',
      disclosureLevel: 'anonymous',
      reputation: 0,
    },
    content: { text: over.text ?? 'A signal' },
    context: {
      topics: over.topics ?? ['environmental'],
      ...(over.locationName !== undefined ? { locationName: over.locationName } : {}),
    },
    dimSignature: createDIMCredential(`dim-${over.id}`),
    status: 'published',
    chainLinks: [],
    corroborations: {
      witnessCount: over.witnessCount ?? 0,
      evidenceCount: 0,
      expertiseCount: 0,
      challengeCount: 0,
    },
    verification: { status: over.status ?? 'unverified' },
    createdAt: over.createdAt ?? 1000,
  };
}

function makeClaim(over: {
  id: string;
  statement?: string;
  topics?: string[];
  status?: ClaimPreview['status'];
  supportingCount?: number;
  createdAt?: number;
}): ClaimPreview {
  return {
    id: createClaimId(over.id),
    statement: over.statement ?? 'A claim',
    sourcePostId: createPostId(`src-${over.id}`),
    status: over.status ?? 'pending',
    topics: over.topics ?? ['environmental'],
    evidenceCount: 0,
    supportingCount: over.supportingCount ?? 0,
    contradictingCount: 0,
    createdAt: over.createdAt ?? 1000,
  };
}

function makeChain(over: {
  id: string;
  title?: string;
  topics?: string[];
  postCount?: number;
  updatedAt?: number;
}): ChainPreview {
  return {
    id: createChainId(over.id),
    title: over.title ?? 'A chain',
    topics: over.topics ?? ['environmental'],
    status: 'active',
    postCount: over.postCount ?? 0,
    corroborationCount: 0,
    updatedAt: over.updatedAt ?? 1000,
  };
}

const RECENT = { topic: 'all', query: '', sort: 'recent' } as const;

// ── humanizeTopic ─────────────────────────────────────────────────────────────

describe('humanizeTopic', () => {
  it('title-cases and de-slugs hyphen and underscore separators', () => {
    expect(humanizeTopic('water-quality')).toBe('Water quality');
    expect(humanizeTopic('public_health')).toBe('Public health');
  });
  it('handles single words and empty input', () => {
    expect(humanizeTopic('elections')).toBe('Elections');
    expect(humanizeTopic('')).toBe('');
  });
});

// ── collectTopics ─────────────────────────────────────────────────────────────

describe('collectTopics', () => {
  it('returns the de-duplicated, sorted union of topics across all content types', () => {
    const signals = [makeSignal({ id: 's1', topics: ['water-quality', 'environmental'] })];
    const claims = [makeClaim({ id: 'c1', topics: ['elections'] })];
    const chains = [makeChain({ id: 'h1', topics: ['environmental', 'labor'] })];
    expect(collectTopics(signals, claims, chains)).toEqual([
      'elections',
      'environmental',
      'labor',
      'water-quality',
    ]);
  });
  it('returns an empty array when there is no data', () => {
    expect(collectTopics([], [], [])).toEqual([]);
  });
});

// ── filterSortSignals ─────────────────────────────────────────────────────────

describe('filterSortSignals', () => {
  const signals = [
    makeSignal({
      id: 's1',
      topics: ['environmental'],
      createdAt: 100,
      witnessCount: 2,
      status: 'verified',
    }),
    makeSignal({
      id: 's2',
      topics: ['elections'],
      createdAt: 300,
      witnessCount: 9,
      status: 'pending',
    }),
    makeSignal({
      id: 's3',
      topics: ['environmental'],
      createdAt: 200,
      witnessCount: 5,
      status: 'in_review',
    }),
  ];

  it('filters by topic', () => {
    const result = filterSortSignals(signals, { ...RECENT, topic: 'elections' });
    expect(result.map((s) => s.id)).toEqual([createPostId('s2')]);
  });

  it('matches search across text, author, location, and topics (case-insensitive)', () => {
    const data = [
      makeSignal({ id: 'a', text: 'Orange foam on the Merrimack' }),
      makeSignal({ id: 'b', pseudonym: 'RiverWatch' }),
      makeSignal({ id: 'c', locationName: 'Manchester, NH' }),
      makeSignal({ id: 'd', topics: ['surveillance'] }),
    ];
    expect(filterSortSignals(data, { ...RECENT, query: 'MERRIMACK' }).map((s) => s.id)).toEqual([
      createPostId('a'),
    ]);
    expect(filterSortSignals(data, { ...RECENT, query: 'riverwatch' }).map((s) => s.id)).toEqual([
      createPostId('b'),
    ]);
    expect(filterSortSignals(data, { ...RECENT, query: 'manchester' }).map((s) => s.id)).toEqual([
      createPostId('c'),
    ]);
    expect(filterSortSignals(data, { ...RECENT, query: 'surveillance' }).map((s) => s.id)).toEqual([
      createPostId('d'),
    ]);
  });

  it('sorts by most recent (createdAt desc) by default', () => {
    expect(filterSortSignals(signals, RECENT).map((s) => s.createdAt)).toEqual([300, 200, 100]);
  });

  it('sorts by most corroborated (witnessCount desc)', () => {
    expect(
      filterSortSignals(signals, { ...RECENT, sort: 'corroborated' }).map(
        (s) => s.corroborations.witnessCount
      )
    ).toEqual([9, 5, 2]);
  });

  it('sorts by awaiting-verification rank, then most recent as tie-break', () => {
    const tie = [
      makeSignal({ id: 'old', status: 'in_review', createdAt: 100 }),
      makeSignal({ id: 'new', status: 'in_review', createdAt: 500 }),
      makeSignal({ id: 'verified', status: 'verified', createdAt: 900 }),
    ];
    const result = filterSortSignals(tie, { ...RECENT, sort: 'awaiting' });
    // both in_review lead (verified ranks last), newer in_review first
    expect(result.map((s) => s.id)).toEqual([
      createPostId('new'),
      createPostId('old'),
      createPostId('verified'),
    ]);
  });

  it('does not mutate the input array', () => {
    const input = [...signals];
    filterSortSignals(input, { ...RECENT, sort: 'corroborated' });
    expect(input.map((s) => s.id)).toEqual(signals.map((s) => s.id));
  });
});

// ── filterSortClaims ──────────────────────────────────────────────────────────

describe('filterSortClaims', () => {
  it('filters by topic and matches search on statement', () => {
    const claims = [
      makeClaim({ id: 'c1', statement: 'Water ran orange', topics: ['water-quality'] }),
      makeClaim({ id: 'c2', statement: 'Polls closed early', topics: ['elections'] }),
    ];
    expect(filterSortClaims(claims, { ...RECENT, topic: 'elections' }).map((c) => c.id)).toEqual([
      createClaimId('c2'),
    ]);
    expect(filterSortClaims(claims, { ...RECENT, query: 'orange' }).map((c) => c.id)).toEqual([
      createClaimId('c1'),
    ]);
  });

  it('sorts by most corroborated (supportingCount desc)', () => {
    const claims = [
      makeClaim({ id: 'low', supportingCount: 1 }),
      makeClaim({ id: 'high', supportingCount: 14 }),
    ];
    expect(filterSortClaims(claims, { ...RECENT, sort: 'corroborated' }).map((c) => c.id)).toEqual([
      createClaimId('high'),
      createClaimId('low'),
    ]);
  });

  it('ranks under_review before verified in awaiting sort', () => {
    const claims = [
      makeClaim({ id: 'verified', status: 'verified', createdAt: 900 }),
      makeClaim({ id: 'review', status: 'under_review', createdAt: 100 }),
    ];
    expect(filterSortClaims(claims, { ...RECENT, sort: 'awaiting' }).map((c) => c.id)).toEqual([
      createClaimId('review'),
      createClaimId('verified'),
    ]);
  });
});

// ── filterSortChains ──────────────────────────────────────────────────────────

describe('filterSortChains', () => {
  const chains = [
    makeChain({
      id: 'h1',
      title: 'Merrimack water',
      topics: ['water-quality'],
      postCount: 3,
      updatedAt: 100,
    }),
    makeChain({
      id: 'h2',
      title: 'Election watch',
      topics: ['elections'],
      postCount: 9,
      updatedAt: 300,
    }),
  ];

  it('filters by topic and matches search on title', () => {
    expect(filterSortChains(chains, { ...RECENT, query: 'merrimack' }).map((c) => c.id)).toEqual([
      createChainId('h1'),
    ]);
    expect(filterSortChains(chains, { ...RECENT, topic: 'elections' }).map((c) => c.id)).toEqual([
      createChainId('h2'),
    ]);
  });

  it('sorts by most recent (updatedAt desc) by default and for awaiting', () => {
    expect(filterSortChains(chains, RECENT).map((c) => c.updatedAt)).toEqual([300, 100]);
    expect(
      filterSortChains(chains, { ...RECENT, sort: 'awaiting' }).map((c) => c.updatedAt)
    ).toEqual([300, 100]);
  });

  it('sorts by most corroborated (postCount desc)', () => {
    expect(
      filterSortChains(chains, { ...RECENT, sort: 'corroborated' }).map((c) => c.postCount)
    ).toEqual([9, 3]);
  });
});

// ── rank tables ───────────────────────────────────────────────────────────────

describe('await-rank tables', () => {
  it('cover every verification/claim status (no status falls back to the unknown sentinel)', () => {
    const signalStatuses: PostVerification['status'][] = [
      'pending',
      'in_review',
      'verified',
      'disputed',
      'false',
      'synthetic',
      'unverified',
    ];
    signalStatuses.forEach((s) => expect(SIGNAL_AWAIT_RANK[s]).toBeTypeOf('number'));

    const claimStatuses: ClaimPreview['status'][] = [
      'pending',
      'under_review',
      'verified',
      'disputed',
      'false',
      'unverifiable',
    ];
    claimStatuses.forEach((s) => expect(CLAIM_AWAIT_RANK[s]).toBeTypeOf('number'));
  });
});
