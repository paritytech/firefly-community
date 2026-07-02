/**
 * Behavioural tests for AppStateProvider.
 *
 * Boundaries mocked: the signer context (wallet connection), Bulletin upload
 * (service-utils), and the claim-service persistence helpers. The provider's own
 * reducer-style logic runs for real: connection/outlet guards, evidence-URL
 * validation, corroboration type/quality derivation + summary updates, claim
 * extraction, campaign funding conversion + sponsor selection, verdict
 * status→claim-status mapping, fact-check gating, and story/chain wiring.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import type { ReactNode } from 'react';
import type {
  Post,
  Claim,
  Campaign,
  StoryChain,
  PostId,
  CampaignId,
  ChainId,
  Corroboration,
  Result,
} from '@cocuyo/types';

// --- Signer context (controllable connection) ----------------------------
interface SignerState {
  isConnected: boolean;
  selectedAccount: { address: string } | null;
}
const signerState: SignerState = { isConnected: false, selectedAccount: null };
vi.mock('@/lib/context/SignerContext', () => ({
  useSigner: (): SignerState => signerState,
}));

// --- Bulletin upload ------------------------------------------------------
const uploadToBulletin =
  vi.fn<(data: unknown) => Promise<{ ok: boolean } & Record<string, unknown>>>();
vi.mock('@/lib/services/service-utils', () => ({
  uploadToBulletin: (data: unknown) => uploadToBulletin(data),
}));

// --- Claim service persistence -------------------------------------------
const indexClaim = vi.fn<() => Promise<void>>();
const cacheClaim = vi.fn<() => void>();
const loadClaimIndex = vi.fn<() => Promise<{ all: string[]; byPost: Record<string, string[]> }>>();
const fetchClaims = vi.fn<() => Promise<unknown[]>>();
vi.mock('@/lib/services/claim-service', () => ({
  indexClaim: (): Promise<void> => indexClaim(),
  cacheClaim: (): void => cacheClaim(),
  loadClaimIndex: () => loadClaimIndex(),
  fetchClaims: () => fetchClaims(),
}));

import { AppStateProvider, useAppState } from './AppStateProvider';

type AppState = ReturnType<typeof useAppState>;

function wrapper({ children }: { children: ReactNode }): ReactNode {
  return <AppStateProvider>{children}</AppStateProvider>;
}

const WALLET = '0x00112233445566778899aabbccddeeff00112233';

function connect(): void {
  signerState.isConnected = true;
  signerState.selectedAccount = { address: WALLET };
}
function disconnect(): void {
  signerState.isConnected = false;
  signerState.selectedAccount = null;
}

let cidSeq = 0;
beforeEach(() => {
  vi.clearAllMocks();
  cidSeq = 0;
  disconnect();
  uploadToBulletin.mockImplementation(() =>
    Promise.resolve({ ok: true, value: { cid: `cid-${++cidSeq}` } })
  );
  indexClaim.mockResolvedValue(undefined);
  loadClaimIndex.mockResolvedValue({ all: [], byPost: {} });
  fetchClaims.mockResolvedValue([]);
});

/** Render the provider and return the hook result after the mount effect settles. */
async function renderApp(): Promise<{ result: { current: AppState } }> {
  const rendered = renderHook(() => useAppState(), { wrapper });
  await waitFor(() => expect(loadClaimIndex).toHaveBeenCalled());
  return rendered;
}

// --- Entity-creation helpers that fail loudly instead of returning null ---

// Capture an action result that is set inside an act() callback. The holder keeps
// the value's nullable type intact (TS does not narrow assignments made inside the
// callback), so unwrap's guard is a genuine union check rather than a dead branch.
function unwrap<T>(holder: { value: T | null }, what: string): T {
  if (holder.value === null) throw new Error(`${what} returned null`);
  return holder.value;
}

function mkPost(state: AppState, text = 'base post', topics: string[] = ['economy']): Post {
  const holder: { value: Post | null } = { value: null };
  act(() => {
    holder.value = state.createPost({ content: { text }, context: { topics }, chainLinks: [] });
  });
  return unwrap(holder, 'createPost');
}

async function mkClaim(state: AppState, postId: PostId, statement = 'a claim'): Promise<Claim> {
  const holder: { value: Claim | null } = { value: null };
  await act(async () => {
    holder.value = await state.extractClaim(postId, statement);
  });
  return unwrap(holder, 'extractClaim');
}

function mkCampaign(
  state: AppState,
  overrides: Partial<Parameters<AppState['createCampaign']>[0]> = {},
  targetPostId?: PostId
): Campaign {
  const holder: { value: Campaign | null } = { value: null };
  act(() => {
    holder.value = state.createCampaign(
      {
        title: 'C',
        description: 'd',
        topics: [],
        fundingAmount: 1,
        expiresInDays: 1,
        ...overrides,
      },
      targetPostId
    );
  });
  return unwrap(holder, 'createCampaign');
}

