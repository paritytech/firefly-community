'use client';

/**
 * Campaign service hook.
 *
 * This hook wraps the singleton campaignService to provide wallet state integration.
 * All data is stored in the singleton's cache to avoid cache divergence.
 */

import { useCallback } from 'react';
import type {
  CampaignService,
  Campaign,
  CampaignId,
  CampaignPreview,
  CampaignStatus,
  NewCampaign,
  PaginationParams,
  PaginatedResult,
  Result,
  PostId,
} from '@cocuyo/types';
import { campaignService } from '../campaign-service';
import { setConnectedWallet } from '../service-utils';
import { useServiceWithWallet } from './useServiceWithWallet';

export type Locale = 'en' | 'es';

/**
 * Hook providing campaign service operations.
 *
 * All operations delegate to the singleton campaignService to ensure
 * consistent caching. Write operations use wallet state from useSigner().
 */
export function useCampaignService(): CampaignService {
  const { accountRef, connectedRef } = useServiceWithWallet();

  // Delegate read operations directly to singleton
  const getCampaign = useCallback(
    async (id: CampaignId, locale = 'en'): Promise<Campaign | null> => {
      return campaignService.getCampaign(id, locale);
    },
    []
  );

  const getCampaigns = useCallback(
    async (params: {
      status?: CampaignStatus;
      topic?: string;
      location?: string;
      sponsorType?: 'outlet' | 'collective' | 'community';
      locale?: string;
      pagination: PaginationParams;
    }): Promise<PaginatedResult<CampaignPreview>> => {
      return campaignService.getCampaigns(params);
    },
    []
  );

  const getActiveCampaigns = useCallback(
    async (params: {
      topic?: string;
      location?: string;
      locale?: string;
      pagination: PaginationParams;
    }): Promise<PaginatedResult<CampaignPreview>> => {
      return campaignService.getActiveCampaigns(params);
    },
    []
  );

  const createCampaign = useCallback(
    async (newCampaign: NewCampaign): Promise<Result<CampaignId, string>> => {
      const account = accountRef.current;
      const connected = connectedRef.current;

      if (!connected || !account) {
        return { ok: false, error: 'Wallet not connected. Please connect to create a campaign.' };
      }

      // Sync wallet state to singleton
      setConnectedWallet(account.address);

      // Delegate to singleton service which maintains the unified cache
      return campaignService.createCampaign(newCampaign);
    },
    []
  );

  const contributeToCampaign = useCallback(
    async (campaignId: CampaignId, postId: PostId): Promise<Result<void, string>> => {
      const account = accountRef.current;
      const connected = connectedRef.current;

      if (!connected || !account) {
        return { ok: false, error: 'Wallet not connected. Please connect to contribute.' };
      }

      // Sync wallet state to singleton
      setConnectedWallet(account.address);

      // Delegate to singleton service which maintains the unified cache
      return campaignService.contributeToCampaign(campaignId, postId);
    },
    []
  );

  return {
    getCampaign,
    getCampaigns,
    getActiveCampaigns,
    createCampaign,
    contributeToCampaign,
  };
}
