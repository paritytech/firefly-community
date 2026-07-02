'use client';

/**
 * useDebouncedSuggestions — Fetch related chains and campaigns with debounce.
 *
 * As the user enters topics and location, this hook fetches matching
 * story chains and open campaigns to suggest linking the new signal to.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ChainPreview, CampaignPreview } from '@cocuyo/types';
import { chainService } from '@/lib/services/service-instances';
import { campaignService } from '@/lib/services/campaign-service';
import { createLogger } from '@/lib/logging';

const log = createLogger('useDebouncedSuggestions');

const DEBOUNCE_MS = 300;

interface SuggestionsResult {
  chains: ChainPreview[];
  campaigns: CampaignPreview[];
  isLoading: boolean;
}

export function useDebouncedSuggestions(topics: string[], location: string): SuggestionsResult {
  const [chains, setChains] = useState<ChainPreview[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignPreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const fetchSuggestions = useCallback(async (): Promise<void> => {
    // Cancel previous request
    if (abortController.current != null) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    // If no topics and no location, clear suggestions
    if (topics.length === 0 && location.trim().length === 0) {
      setChains([]);
      setCampaigns([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // Fetch chains matching topics/location
      const chainPromises = topics.map(async (topic) => {
        const trimmedLocation = location.trim();
        const result = await chainService.getChains({
          topic,
          ...(trimmedLocation.length > 0 && { location: trimmedLocation }),
          pagination: { limit: 5, offset: 0 },
        });
        return result.items;
      });

      // Also fetch by location alone if provided
      const trimmedLocation = location.trim();
      if (trimmedLocation.length > 0) {
        chainPromises.push(
          chainService
            .getChains({
              location: trimmedLocation,
              pagination: { limit: 5, offset: 0 },
            })
            .then((r) => r.items)
        );
      }

      const chainResults = await Promise.all(chainPromises);

      // Deduplicate chains by ID
      const chainMap = new Map<string, ChainPreview>();
      chainResults.flat().forEach((chain) => {
        if (!chainMap.has(chain.id)) {
          chainMap.set(chain.id, chain);
        }
      });

      // Get active campaigns and filter by topic/location match
      const campaignResult = await campaignService.getActiveCampaigns({
        pagination: { limit: 50, offset: 0 },
      });
      const trimmedLoc = location.trim().toLowerCase();
      const matchingCampaigns = campaignResult.items.filter(
        (campaign: CampaignPreview): boolean => {
          const topicMatch = topics.some((t) =>
            campaign.topics.some((ct: string) => ct.toLowerCase().includes(t.toLowerCase()))
          );
          const locationMatch =
            trimmedLoc.length > 0 && campaign.location?.toLowerCase().includes(trimmedLoc) === true;

          return topicMatch || locationMatch;
        }
      );

      // Check if request was aborted (controller is set at line 38)
      if (abortController.current.signal.aborted) {
        return;
      }

      setChains(Array.from(chainMap.values()).slice(0, 10));
      setCampaigns(matchingCampaigns.slice(0, 5));
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      log.error('Failed to fetch suggestions', 'fetchSuggestions', error, {
        topicCount: topics.length,
      });
    } finally {
      if (!abortController.current.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [topics, location]);

  // Debounce the fetch
  useEffect(() => {
    if (debounceTimer.current != null) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      void fetchSuggestions();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current != null) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [fetchSuggestions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortController.current != null) {
        abortController.current.abort();
      }
    };
  }, []);

  return { chains, campaigns, isLoading };
}