function mkStory(state: AppState, firstPostId: PostId, topics?: string[]): StoryChain {
  const holder: { value: StoryChain | null } = { value: null };
  act(() => {
    holder.value = state.createStory('T', 'D', firstPostId, topics);
  });
  return unwrap(holder, 'createStory');
}

describe('AppStateProvider currentUser', () => {
  it('reports a disconnected user with no credential when the wallet is not connected', async () => {
    const { result } = await renderApp();
    expect(result.current.currentUser.isConnected).toBe(false);
    expect(result.current.currentUser.credentialHash).toBeNull();
  });

  it('derives a credential and pseudonym once connected', async () => {
    connect();
    const { result } = await renderApp();
    expect(result.current.currentUser.isConnected).toBe(true);
    expect(result.current.currentUser.credentialHash).not.toBeNull();
    expect(result.current.currentUser.pseudonym).toBeTruthy();
  });
});

describe('AppStateProvider.createPost', () => {
  it('returns null and creates nothing when disconnected', async () => {
    const { result } = await renderApp();
    let created: Post | null = null;
    act(() => {
      created = result.current.createPost({
        content: { text: 'hi' },
        context: { topics: ['economy'] },
        chainLinks: [],
      });
    });
    expect(created).toBeNull();
  });

  it('creates a published post attributed to the connected user and exposes it via getters', async () => {
    connect();
    const { result } = await renderApp();

    const post = mkPost(result.current, 'observed something');
    expect(post.status).toBe('published');
    expect(post.author.credentialHash).toBe(result.current.currentUser.credentialHash);
    expect(result.current.getPost(post.id)?.content.text).toBe('observed something');
    expect(result.current.currentUser.createdPostIds).toContain(post.id);
  });
});

describe('AppStateProvider.submitCorroboration', () => {
  it('returns an error without uploading when disconnected', async () => {
    const { result } = await renderApp();
    let out: Result<Corroboration, string> | null = null;
    await act(async () => {
      out = await result.current.submitCorroboration('p' as PostId, 'corroborate');
    });
    // `out` is only assigned inside the act() closure, so TS narrows it to its null
    // initializer; read through a typed alias to assert on the resolved Result.
    const res = out as Result<Corroboration, string> | null;
    expect(res?.ok).toBe(false);
    expect(uploadToBulletin).not.toHaveBeenCalled();
  });

  it('rejects a source_link with an unsafe URL before uploading', async () => {
    connect();
    const { result } = await renderApp();
    const post = mkPost(result.current);
    uploadToBulletin.mockClear();

    let out: Result<Corroboration, string> | null = null;
    await act(async () => {
      out = await result.current.submitCorroboration(post.id, 'corroborate', {
        type: 'source_link',
        content: 'javascript:alert(1)',
      });
    });
    const res = out as Result<Corroboration, string> | null;
    expect(res?.ok).toBe(false);
    expect(uploadToBulletin).not.toHaveBeenCalled();
  });

  it('derives a "challenge" corroboration for a dispute and increments the challenge count', async () => {
    connect();
    const { result } = await renderApp();
    const post = mkPost(result.current);

    let out: Result<Corroboration, string> | null = null;
    await act(async () => {
      out = await result.current.submitCorroboration(post.id, 'dispute');
    });
    const res = out as Result<Corroboration, string> | null;
    expect(res?.ok).toBe(true);
    if (res?.ok === true) expect(res.value.type).toBe('challenge');
    expect(result.current.getPost(post.id)?.corroborations.challengeCount).toBe(1);
  });

  it('derives a "witness" corroboration for an observation and increments the witness count', async () => {
    connect();
    const { result } = await renderApp();
    const post = mkPost(result.current);

    let out: Result<Corroboration, string> | null = null;
    await act(async () => {
      out = await result.current.submitCorroboration(post.id, 'corroborate', {
        type: 'observation',
        content: 'I saw it',
      });
    });
    const res = out as Result<Corroboration, string> | null;
    expect(res?.ok).toBe(true);
    if (res?.ok === true) {
      expect(res.value.type).toBe('witness');
      expect(res.value.quality).toBe('observation');
    }
    expect(result.current.getPost(post.id)?.corroborations.witnessCount).toBe(1);
  });

  it('derives an "evidence" corroboration with documented quality when evidence is attached', async () => {
    connect();
    const { result } = await renderApp();
    const post = mkPost(result.current);

    let out: Result<Corroboration, string> | null = null;
    await act(async () => {
      out = await result.current.submitCorroboration(post.id, 'corroborate', {
        type: 'source_link',
        content: 'https://example.com/proof',
        description: 'a source',
      });
    });
    const res = out as Result<Corroboration, string> | null;
    expect(res?.ok).toBe(true);
    if (res?.ok === true) {
      expect(res.value.type).toBe('evidence');
      expect(res.value.quality).toBe('documented');
    }
    expect(result.current.getPost(post.id)?.corroborations.evidenceCount).toBe(1);
    expect(result.current.getPostCorroborations(post.id)).toHaveLength(1);
  });

  it('returns an error when the Bulletin upload fails and does not mutate the summary', async () => {
    connect();
    const { result } = await renderApp();
    const post = mkPost(result.current);
    const before = result.current.getPost(post.id)?.corroborations.evidenceCount ?? 0;
    uploadToBulletin.mockResolvedValueOnce({ ok: false, error: 'down' });

    let out: Result<Corroboration, string> | null = null;
    await act(async () => {
      out = await result.current.submitCorroboration(post.id, 'corroborate');
    });
    const res = out as Result<Corroboration, string> | null;
    expect(res?.ok).toBe(false);
    expect(result.current.getPost(post.id)?.corroborations.evidenceCount).toBe(before);
  });
});

