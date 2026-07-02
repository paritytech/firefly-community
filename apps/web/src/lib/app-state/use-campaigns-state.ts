'use client';

/**
 * useCampaignsState — campaigns slice of the app state.
 *
 * Owns the `campaigns` map plus the campaign↔post and claim↔campaign mappings.
 * `createCampaign` converts the dollar funding amount to on-chain units, selects
 * an outlet/firefly sponsor, and threads any real on-chain funding metadata.
 * `contributeToCampaign` reads the shared `posts` map to validate the target
 * post, so that map is injected.
 */

import { useCallback, useState } from 'react';
import {
  createCampaignId,
  createOutletId,
  createPUSDAmount,
  createTransactionHash,
} from '@cocuyo/types';
import type { Post, PostId, Campaign, CampaignId, ClaimId } from '@cocuyo/types';
import type { CurrentUser, NewCampaignInput } from './types';
import { generateId, fundingDollarsToUnits } from './helpers';
import { seedCampaigns, seedPostCampaigns, seedCampaignPosts } from '@/lib/seed-data';

interface UseCampaignsStateArgs {
  currentUser: CurrentUser;
  posts: Map<PostId, Post>;
}

export interface CampaignsSlice {
  campaigns: Map<CampaignId, Campaign>;
  postCampaigns: Map<PostId, CampaignId[]>;
  campaignPosts: Map<CampaignId, PostId[]>;
  claimCampaigns: Map<ClaimId, CampaignId[]>;
  createCampaign: (input: NewCampaignInput, targetPostId?: PostId) => Campaign | null;
  contributeToCampaign: (campaignId: CampaignId, postId: PostId) => boolean;
  getCampaign: (id: CampaignId) => Campaign | undefined;
  getPostCampaigns: (postId: PostId) => Campaign[];
  getClaimCampaigns: (claimId: ClaimId) => Campaign[];
  getAllCampaigns: () => Campaign[];
}

