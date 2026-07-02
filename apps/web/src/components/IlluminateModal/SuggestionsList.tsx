'use client';

/**
 * SuggestionsList — Displays matching chains and campaigns for linking.
 *
 * Shows selectable cards for story chains and campaigns that match
 * the signal's topics and location. Pre-selected items are shown first.
 */

import type { ReactElement } from 'react';
import type { ChainPreview, CampaignPreview, ChainId, CampaignId } from '@cocuyo/types';

export interface SuggestionsListProps {
  chains: ChainPreview[];
  campaigns: CampaignPreview[];
  selectedChains: ChainId[];
  selectedCampaigns: CampaignId[];
  preSelectedChainId: ChainId | null;
  preSelectedCampaignId: CampaignId | null;
  onChainToggle: (chainId: ChainId) => void;
  onCampaignToggle: (campaignId: CampaignId) => void;
  isLoading: boolean;
}

function formatFunding(amount: bigint): string {
  const usdc = Number(amount) / 1_000_000;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(usdc);
}

export function SuggestionsList({
  chains,
  campaigns,
  selectedChains,
  selectedCampaigns,
  preSelectedChainId,
  preSelectedCampaignId,
  onChainToggle,
  onCampaignToggle,
  isLoading,
}: SuggestionsListProps): ReactElement {
  // Sort chains: pre-selected first, then selected, then rest
  const sortedChains = [...chains].sort((a, b) => {
    const aPreSelected = a.id === preSelectedChainId;
    const bPreSelected = b.id === preSelectedChainId;
    const aSelected = selectedChains.includes(a.id);
    const bSelected = selectedChains.includes(b.id);

    if (aPreSelected && !bPreSelected) return -1;
    if (!aPreSelected && bPreSelected) return 1;
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return 0;
  });

  // Sort campaigns similarly
  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const aPreSelected = a.id === preSelectedCampaignId;
    const bPreSelected = b.id === preSelectedCampaignId;
    const aSelected = selectedCampaigns.includes(a.id);
    const bSelected = selectedCampaigns.includes(b.id);

    if (aPreSelected && !bPreSelected) return -1;
    if (!aPreSelected && bPreSelected) return 1;
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return 0;
  });

  const hasContent = chains.length > 0 || campaigns.length > 0;
  const hasPreSelected = preSelectedChainId != null || preSelectedCampaignId != null;

  if (!hasContent && !hasPreSelected && !isLoading) {
    return <></>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-medium text-white">Link to Story Chains or Campaigns</h3>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Connect your signal to related conversations or earn rewards.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Finding related chains and campaigns...
        </div>
      )}

      {/* Story Chains */}
      {sortedChains.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
            Story Chains ({sortedChains.length})
          </h4>
          <div className="space-y-2">
            {sortedChains.map((chain) => {
              const isSelected = selectedChains.includes(chain.id);
              const isPreSelected = chain.id === preSelectedChainId;

              return (
                <label
                  key={chain.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all ${
                    isSelected
                      ? 'border-[var(--color-accent)] border-opacity-50 bg-[var(--color-bg-elevated)]'
                      : 'border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-emphasis)]'
                  } `}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onChainToggle(chain.id)}
                    className="mt-1 h-4 w-4 rounded border-[var(--color-border-emphasis)] bg-[var(--color-bg-tertiary)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] focus:ring-offset-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-white">{chain.title}</span>
                      {isPreSelected && (
                        <span className="rounded bg-[var(--color-accent-glow)] px-2 py-0.5 text-xs text-[var(--color-accent)]">
                          Pre-selected
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
                      <span>{chain.postCount} posts</span>
                      <span className="text-[var(--color-corroborated)]">
                        {chain.corroborationCount} corroborations
                      </span>
                      {chain.location != null && <span>{chain.location}</span>}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Campaigns */}
      {sortedCampaigns.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
            Open Campaigns ({sortedCampaigns.length})
          </h4>
          <div className="space-y-2">
            {sortedCampaigns.map((campaign) => {
              const isSelected = selectedCampaigns.includes(campaign.id);
              const isPreSelected = campaign.id === preSelectedCampaignId;

              return (
                <label
                  key={campaign.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all ${
                    isSelected
                      ? 'border-[var(--color-accent)] border-opacity-50 bg-[var(--color-bg-elevated)]'
                      : 'border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-emphasis)]'
                  } `}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onCampaignToggle(campaign.id)}
                    className="mt-1 h-4 w-4 rounded border-[var(--color-border-emphasis)] bg-[var(--color-bg-tertiary)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] focus:ring-offset-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-white">
                        {campaign.title}
                      </span>
                      {isPreSelected && (
                        <span className="rounded bg-[var(--color-accent-glow)] px-2 py-0.5 text-xs text-[var(--color-accent)]">
                          Pre-selected
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs">
                      <span className="font-medium text-[var(--color-accent)]">
                        {formatFunding(campaign.fundingAmount)} reward
                      </span>
                      <span className="text-[var(--color-text-tertiary)]">
                        {campaign.contributionCount} contributions
                      </span>
                      {campaign.location != null && (
                        <span className="text-[var(--color-text-tertiary)]">
                          {campaign.location}
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {!isLoading && !hasContent && !hasPreSelected && (
        <p className="text-sm text-[var(--color-text-tertiary)]">
          Add topics or location to see related chains and campaigns.
        </p>
      )}
    </div>
  );
}