describe('AppStateProvider.extractClaim', () => {
  it('returns null when disconnected', async () => {
    const { result } = await renderApp();
    let out: Claim | null = null;
    await act(async () => {
      out = await result.current.extractClaim('p' as PostId, 'a claim');
    });
    expect(out).toBeNull();
  });

  it('uploads, caches, indexes, and exposes the extracted claim under the post', async () => {
    connect();
    const { result } = await renderApp();
    const post = mkPost(result.current, 'src');

    let claim: Claim | null = null;
    await act(async () => {
      claim = await result.current.extractClaim(post.id, 'the sky is green', ['environment']);
    });
    const extracted = claim as unknown as Claim;
    expect(extracted.status).toBe('pending');
    expect(extracted.topics).toEqual(['environment']);

    expect(cacheClaim).toHaveBeenCalledTimes(1);
    expect(indexClaim).toHaveBeenCalledTimes(1);
    expect(result.current.getPostClaims(post.id).some((c) => c.id === extracted.id)).toBe(true);
  });

  it('returns null and skips caching when the upload fails', async () => {
    connect();
    const { result } = await renderApp();
    uploadToBulletin.mockResolvedValueOnce({ ok: false, error: 'down' });

    let out: Claim | null = null;
    await act(async () => {
      out = await result.current.extractClaim('p' as PostId, 'claim');
    });
    expect(out).toBeNull();
    expect(cacheClaim).not.toHaveBeenCalled();
    expect(indexClaim).not.toHaveBeenCalled();
  });
});

describe('AppStateProvider.createCampaign', () => {
  it('returns null when disconnected', async () => {
    const { result } = await renderApp();
    let out: Campaign | null = null;
    act(() => {
      out = result.current.createCampaign({
        title: 'C',
        description: 'd',
        topics: [],
        fundingAmount: 100,
        expiresInDays: 7,
      });
    });
    expect(out).toBeNull();
  });

  it('converts the dollar funding amount to 6-decimal units without float error', async () => {
    connect();
    const { result } = await renderApp();
    const campaign = mkCampaign(result.current, { fundingAmount: 1.5 });
    // 1.5 dollars → 1_500_000 units (6 decimals), via string parsing.
    expect(campaign.fundingAmount as unknown as bigint).toBe(1_500_000n);
  });

  it('uses a firefly sponsor by default and an outlet sponsor in outlet mode', async () => {
    connect();
    const { result } = await renderApp();

    expect(mkCampaign(result.current, { title: 'A' }).sponsor.type).toBe('firefly');

    act(() => result.current.toggleOutletMode());
    expect(mkCampaign(result.current, { title: 'B' }).sponsor.type).toBe('outlet');
  });

  it('threads a real on-chain funding tx hash into the campaign when provided', async () => {
    connect();
    const { result } = await renderApp();
    const campaign = mkCampaign(result.current, { fundingTxHash: '0xrealhash' });
    expect(campaign.fundingTxHash as unknown as string).toBe('0xrealhash');
  });

  it('wires a target post into the campaign↔post mappings', async () => {
    connect();
    const { result } = await renderApp();
    const post = mkPost(result.current);
    const campaign = mkCampaign(result.current, {}, post.id);
    expect(result.current.getPostCampaigns(post.id).some((c) => c.id === campaign.id)).toBe(true);
  });
});

