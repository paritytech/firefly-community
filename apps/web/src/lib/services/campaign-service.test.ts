/**
 * Tests for campaign service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CampaignServiceImpl, campaignService } from './campaign-service';
import type { Campaign, CampaignId } from '@cocuyo/types';
import {
  createCampaignId,
  createPostId,
  createOutletId,
  createPUSDAmount,
  createEscrowId,
  createTransactionHash,
} from '@cocuyo/types';

// Mock service utils
vi.mock('./service-utils', () => {
  const getConnectedWallet = vi.fn<() => string | null>();
  return {
    getConnectedWallet,
    fetchFromBulletin: vi.fn(),
    // Mirror the real guard using the test-controlled getter so connection
    // state is driven by mockedGetConnectedWallet.
    requireConnectedWallet: (action: string) => {
      const wallet = getConnectedWallet();
      if (wallet === null) {
        return { ok: false, error: `Wallet not connected. Please connect ${action}.` };
      }
      return { ok: true, value: { wallet, credential: `cred-${wallet}` } };
    },
  };
});

// Mock seed data
vi.mock('@/lib/seed-data', () => ({
  getSeedCampaignsForLocale: vi.fn(),
}));

// Mock bulletin
vi.mock('@cocuyo/bulletin', () => ({
  calculateCIDFromJSON: vi.fn(() => 'test-cid'),
}));

import { getConnectedWallet, fetchFromBulletin } from './service-utils';
import { getSeedCampaignsForLocale } from '@/lib/seed-data';

const mockedGetConnectedWallet = vi.mocked(getConnectedWallet);
const mockedFetchFromBulletin = vi.mocked(fetchFromBulletin);
const mockedGetSeedCampaignsForLocale = vi.mocked(getSeedCampaignsForLocale);

const createMockCampaign = (id: string): Campaign => ({
  id: createCampaignId(id),
  title: `Campaign ${id}`,
  description: 'Test campaign description',
  topics: ['politics', 'economy'],
  location: 'Test City',
  sponsor: {
    type: 'outlet',
    id: createOutletId('sponsor-1'),
    name: 'Test Sponsor',
  },
  status: 'active',
  fundingAmount: createPUSDAmount(1000000n),
  escrowId: createEscrowId('escrow-1'),
  fundingTxHash: createTransactionHash('0x123'),
  payoutMode: 'private',
  deliverables: [
    { type: 'evidence_gathered', target: 10, current: 5 },
    { type: 'sources_verified', target: 5, current: 2 },
  ],
  contributingPostIds: [createPostId('post-1')],
  createdAt: Date.now() - 86400000,
  expiresAt: Date.now() + 86400000,
});

describe('CampaignServiceImpl', () => {
  let service: CampaignServiceImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CampaignServiceImpl();
    mockedGetSeedCampaignsForLocale.mockReturnValue(new Map());
    mockedFetchFromBulletin.mockResolvedValue(null);
    mockedGetConnectedWallet.mockReturnValue(null);
  });

  describe('getCampaign', () => {
    it('returns campaign from seed data', async () => {
      const mockCampaign = createMockCampaign('seed-campaign');
      const seedMap = new Map<CampaignId, Campaign>([[mockCampaign.id, mockCampaign]]);
      mockedGetSeedCampaignsForLocale.mockReturnValue(seedMap);

      const result = await service.getCampaign(mockCampaign.id);

      expect(result).toBe(mockCampaign);
    });

    it('uses locale for seed data', async () => {
      mockedGetSeedCampaignsForLocale.mockReturnValue(new Map());

      await service.getCampaign(createCampaignId('test'), 'es');

      expect(mockedGetSeedCampaignsForLocale).toHaveBeenCalledWith('es');
    });

    it('falls back to bulletin fetch', async () => {
      mockedGetSeedCampaignsForLocale.mockReturnValue(new Map());
      const bulletinCampaign = createMockCampaign('bulletin-campaign');
      mockedFetchFromBulletin.mockResolvedValue(bulletinCampaign);

      const result = await service.getCampaign(createCampaignId('unknown'));

      expect(mockedFetchFromBulletin).toHaveBeenCalled();
      expect(result).toBe(bulletinCampaign);
    });

    it('returns null when not found', async () => {
      mockedGetSeedCampaignsForLocale.mockReturnValue(new Map());
      mockedFetchFromBulletin.mockResolvedValue(null);

      const result = await service.getCampaign(createCampaignId('nonexistent'));

      expect(result).toBeNull();
    });
  });

  describe('getCampaigns', () => {
    it('returns paginated campaigns', async () => {
      const campaign = createMockCampaign('paginated-campaign');
      const seedMap = new Map<CampaignId, Campaign>([[campaign.id, campaign]]);
      mockedGetSeedCampaignsForLocale.mockReturnValue(seedMap);

      const result = await service.getCampaigns({
        pagination: { limit: 10, offset: 0 },
      });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
    });

    it('filters by status', async () => {
      const activeCampaign = createMockCampaign('active-campaign');
      const completedCampaign = {
        ...createMockCampaign('completed-campaign'),
        status: 'completed' as const,
      };
      const seedMap = new Map<CampaignId, Campaign>([
        [activeCampaign.id, activeCampaign],
        [completedCampaign.id, completedCampaign],
      ]);
      mockedGetSeedCampaignsForLocale.mockReturnValue(seedMap);

      const result = await service.getCampaigns({
        status: 'active',
        pagination: { limit: 10, offset: 0 },
      });

      expect(result.items.every((c) => c.status === 'active')).toBe(true);
    });

    it('filters by topic', async () => {
      const campaign = createMockCampaign('topic-campaign');
      const seedMap = new Map<CampaignId, Campaign>([[campaign.id, campaign]]);
      mockedGetSeedCampaignsForLocale.mockReturnValue(seedMap);

      const result = await service.getCampaigns({
        topic: 'politics',
        pagination: { limit: 10, offset: 0 },
      });

      expect(result.items.every((c) => c.topics.includes('politics'))).toBe(true);
    });

    it('filters by location', async () => {
      const campaign = createMockCampaign('location-campaign');
      const seedMap = new Map<CampaignId, Campaign>([[campaign.id, campaign]]);
      mockedGetSeedCampaignsForLocale.mockReturnValue(seedMap);

      const result = await service.getCampaigns({
        location: 'Test City',
        pagination: { limit: 10, offset: 0 },
      });

      expect(result.items.length).toBeGreaterThan(0);
    });

    it('filters by sponsor type', async () => {
      const campaign = createMockCampaign('sponsor-campaign');
      const seedMap = new Map<CampaignId, Campaign>([[campaign.id, campaign]]);
      mockedGetSeedCampaignsForLocale.mockReturnValue(seedMap);

      const result = await service.getCampaigns({
        sponsorType: 'outlet',
        pagination: { limit: 10, offset: 0 },
      });

      expect(result.items.every((c) => c.sponsor.type === 'outlet')).toBe(true);
    });
  });

  describe('getActiveCampaigns', () => {
    it('returns only active campaigns', async () => {
      const campaign = createMockCampaign('active-campaign');
      const seedMap = new Map<CampaignId, Campaign>([[campaign.id, campaign]]);
      mockedGetSeedCampaignsForLocale.mockReturnValue(seedMap);

      const result = await service.getActiveCampaigns({
        pagination: { limit: 10, offset: 0 },
      });

      expect(result.items.every((c) => c.status === 'active')).toBe(true);
    });
  });

  describe('createCampaign', () => {
    it('returns error when wallet not connected', async () => {
      mockedGetConnectedWallet.mockReturnValue(null);

      const result = await service.createCampaign({
        title: 'New Campaign',
        description: 'Description',
        topics: ['politics'],
        sponsor: {
          type: 'outlet',
          id: createOutletId('sponsor-1'),
          name: 'Test Sponsor',
        },
        fundingAmount: createPUSDAmount(1000n),
        payoutMode: 'private',
        deliverables: [{ type: 'evidence_gathered', target: 5 }],
        duration: 86400,
      });

      expect(result.ok).toBe(false);
    });

    it('creates campaign when wallet connected', async () => {
      mockedGetConnectedWallet.mockReturnValue('5GrwvaEF...');

      const result = await service.createCampaign({
        title: 'New Campaign',
        description: 'Description',
        topics: ['politics'],
        sponsor: {
          type: 'outlet',
          id: createOutletId('sponsor-1'),
          name: 'Test Sponsor',
        },
        fundingAmount: createPUSDAmount(1000n),
        payoutMode: 'private',
        deliverables: [{ type: 'evidence_gathered', target: 5 }],
        duration: 86400,
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('contributeToCampaign', () => {
    it('returns error when wallet not connected', async () => {
      mockedGetConnectedWallet.mockReturnValue(null);

      const result = await service.contributeToCampaign(
        createCampaignId('campaign-1'),
        createPostId('post-1')
      );

      expect(result.ok).toBe(false);
    });

    it('returns error when campaign not in user cache', async () => {
      mockedGetConnectedWallet.mockReturnValue('5GrwvaEF...');

      const result = await service.contributeToCampaign(
        createCampaignId('nonexistent'),
        createPostId('post-1')
      );

      expect(result.ok).toBe(false);
    });
  });
});

describe('campaignService singleton', () => {
  it('is an instance of CampaignServiceImpl', () => {
    expect(campaignService).toBeInstanceOf(CampaignServiceImpl);
  });
});