export function useCampaignsState({ currentUser, posts }: UseCampaignsStateArgs): CampaignsSlice {
  const [campaigns, setCampaigns] = useState<Map<CampaignId, Campaign>>(
    () => new Map(seedCampaigns)
  );
  const [postCampaigns, setPostCampaigns] = useState<Map<PostId, CampaignId[]>>(
    () => new Map(seedPostCampaigns)
  );
  const [campaignPosts, setCampaignPosts] = useState<Map<CampaignId, PostId[]>>(
    () => new Map(seedCampaignPosts)
  );
  const [claimCampaigns, setClaimCampaigns] = useState<Map<ClaimId, CampaignId[]>>(new Map());

  const createCampaign = useCallback(
    (input: NewCampaignInput, targetPostId?: PostId): Campaign | null => {
      // Allow any connected user with credentials (personhood check happens in UI)
      if (
        !currentUser.isConnected ||
        currentUser.credentialHash === null ||
        currentUser.pseudonym === null ||
        currentUser.pseudonym === ''
      ) {
        return null;
      }

      const now = Date.now();
      const id = createCampaignId(generateId());
      const expiresAt = now + input.expiresInDays * 24 * 60 * 60 * 1000;

      // Convert dollars to smallest unit (6 decimals, 1 pUSD = 1,000,000 units)
      // Use string parsing to avoid floating point multiplication errors
      // e.g., 0.000001 * 1_000_000 can produce 0.9999999999999999 instead of 1
      const fundingUnits = fundingDollarsToUnits(input.fundingAmount);

      // Use outlet sponsor if in outlet mode, otherwise firefly sponsor
      const sponsor: Campaign['sponsor'] = currentUser.isOutletAccount
        ? {
            type: 'outlet',
            id: createOutletId('demo-outlet'),
            name: 'Demo Outlet',
          }
        : {
            type: 'firefly',
            credential: currentUser.credentialHash,
            pseudonym: currentUser.pseudonym,
          };

      const campaign: Campaign = {
        id,
        title: input.title,
        description: input.description,
        topics: input.topics,
        sponsor,
        fundingAmount: createPUSDAmount(fundingUnits),
        // Keep the REAL on-chain funding tx hash when present. When absent (e.g.
        // the simulated/dev flow with no on-chain escrow) omit it entirely — never
        // fabricate a hash that would masquerade as a confirmed payment.
        ...(input.fundingTxHash !== undefined && {
          fundingTxHash: createTransactionHash(input.fundingTxHash),
        }),
        ...(input.onChainBountyId !== undefined && { onChainBountyId: input.onChainBountyId }),
        contributingPostIds: targetPostId ? [targetPostId] : [],
        ...(input.targetClaimIds !== undefined &&
          input.targetClaimIds.length > 0 && { targetClaimIds: input.targetClaimIds }),
        deliverables: [{ type: 'evidence_gathered', target: 10, current: 0 }],
        payoutMode: 'public',
        status: 'active',
        createdAt: now,
        expiresAt,
      };

      setCampaigns((prev) => new Map(prev).set(id, campaign));

      // If there's a target post, update the mappings
      if (targetPostId) {
        setPostCampaigns((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(targetPostId) ?? [];
          newMap.set(targetPostId, [...existing, id]);
          return newMap;
        });

        setCampaignPosts((prev) => {
          const newMap = new Map(prev);
          newMap.set(id, [targetPostId]);
          return newMap;
        });
      }

      // Update claim-campaign mappings
      if (input.targetClaimIds !== undefined && input.targetClaimIds.length > 0) {
        setClaimCampaigns((prev) => {
          const newMap = new Map(prev);
          for (const claimId of input.targetClaimIds ?? []) {
            const existing = newMap.get(claimId) ?? [];
            newMap.set(claimId, [...existing, id]);
          }
          return newMap;
        });
      }

      return campaign;
    },
    [currentUser]
  );

  const contributeToCampaign = useCallback(
    (campaignId: CampaignId, postId: PostId): boolean => {
      if (!currentUser.isConnected) {
        return false;
      }

      const campaign = campaigns.get(campaignId);
      const post = posts.get(postId);
      if (!campaign || !post) {
        return false;
      }

      // Update campaign
      setCampaigns((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(campaignId);
        if (existing && !existing.contributingPostIds.includes(postId)) {
          newMap.set(campaignId, {
            ...existing,
            contributingPostIds: [...existing.contributingPostIds, postId],
          });
        }
        return newMap;
      });

      // Update mappings
      setPostCampaigns((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(postId) ?? [];
        if (!existing.includes(campaignId)) {
          newMap.set(postId, [...existing, campaignId]);
        }
        return newMap;
      });

      setCampaignPosts((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(campaignId) ?? [];
        if (!existing.includes(postId)) {
          newMap.set(campaignId, [...existing, postId]);
        }
        return newMap;
      });

      return true;
    },
    [currentUser, campaigns, posts]
  );

  const getCampaign = useCallback(
    (id: CampaignId): Campaign | undefined => {
      return campaigns.get(id);
    },
    [campaigns]
  );

  const getPostCampaigns = useCallback(
    (postId: PostId): Campaign[] => {
      const ids = postCampaigns.get(postId) ?? [];
      return ids.map((id) => campaigns.get(id)).filter((c): c is Campaign => c !== undefined);
    },
    [postCampaigns, campaigns]
  );

  const getClaimCampaigns = useCallback(
    (claimId: ClaimId): Campaign[] => {
      const ids = claimCampaigns.get(claimId) ?? [];
      return ids.map((id) => campaigns.get(id)).filter((c): c is Campaign => c !== undefined);
    },
    [claimCampaigns, campaigns]
  );

  const getAllCampaigns = useCallback((): Campaign[] => {
    return Array.from(campaigns.values()).sort((a, b) => b.createdAt - a.createdAt);
  }, [campaigns]);

  return {
    campaigns,
    postCampaigns,
    campaignPosts,
    claimCampaigns,
    createCampaign,
    contributeToCampaign,
    getCampaign,
    getPostCampaigns,
    getClaimCampaigns,
    getAllCampaigns,
  };
}