describe('AppStateProvider.contributeToCampaign', () => {
  it('links an existing post to an existing campaign and is idempotent', async () => {
    connect();
    const { result } = await renderApp();
    const post = mkPost(result.current);
    const campaign = mkCampaign(result.current);

    let ok1 = false;
    act(() => {
      ok1 = result.current.contributeToCampaign(campaign.id, post.id);
    });
    expect(ok1).toBe(true);
    expect(result.current.getCampaign(campaign.id)?.contributingPostIds).toContain(post.id);

    // A second contribution of the same post does not duplicate it.
    act(() => {
      result.current.contributeToCampaign(campaign.id, post.id);
    });
    const occurrences = result.current
      .getCampaign(campaign.id)
      ?.contributingPostIds.filter((p) => p === post.id).length;
    expect(occurrences).toBe(1);
  });

  it('returns false for an unknown campaign or post', async () => {
    connect();
    const { result } = await renderApp();
    let out = true;
    act(() => {
      out = result.current.contributeToCampaign('no-campaign' as CampaignId, 'no-post' as PostId);
    });
    expect(out).toBe(false);
  });
});

describe('AppStateProvider.issueVerdict', () => {
  it('requires outlet mode (returns null for a plain connected user)', async () => {
    connect();
    const { result } = await renderApp();
    const seedClaim = result.current.getAllClaims()[0];
    expect(seedClaim).toBeDefined();
    if (!seedClaim) return;
    let out: ReturnType<AppState['issueVerdict']> = null;
    act(() => {
      out = result.current.issueVerdict(seedClaim.id, { status: 'confirmed', rationale: 'r' });
    });
    expect(out).toBeNull();
  });

  it('issues a verdict in outlet mode and maps the verdict status onto the claim status', async () => {
    connect();
    const { result } = await renderApp();
    act(() => result.current.toggleOutletMode());

    const seedClaim = result.current.getAllClaims()[0];
    expect(seedClaim).toBeDefined();
    if (!seedClaim) return;
    const claimId = seedClaim.id;

    let out: ReturnType<AppState['issueVerdict']> = null;
    act(() => {
      out = result.current.issueVerdict(claimId, { status: 'false', rationale: 'fabricated' });
    });
    expect(out).not.toBeNull();
    // 'false' verdict → 'false' claim status, with verdict reasoning attached.
    const updated = result.current.getClaim(claimId);
    expect(updated?.status).toBe('false');
    expect(updated?.verdict?.reasoning).toBe('fabricated');
  });
});

describe('AppStateProvider.submitClaimForFactCheck', () => {
  it('moves a pending claim to under_review but refuses non-pending claims', async () => {
    connect();
    const { result } = await renderApp();
    const post = mkPost(result.current);
    const claim = await mkClaim(result.current, post.id);

    let firstOk = false;
    act(() => {
      firstOk = result.current.submitClaimForFactCheck(claim.id);
    });
    expect(firstOk).toBe(true);
    expect(result.current.getClaim(claim.id)?.status).toBe('under_review');

    // A second submission is refused because the claim is no longer pending.
    let secondOk = true;
    act(() => {
      secondOk = result.current.submitClaimForFactCheck(claim.id);
    });
    expect(secondOk).toBe(false);
  });
});

describe('AppStateProvider story chains', () => {
  it('createStory links the first post and records the new story', async () => {
    connect();
    const { result } = await renderApp();
    const post = mkPost(result.current);
    const story = mkStory(result.current, post.id, ['economy']);

    expect(result.current.getPost(post.id)?.chainLinks).toContain(story.id);
    expect(result.current.currentUser.createdStoryIds).toContain(story.id);
  });

  it('addPostToStory appends a new post (bumping postCount) but refuses a duplicate', async () => {
    connect();
    const { result } = await renderApp();
    const first = mkPost(result.current, 'a');
    const second = mkPost(result.current, 'b');
    const story = mkStory(result.current, first.id);

    let added = false;
    act(() => {
      added = result.current.addPostToStory(story.id, second.id);
    });
    expect(added).toBe(true);
    expect(result.current.getStory(story.id)?.postIds).toContain(second.id);
    expect(result.current.getStory(story.id)?.stats.postCount).toBe(2);

    // Adding the same post again is refused.
    let addedAgain = true;
    act(() => {
      addedAgain = result.current.addPostToStory(story.id, second.id);
    });
    expect(addedAgain).toBe(false);
  });

  it('addPostToStory returns false for an unknown chain', async () => {
    connect();
    const { result } = await renderApp();
    const post = mkPost(result.current);
    let out = true;
    act(() => {
      out = result.current.addPostToStory('no-chain' as ChainId, post.id);
    });
    expect(out).toBe(false);
  });
});
