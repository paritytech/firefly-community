/**
 * Tests for credibility utilities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPersonhoodWeight,
  getQualityWeight,
  calculateWeightedScore,
  calculateCredibilityScore,
  summarizeByPersonhood,
} from './credibility';
import type { Corroboration, EvidenceQuality } from '@cocuyo/types';
import { createDIMCredential, createCorroborationId, createPostId } from '@cocuyo/types';

// Mock personhood service
vi.mock('./services/personhood-service', () => ({
  personhoodService: {
    getLevel: vi.fn(),
  },
}));

import { personhoodService } from './services/personhood-service';
// eslint-disable-next-line @typescript-eslint/unbound-method -- vitest mocking pattern
const mockedGetLevel = vi.mocked(personhoodService.getLevel);

const createMockCorroboration = (
  overrides: Partial<{
    type: Corroboration['type'];
    quality: EvidenceQuality;
    dimSignature: string;
  }> = {}
): Corroboration => ({
  id: createCorroborationId('corr-1'),
  postId: createPostId('post-1'),
  type: overrides.type ?? 'evidence',
  dimSignature: createDIMCredential(overrides.dimSignature ?? 'user-1'),
  quality: overrides.quality ?? 'observation',
  note: 'Test evidence',
  createdAt: Date.now(),
});

describe('getPersonhoodWeight', () => {
  it('returns 0 for none level', () => {
    expect(getPersonhoodWeight('none')).toBe(0);
  });

  it('returns 0.5 for lite level', () => {
    expect(getPersonhoodWeight('lite')).toBe(0.5);
  });

  it('returns 1.0 for full level', () => {
    expect(getPersonhoodWeight('full')).toBe(1.0);
  });
});

describe('getQualityWeight', () => {
  it('returns 2.0 for peer_reviewed', () => {
    expect(getQualityWeight('peer_reviewed')).toBe(2.0);
  });

  it('returns 1.5 for source_verified', () => {
    expect(getQualityWeight('source_verified')).toBe(1.5);
  });

  it('returns 1.2 for documented', () => {
    expect(getQualityWeight('documented')).toBe(1.2);
  });

  it('returns 1.0 for observation', () => {
    expect(getQualityWeight('observation')).toBe(1.0);
  });

  it('returns 0.5 for unverified', () => {
    expect(getQualityWeight('unverified')).toBe(0.5);
  });
});

describe('calculateWeightedScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 for empty array', async () => {
    const score = await calculateWeightedScore([]);
    expect(score).toBe(0);
  });

  it('calculates positive score for supporting corroboration with full personhood', async () => {
    mockedGetLevel.mockResolvedValue('full');

    const corroborations = [createMockCorroboration({ type: 'evidence', quality: 'observation' })];
    const score = await calculateWeightedScore(corroborations);

    // full (1.0) * observation (1.0) * supporting (+1) = 1.0
    expect(score).toBe(1.0);
  });

  it('calculates negative score for challenge corroboration', async () => {
    mockedGetLevel.mockResolvedValue('full');

    const corroborations = [createMockCorroboration({ type: 'challenge', quality: 'observation' })];
    const score = await calculateWeightedScore(corroborations);

    // full (1.0) * observation (1.0) * challenge (-1) = -1.0
    expect(score).toBe(-1.0);
  });

  it('applies quality weight multiplier', async () => {
    mockedGetLevel.mockResolvedValue('full');

    const corroborations = [
      createMockCorroboration({ type: 'evidence', quality: 'peer_reviewed' }),
    ];
    const score = await calculateWeightedScore(corroborations);

    // full (1.0) * peer_reviewed (2.0) * supporting (+1) = 2.0
    expect(score).toBe(2.0);
  });

  it('applies personhood weight (lite)', async () => {
    mockedGetLevel.mockResolvedValue('lite');

    const corroborations = [createMockCorroboration({ type: 'evidence', quality: 'observation' })];
    const score = await calculateWeightedScore(corroborations);

    // lite (0.5) * observation (1.0) * supporting (+1) = 0.5
    expect(score).toBe(0.5);
  });

  it('returns 0 for none personhood', async () => {
    mockedGetLevel.mockResolvedValue('none');

    const corroborations = [createMockCorroboration({ type: 'evidence', quality: 'observation' })];
    const score = await calculateWeightedScore(corroborations);

    // none (0) * observation (1.0) * supporting (+1) = 0
    expect(score).toBe(0);
  });

  it('sums multiple corroborations', async () => {
    mockedGetLevel.mockResolvedValue('full');

    const corroborations = [
      createMockCorroboration({ type: 'evidence', quality: 'observation' }),
      createMockCorroboration({ type: 'evidence', quality: 'observation' }),
      createMockCorroboration({ type: 'challenge', quality: 'observation' }),
    ];
    const score = await calculateWeightedScore(corroborations);

    // (1.0 + 1.0 - 1.0) = 1.0
    expect(score).toBe(1.0);
  });
});

describe('calculateCredibilityScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 for empty array', async () => {
    const score = await calculateCredibilityScore([]);
    expect(score).toBe(0);
  });

  it('returns around 50 for balanced corroborations', async () => {
    mockedGetLevel.mockResolvedValue('full');

    const corroborations = [
      createMockCorroboration({ type: 'evidence', quality: 'observation' }),
      createMockCorroboration({ type: 'challenge', quality: 'observation' }),
    ];
    const score = await calculateCredibilityScore(corroborations);

    // Net score is 0, sigmoid gives 50
    expect(score).toBe(50);
  });

  it('returns above 50 for positive corroborations', async () => {
    mockedGetLevel.mockResolvedValue('full');

    const corroborations = [
      createMockCorroboration({ type: 'evidence', quality: 'peer_reviewed' }),
      createMockCorroboration({ type: 'evidence', quality: 'peer_reviewed' }),
    ];
    const score = await calculateCredibilityScore(corroborations);

    expect(score).toBeGreaterThan(50);
  });

  it('returns below 50 for negative corroborations', async () => {
    mockedGetLevel.mockResolvedValue('full');

    const corroborations = [
      createMockCorroboration({ type: 'challenge', quality: 'peer_reviewed' }),
      createMockCorroboration({ type: 'challenge', quality: 'peer_reviewed' }),
    ];
    const score = await calculateCredibilityScore(corroborations);

    expect(score).toBeLessThan(50);
  });

  it('returns rounded integer', async () => {
    mockedGetLevel.mockResolvedValue('lite');

    const corroborations = [createMockCorroboration({ type: 'evidence', quality: 'observation' })];
    const score = await calculateCredibilityScore(corroborations);

    expect(Number.isInteger(score)).toBe(true);
  });
});

describe('summarizeByPersonhood', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty summary for empty array', async () => {
    const summary = await summarizeByPersonhood([]);

    expect(summary.full.count).toBe(0);
    expect(summary.full.weight).toBe(0);
    expect(summary.lite.count).toBe(0);
    expect(summary.lite.weight).toBe(0);
    expect(summary.none.count).toBe(0);
    expect(summary.none.weight).toBe(0);
  });

  it('groups corroborations by personhood level', async () => {
    mockedGetLevel
      .mockResolvedValueOnce('full')
      .mockResolvedValueOnce('lite')
      .mockResolvedValueOnce('none');

    const corroborations = [
      createMockCorroboration({ dimSignature: 'user-1', quality: 'observation' }),
      createMockCorroboration({ dimSignature: 'user-2', quality: 'observation' }),
      createMockCorroboration({ dimSignature: 'user-3', quality: 'observation' }),
    ];

    const summary = await summarizeByPersonhood(corroborations);

    expect(summary.full.count).toBe(1);
    expect(summary.lite.count).toBe(1);
    expect(summary.none.count).toBe(1);
  });

  it('calculates weight correctly for each level', async () => {
    mockedGetLevel.mockResolvedValueOnce('full').mockResolvedValueOnce('lite');

    const corroborations = [
      createMockCorroboration({ dimSignature: 'user-1', quality: 'peer_reviewed' }),
      createMockCorroboration({ dimSignature: 'user-2', quality: 'observation' }),
    ];

    const summary = await summarizeByPersonhood(corroborations);

    // full (1.0) * peer_reviewed (2.0) = 2.0
    expect(summary.full.weight).toBe(2.0);
    // lite (0.5) * observation (1.0) = 0.5
    expect(summary.lite.weight).toBe(0.5);
  });

  it('applies negative sign for challenges', async () => {
    mockedGetLevel.mockResolvedValue('full');

    const corroborations = [createMockCorroboration({ type: 'challenge', quality: 'observation' })];

    const summary = await summarizeByPersonhood(corroborations);

    expect(summary.full.count).toBe(1);
    expect(summary.full.weight).toBe(-1.0);
  });
});
