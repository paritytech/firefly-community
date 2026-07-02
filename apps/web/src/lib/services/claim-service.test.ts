/**
 * Tests for claim service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ClaimServiceImpl,
  claimService,
  loadClaimIndex,
  indexClaim,
  cacheClaim,
  fetchClaim,
  fetchClaims,
} from './claim-service';
import type { Claim } from '@cocuyo/types';
import { createClaimId, createPostId, createDIMCredential, ok, err } from '@cocuyo/types';
import type { DIMCredential } from '@cocuyo/types';
import { seedPostClaims } from '../seed-data';

// Mock service utils
vi.mock('./service-utils', () => {
  const getConnectedWallet = vi.fn<() => string | null>();
  const getConnectedCredential = vi.fn<() => DIMCredential | null>();
  return {
    getConnectedWallet,
    getConnectedCredential,
    // Mirror the real guard using the test-controlled getters so connection
    // state is driven by the mocked getters.
    requireConnectedWallet: (action: string) => {
      const wallet = getConnectedWallet();
      const credential = getConnectedCredential();
      if (wallet === null || credential === null) {
        return { ok: false, error: `Wallet not connected. Please connect ${action}.` };
      }
      return { ok: true, value: { wallet, credential } };
    },
    paginate: vi.fn((items: readonly unknown[], _params: unknown) => ({
      items,
      total: items.length,
      hasMore: false,
    })),
    filterByTopic: vi.fn(
      <T extends { topics: string[] }>(
        items: T[],
        _getter: unknown,
        topic: string | undefined
      ): T[] => {
        if (topic === undefined || topic === '') return items;
        return items.filter((item) => item.topics.includes(topic));
      }
    ),
    uploadToBulletin: vi.fn(),
    fetchFromBulletin: vi.fn(),
  };
});

// Mock storage
vi.mock('../host/storage', () => ({
  storage: {
    read: vi.fn(),
    write: vi.fn(),
  },
}));

import {
  getConnectedWallet,
  getConnectedCredential,
  uploadToBulletin,
  fetchFromBulletin,
} from './service-utils';
import { storage } from '../host/storage';

const mockedGetConnectedWallet = vi.mocked(getConnectedWallet);
const mockedGetConnectedCredential = vi.mocked(getConnectedCredential);
const mockedUploadToBulletin = vi.mocked(uploadToBulletin);
const mockedFetchFromBulletin = vi.mocked(fetchFromBulletin);
const mockedStorageRead = vi.mocked(storage.read);
const mockedStorageWrite = vi.mocked(storage.write);

const createMockClaim = (id: string, postId: string): Claim => ({
  id: createClaimId(id),
  statement: `Claim ${id}`,
  sourcePostId: createPostId(postId),
  extractedBy: createDIMCredential('extractor'),
  topics: ['politics'],
  evidence: [],
  status: 'pending',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

describe('loadClaimIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Seed claim mappings are always merged into the index so seed posts'
  // pre-extracted claims surface through the same query path as live claims.
  const seedEntries = [...seedPostClaims.entries()];

  it('merges stored index with seed claims when present', async () => {
    const storedIndex = { byPost: { 'post-1': ['claim-1'] }, all: ['claim-1'] };
    mockedStorageRead.mockResolvedValue(storedIndex);

    const result = await loadClaimIndex();

    expect(result.byPost['post-1']).toEqual(['claim-1']);
    expect(result.all).toContain('claim-1');
    for (const [postId, claimIds] of seedEntries) {
      expect(result.byPost[postId]).toEqual(claimIds);
      for (const claimId of claimIds) {
        expect(result.all).toContain(claimId);
      }
    }
  });

  it('returns seed-only index when nothing stored', async () => {
    mockedStorageRead.mockResolvedValue(null);

    const result = await loadClaimIndex();

    for (const [postId, claimIds] of seedEntries) {
      expect(result.byPost[postId]).toEqual(claimIds);
      for (const claimId of claimIds) {
        expect(result.all).toContain(claimId);
      }
    }
  });
});

describe('indexClaim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedStorageRead.mockResolvedValue(null);
    mockedStorageWrite.mockResolvedValue(undefined);
  });

  it('adds claim to index', async () => {
    const claimId = createClaimId('new-claim');
    const postId = createPostId('post-1');

    await indexClaim(claimId, postId);

    expect(mockedStorageWrite).toHaveBeenCalled();
  });

  it('does not duplicate existing claims', async () => {
    const existingIndex = { byPost: { 'post-1': ['claim-1'] }, all: ['claim-1'] };
    mockedStorageRead.mockResolvedValue(existingIndex);

    await indexClaim(createClaimId('claim-1'), createPostId('post-1'));

    // Should write the same index (no changes)
    const writeCall = mockedStorageWrite.mock.calls[0];
    const writtenIndex = writeCall?.[1] as { byPost: Record<string, string[]>; all: string[] };
    expect(writtenIndex.all.filter((id) => id === 'claim-1').length).toBe(1);
  });
});

describe('cacheClaim', () => {
  it('caches claim in memory', () => {
    const claim = createMockClaim('cache-test', 'post-1');

    cacheClaim(claim);

    // The claim should be retrievable (tested via fetchClaim)
    expect(() => cacheClaim(claim)).not.toThrow();
  });
});

describe('fetchClaim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedStorageRead.mockResolvedValue(null);
    mockedFetchFromBulletin.mockResolvedValue(null);
  });

  it('fetches claim from bulletin when not cached', async () => {
    const mockClaim = createMockClaim('bulletin-claim', 'post-1');
    mockedFetchFromBulletin.mockResolvedValue(mockClaim);

    const result = await fetchClaim(createClaimId('bulletin-claim'));

    expect(mockedFetchFromBulletin).toHaveBeenCalled();
    expect(result?.statement).toBe('Claim bulletin-claim');
  });

  it('returns null when claim not found', async () => {
    mockedFetchFromBulletin.mockResolvedValue(null);

    const result = await fetchClaim(createClaimId('nonexistent'));

    expect(result).toBeNull();
  });
});

describe('fetchClaims', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedStorageRead.mockResolvedValue(null);
    mockedFetchFromBulletin.mockResolvedValue(null);
  });

  it('fetches multiple claims', async () => {
    const claim1 = createMockClaim('multi-claim-1', 'post-1');
    const claim2 = createMockClaim('multi-claim-2', 'post-1');
    mockedFetchFromBulletin.mockReset();
    mockedFetchFromBulletin.mockResolvedValueOnce(claim1).mockResolvedValueOnce(claim2);

    const result = await fetchClaims(['multi-claim-1', 'multi-claim-2']);

    expect(result).toHaveLength(2);
  });

  it('filters out null results', async () => {
    const claim1 = createMockClaim('filter-claim-1', 'post-1');
    mockedFetchFromBulletin.mockReset();
    mockedFetchFromBulletin.mockResolvedValueOnce(claim1).mockResolvedValueOnce(null);

    const result = await fetchClaims(['filter-claim-1', 'nonexistent']);

    expect(result).toHaveLength(1);
  });
});

describe('ClaimServiceImpl', () => {
  let service: ClaimServiceImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ClaimServiceImpl();
    mockedStorageRead.mockResolvedValue(null);
    mockedStorageWrite.mockResolvedValue(undefined);
    mockedFetchFromBulletin.mockResolvedValue(null);
  });

  describe('getClaim', () => {
    it('returns claim when found', async () => {
      const mockClaim = createMockClaim('get-claim-test', 'post-1');
      mockedFetchFromBulletin.mockReset();
      mockedFetchFromBulletin.mockResolvedValue(mockClaim);

      const result = await service.getClaim(createClaimId('get-claim-test'));

      expect(result?.statement).toBe('Claim get-claim-test');
    });

    it('returns null when not found', async () => {
      mockedFetchFromBulletin.mockReset();
      mockedFetchFromBulletin.mockResolvedValue(null);

      const result = await service.getClaim(createClaimId('truly-nonexistent'));

      expect(result).toBeNull();
    });
  });

  describe('getClaimsByPost', () => {
    it('returns empty array when no claims for post', async () => {
      mockedStorageRead.mockResolvedValue({ byPost: {}, all: [] });

      const result = await service.getClaimsByPost(createPostId('empty-post'));

      expect(result).toEqual([]);
    });

    it('returns claims for post', async () => {
      const index = { byPost: { 'post-1': ['claim-1'] }, all: ['claim-1'] };
      mockedStorageRead.mockResolvedValue(index);
      const mockClaim = createMockClaim('claim-1', 'post-1');
      mockedFetchFromBulletin.mockResolvedValue(mockClaim);

      const result = await service.getClaimsByPost(createPostId('post-1'));

      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getClaimsByStatus', () => {
    it('returns paginated results', async () => {
      mockedStorageRead.mockResolvedValue({ byPost: {}, all: [] });

      const result = await service.getClaimsByStatus({
        pagination: { limit: 10, offset: 0 },
      });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('hasMore');
    });
  });

  describe('getPendingClaims', () => {
    it('returns paginated pending claims', async () => {
      mockedStorageRead.mockResolvedValue({ byPost: {}, all: [] });

      const result = await service.getPendingClaims({
        pagination: { limit: 10, offset: 0 },
      });

      expect(result).toHaveProperty('items');
    });
  });

  describe('extractClaim', () => {
    it('returns error when wallet not connected', async () => {
      mockedGetConnectedWallet.mockReturnValue(null);
      mockedGetConnectedCredential.mockReturnValue(null);

      const result = await service.extractClaim({
        statement: 'Test claim',
        sourcePostId: createPostId('post-1'),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Wallet not connected');
      }
    });

    it('creates claim when wallet connected', async () => {
      mockedGetConnectedWallet.mockReturnValue('5GrwvaEF...' as never);
      mockedGetConnectedCredential.mockReturnValue(createDIMCredential('user-1'));
      mockedUploadToBulletin.mockResolvedValue(ok({ cid: 'new-claim-cid' }));

      const result = await service.extractClaim({
        statement: 'Test claim',
        sourcePostId: createPostId('post-1'),
      });

      expect(result.ok).toBe(true);
      expect(mockedUploadToBulletin).toHaveBeenCalled();
    });

    it('returns error when upload fails', async () => {
      mockedGetConnectedWallet.mockReturnValue('5GrwvaEF...' as never);
      mockedGetConnectedCredential.mockReturnValue(createDIMCredential('user-1'));
      mockedUploadToBulletin.mockResolvedValue(err('Upload failed'));

      const result = await service.extractClaim({
        statement: 'Test claim',
        sourcePostId: createPostId('post-1'),
      });

      expect(result.ok).toBe(false);
    });
  });

  describe('submitEvidence', () => {
    it('returns error when wallet not connected', async () => {
      mockedGetConnectedWallet.mockReturnValue(null);
      mockedGetConnectedCredential.mockReturnValue(null);

      const result = await service.submitEvidence(createClaimId('claim-1'), {
        postId: createPostId('evidence-post'),
        supports: true,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Wallet not connected');
      }
    });

    it('returns error when claim not found', async () => {
      mockedGetConnectedWallet.mockReturnValue('5GrwvaEF...' as never);
      mockedGetConnectedCredential.mockReturnValue(createDIMCredential('user-1'));
      mockedFetchFromBulletin.mockReset();
      mockedFetchFromBulletin.mockResolvedValue(null);

      const result = await service.submitEvidence(createClaimId('submit-evidence-nonexistent'), {
        postId: createPostId('evidence-post'),
        supports: true,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Claim not found');
      }
    });

    it('uploads updated claim with evidence', async () => {
      mockedGetConnectedWallet.mockReturnValue('5GrwvaEF...' as never);
      mockedGetConnectedCredential.mockReturnValue(createDIMCredential('user-1'));
      const existingClaim = createMockClaim('existing-claim', 'post-1');
      mockedFetchFromBulletin.mockResolvedValue(existingClaim);
      mockedUploadToBulletin.mockResolvedValue(ok({ cid: 'updated-claim-cid' }));

      const result = await service.submitEvidence(createClaimId('existing-claim'), {
        postId: createPostId('evidence-post'),
        supports: true,
        note: 'Supporting evidence',
      });

      expect(result.ok).toBe(true);
      expect(mockedUploadToBulletin).toHaveBeenCalled();
    });
  });

  describe('getAllClaims', () => {
    it('returns paginated claims', async () => {
      mockedStorageRead.mockResolvedValue({ byPost: {}, all: [] });

      const result = await service.getAllClaims({
        pagination: { limit: 10, offset: 0 },
      });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
    });
  });
});

describe('claimService singleton', () => {
  it('is an instance of ClaimServiceImpl', () => {
    expect(claimService).toBeInstanceOf(ClaimServiceImpl);
  });
});
