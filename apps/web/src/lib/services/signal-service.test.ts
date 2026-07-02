/**
 * Behavioural tests for SignalServiceImpl (the Post service).
 *
 * The external boundaries are mocked: Bulletin upload, the discovery index
 * manager, the wallet guard, and idempotency. The service's own logic runs for
 * real — the illuminate write flow (wallet guard, idempotency gating, CID-based
 * id assignment, non-fatal indexing) and the query/filter/pagination/preview
 * logic over the in-memory + seed posts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPostId, createChainId, createDIMCredential } from '@cocuyo/types';
import type { NewPost, Post, PostId } from '@cocuyo/types';

// --- Boundary mocks ------------------------------------------------------

const uploadToBulletin =
  vi.fn<(data: unknown) => Promise<{ ok: boolean } & Record<string, unknown>>>();
const requireConnectedWallet = vi.fn<() => Record<string, unknown>>();

vi.mock('./service-utils', async () => {
  const actual = await vi.importActual<typeof import('./service-utils')>('./service-utils');
  return {
    ...actual,
    uploadToBulletin: (data: unknown) => uploadToBulletin(data),
    fetchFromBulletin: vi.fn().mockResolvedValue(null),
    requireConnectedWallet: () => requireConnectedWallet(),
  };
});

const indexSignal = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/chain/client', () => ({
  getIndexManager: () => ({ indexSignal }),
}));

const tryStartOperation = vi.fn<() => { started: boolean; reason?: string }>();
const markOperationCompleted = vi.fn<() => void>();
const markOperationFailed = vi.fn<() => void>();
vi.mock('../utils/idempotency', () => ({
  generateIdempotencyKey: vi.fn(() => 'idem-key'),
  tryStartOperation: (): { started: boolean; reason?: string } => tryStartOperation(),
  markOperationCompleted: (): void => markOperationCompleted(),
  markOperationFailed: (): void => markOperationFailed(),
}));

import { SignalServiceImpl } from './signal-service';

const CRED = createDIMCredential('user-1');
const WALLET = '0x00112233445566778899aabbccddeeff00112233';

function newPost(overrides: Partial<NewPost> = {}): NewPost {
  return {
    content: { text: 'a new observation', ...overrides.content },
    context: { topics: ['economy'], ...overrides.context },
    chainLinks: overrides.chainLinks ?? [],
  } as NewPost;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireConnectedWallet.mockReturnValue({ ok: true, value: { wallet: WALLET, credential: CRED } });
  tryStartOperation.mockReturnValue({ started: true });
  uploadToBulletin.mockResolvedValue({ ok: true, value: { cid: 'cid-abc' } });
});

describe('SignalServiceImpl.illuminate', () => {
  it('returns the wallet-guard error and never uploads when no wallet is connected', async () => {
    requireConnectedWallet.mockReturnValue({
      ok: false,
      error: 'Wallet not connected. Please connect your wallet to illuminate.',
    });
    const service = new SignalServiceImpl();

    const result = await service.illuminate(newPost());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Wallet not connected');
    expect(uploadToBulletin).not.toHaveBeenCalled();
  });

  it('rejects an in-flight duplicate submission without uploading', async () => {
    tryStartOperation.mockReturnValue({ started: false, reason: 'in_flight' });
    const service = new SignalServiceImpl();

    const result = await service.illuminate(newPost());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('already being submitted');
    expect(uploadToBulletin).not.toHaveBeenCalled();
  });

  it('rejects a recently-completed duplicate with the modify-content guidance', async () => {
    tryStartOperation.mockReturnValue({ started: false, reason: 'recently_completed' });
    const service = new SignalServiceImpl();

    const result = await service.illuminate(newPost());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('recently submitted');
    expect(uploadToBulletin).not.toHaveBeenCalled();
  });

  it('marks the operation failed and returns the upload error when Bulletin upload fails', async () => {
    uploadToBulletin.mockResolvedValue({ ok: false, error: 'bulletin down' });
    const service = new SignalServiceImpl();

    const result = await service.illuminate(newPost());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('bulletin down');
    expect(markOperationFailed).toHaveBeenCalledTimes(1);
    expect(markOperationCompleted).not.toHaveBeenCalled();
  });

  it('uploads the assembled post, returns the CID-derived id, indexes it, and marks completed', async () => {
    const service = new SignalServiceImpl();

    const result = await service.illuminate(
      newPost({
        content: { title: 'T', text: 'body' },
        context: { topics: ['health'], locationName: 'Caracas' },
      })
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(createPostId('cid-abc'));

    // The uploaded payload carries the author credential and content, with a temp id.
    const uploaded = uploadToBulletin.mock.calls[0]?.[0] as Post;
    expect(uploaded.author.credentialHash).toBe(CRED);
    expect(uploaded.content.text).toBe('body');
    expect(uploaded.status).toBe('published');

    // Discovery indexing uses the returned CID and the post topics.
    expect(indexSignal).toHaveBeenCalledTimes(1);
    const indexed = indexSignal.mock.calls[0]?.[0] as {
      cid: string;
      topics: string[];
      location?: string;
    };
    expect(indexed.cid).toBe('cid-abc');
    expect(indexed.topics).toEqual(['health']);
    expect(indexed.location).toBe('Caracas');

    expect(markOperationCompleted).toHaveBeenCalledTimes(1);
  });

  it('still succeeds (indexing is non-fatal) when the index manager throws', async () => {
    indexSignal.mockRejectedValueOnce(new Error('index unavailable'));
    const service = new SignalServiceImpl();

    const result = await service.illuminate(newPost());

    expect(result.ok).toBe(true);
    expect(markOperationCompleted).toHaveBeenCalledTimes(1);
  });

  it('makes the freshly illuminated post retrievable by its new id and via the recent feed', async () => {
    const service = new SignalServiceImpl();
    const result = await service.illuminate(newPost({ content: { text: 'findable text body' } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const fetched = await service.getPost(result.value);
    expect(fetched?.content.text).toBe('findable text body');

    // It also appears (newest-first) at the head of the recent feed.
    const recent = await service.getRecentPosts({ pagination: { offset: 0, limit: 50 } });
    expect(recent.items.some((p) => p.id === result.value)).toBe(true);
  });
});

describe('SignalServiceImpl.getRecentPosts (filter + pagination + preview)', () => {
  it('builds previews with a 200-char excerpt and aggregated corroboration count', async () => {
    const service = new SignalServiceImpl();
    const longText = 'x'.repeat(500);
    await service.illuminate(
      newPost({ content: { text: longText }, context: { topics: ['economy'] } })
    );

    const recent = await service.getRecentPosts({ pagination: { offset: 0, limit: 50 } });
    const preview = recent.items.find((p) => p.excerpt.startsWith('xxx'));
    expect(preview).toBeDefined();
    expect(preview?.excerpt).toHaveLength(200);
    expect(typeof preview?.corroborationCount).toBe('number');
  });

  it('filters by topic case-insensitively', async () => {
    const service = new SignalServiceImpl();
    await service.illuminate(
      newPost({ content: { text: 'topic-filter-marker' }, context: { topics: ['Environment'] } })
    );

    const matched = await service.getRecentPosts({
      topic: 'environment',
      pagination: { offset: 0, limit: 50 },
    });
    expect(matched.items.some((p) => p.excerpt.includes('topic-filter-marker'))).toBe(true);

    const unmatched = await service.getRecentPosts({
      topic: 'no-such-topic-xyz',
      pagination: { offset: 0, limit: 50 },
    });
    expect(unmatched.items.some((p) => p.excerpt.includes('topic-filter-marker'))).toBe(false);
  });

  it('honours pagination offset/limit and reports hasMore', async () => {
    const service = new SignalServiceImpl();
    const firstPage = await service.getRecentPosts({ pagination: { offset: 0, limit: 1 } });
    expect(firstPage.items).toHaveLength(1);
    if (firstPage.total > 1) {
      expect(firstPage.hasMore).toBe(true);
    }
    expect(firstPage.total).toBeGreaterThanOrEqual(firstPage.items.length);
  });
});

describe('SignalServiceImpl.getChainPosts', () => {
  it('returns only posts linked to the requested chain', async () => {
    const service = new SignalServiceImpl();
    const chainId = createChainId('chain-xyz');
    await service.illuminate(
      newPost({ content: { text: 'chain-linked-post' }, chainLinks: [chainId] })
    );

    const inChain = await service.getChainPosts(chainId);
    expect(inChain.every((p) => p.chainLinks.includes(chainId))).toBe(true);
    expect(inChain.some((p) => p.content.text === 'chain-linked-post')).toBe(true);

    const otherChain = await service.getChainPosts(createChainId('chain-empty'));
    expect(otherChain.some((p) => p.content.text === 'chain-linked-post')).toBe(false);
  });
});

describe('SignalServiceImpl.getPost', () => {
  it('returns null for an unknown id (falls through to the mocked Bulletin fetch)', async () => {
    const service = new SignalServiceImpl();
    const result = await service.getPost('does-not-exist' as PostId);
    expect(result).toBeNull();
  });
});
