/**
 * Campaign Service implementation with Bulletin storage.
 *
 * This service provides:
 * - Bulletin Chain storage for campaigns (writes)
 * - Session cache for immediate feedback
 * - Empty results for queries until indexing is implemented
 */

import type {
  CampaignId,
  CampaignService,
  Campaign,
  CampaignPreview,
  CampaignStatus,
  NewCampaign,
  PaginatedResult,
  PaginationParams,
  Result,
  PostId,
} from '@cocuyo/types';
import { ok, err, createCampaignId } from '@cocuyo/types';
import { calculateCIDFromJSON } from '@cocuyo/bulletin';
import { requireConnectedWallet, fetchFromBulletin } from './service-utils';
import { getSeedCampaignsForLocale } from '@/lib/seed-data';

export type Locale = 'en' | 'es';

// Session cache for user-created campaigns (non-seed data only)
const userCreatedCampaigns: Campaign[] = [];

function campaignToPreview(campaign: Campaign): CampaignPreview {
  // Calculate deliverable progress
  const totalTarget = campaign.deliverables.reduce((sum, d) => sum + d.target, 0);
  const totalCurrent = campaign.deliverables.reduce((sum, d) => sum + d.current, 0);
  const deliverableProgress = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;

  return {
    id: campaign.id,
    title: campaign.title,
    topics: campaign.topics,
    ...(campaign.location !== undefined && { location: campaign.location }),
    sponsor: campaign.sponsor,
    status: campaign.status,
    fundingAmount: campaign.fundingAmount,
    payoutMode: campaign.payoutMode,
    contributionCount: campaign.contributingPostIds.length,
    deliverableProgress,
    expiresAt: campaign.expiresAt,
  };
}

/**
 * Campaign Service implementation.
 */
export class CampaignServiceImpl implements CampaignService {
  /**
   * Get a single campaign by ID.
   */
  async getCampaign(id: CampaignId, locale?: string): Promise<Campaign | null> {
    const loc = (locale ?? 'en') as Locale;

    // Check user-created campaigns first
    const userCampaign = userCreatedCampaigns.find((c) => c.id === id);
    if (userCampaign) return userCampaign;

    // Check localized seed data
    const seedCampaign = getSeedCampaignsForLocale(loc).get(id);
    if (seedCampaign) return seedCampaign;

    // Try fetching from Bulletin Chain
    return fetchFromBulletin<Campaign>(id);
  }

  /**
   * Get campaigns with optional filtering and pagination.
   */
  getCampaigns(params: {
    status?: CampaignStatus;
    topic?: string;
    location?: string;
    sponsorType?: 'outlet' | 'collective' | 'community';
    locale?: string;
    pagination: PaginationParams;
  }): Promise<PaginatedResult<CampaignPreview>> {
    const locale = (params.locale ?? 'en') as Locale;
    const allCampaigns = [...userCreatedCampaigns, ...getSeedCampaignsForLocale(locale).values()];
    let campaigns = allCampaigns.map(campaignToPreview);

    // Filter by status if specified
    if (params.status !== undefined) {
      campaigns = campaigns.filter((c) => c.status === params.status);
    }

    // Filter by sponsor type if specified
    if (params.sponsorType !== undefined) {
      campaigns = campaigns.filter((c) => c.sponsor.type === params.sponsorType);
    }

    // Filter by topic if specified
    if (params.topic !== undefined) {
      const topicLower = params.topic.toLowerCase();
      campaigns = campaigns.filter((c) =>
        c.topics.some((t: string) => t.toLowerCase().includes(topicLower))
      );
    }

    // Filter by location if specified
    if (params.location !== undefined) {
      const locationLower = params.location.toLowerCase();
      campaigns = campaigns.filter(
        (c) => c.location?.toLowerCase().includes(locationLower) ?? false
      );
    }

    // Apply pagination
    const { limit, offset } = params.pagination;
    const paginatedItems = campaigns.slice(offset, offset + limit);

    return Promise.resolve({
      items: paginatedItems,
      total: campaigns.length,
      hasMore: offset + limit < campaigns.length,
    });
  }

  /**
   * Get active campaigns with optional filtering and pagination.
   */
  async getActiveCampaigns(params: {
    topic?: string;
    location?: string;
    locale?: string;
    pagination: PaginationParams;
  }): Promise<PaginatedResult<CampaignPreview>> {
    return this.getCampaigns({
      ...params,
      status: 'active',
    });
  }

  /**
   * Create a new campaign.
   */
  createCampaign(newCampaign: NewCampaign): Promise<Result<CampaignId, string>> {
    const walletCheck = requireConnectedWallet('to create a campaign');
    if (!walletCheck.ok) {
      return Promise.resolve(err(walletCheck.error));
    }

    const now = Date.now();

    const campaign: Campaign = {
      id: '' as CampaignId,
      title: newCampaign.title,
      description: newCampaign.description,
      topics: newCampaign.topics,
      ...(newCampaign.location !== undefined && { location: newCampaign.location }),
      sponsor: newCampaign.sponsor,
      status: 'active',
      fundingAmount: newCampaign.fundingAmount,
      // No on-chain escrow or funding tx exists for service-created campaigns —
      // omit these rather than fabricating values that masquerade as confirmed
      // on-chain funding. Real hashes are threaded only by the on-chain flow.
      payoutMode: newCampaign.payoutMode ?? 'private',
      deliverables: newCampaign.deliverables.map((d) => ({ ...d, current: 0 })),
      contributingPostIds: [],
      ...(newCampaign.targetClaimIds !== undefined && {
        targetClaimIds: newCampaign.targetClaimIds,
      }),
      createdAt: now,
      expiresAt: now + newCampaign.duration * 1000,
    };

    // Generate CID-based ID
    const cid = calculateCIDFromJSON(campaign);
    const campaignWithId: Campaign = { ...campaign, id: createCampaignId(cid) };

    // Add to session cache
    userCreatedCampaigns.unshift(campaignWithId);

    return Promise.resolve(ok(campaignWithId.id));
  }

  /**
   * Contribute a post to a campaign.
   */
  contributeToCampaign(campaignId: CampaignId, postId: PostId): Promise<Result<void, string>> {
    const walletCheck = requireConnectedWallet('to contribute');
    if (!walletCheck.ok) {
      return Promise.resolve(err(walletCheck.error));
    }

    // Find campaign in user cache
    const campaignIndex = userCreatedCampaigns.findIndex((c) => c.id === campaignId);
    if (campaignIndex !== -1) {
      const oldCampaign = userCreatedCampaigns[campaignIndex];
      if (oldCampaign) {
        userCreatedCampaigns[campaignIndex] = {
          ...oldCampaign,
          contributingPostIds: [...oldCampaign.contributingPostIds, postId],
        };
        return Promise.resolve(ok(undefined));
      }
    }

    // Campaign not found in user cache
    return Promise.resolve(err('Campaign not found or is read-only.'));
  }
}

// Export a singleton instance
export const campaignService: CampaignService = new CampaignServiceImpl();
