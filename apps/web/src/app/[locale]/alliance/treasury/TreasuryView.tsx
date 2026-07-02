'use client';

/**
 * TreasuryView — Main client component for the Alliance Treasury page.
 *
 * Displays pool statistics, funded outlets, and distribution history.
 * This is a public page - no wallet connection required.
 */

import type { ReactElement } from 'react';
import { useState, useEffect, useMemo } from 'react';
import type { PoolState, PoolStats, OutletAllocation, DistributionEvent } from '@cocuyo/types';
import { ZERO_PUSD } from '@cocuyo/types';
import { crowdstackingService } from '@/lib/services/crowdstacking-service';
import { outletRegistryService } from '@/lib/services/outlet-registry-service';
import { TVLCard } from './components/TVLCard';
import { OutletAllocationCard } from './components/OutletAllocationCard';
import { DistributionHistoryTable } from './components/DistributionHistoryTable';
import { TierBreakdownCard } from './components/TierBreakdownCard';

interface TreasuryViewTranslations {
  tvl: string;
  contributors: string;
  sharePrice: string;
  // Outlets
  outletsTitle: string;
  outletsDescription: string;
  outletWeight: string;
  outletDistributed: string;
  noOutlets: string;
  // Distributions
  distributionsTitle: string;
  distributionsDescription: string;
  distributionAmount: string;
  distributionDate: string;
  noDistributions: string;
  // Tiers
  tiersTitle: string;
  tierSpark: string;
  tierFlame: string;
  tierBeacon: string;
  tierLighthouse: string;
}

export interface TreasuryViewProps {
  translations: TreasuryViewTranslations;
}

interface TreasuryState {
  poolState: PoolState | null;
  stats: PoolStats | null;
  outlets: readonly OutletAllocation[];
  distributions: readonly DistributionEvent[];
  loading: boolean;
  error: boolean;
}

export function TreasuryView({ translations: t }: TreasuryViewProps): ReactElement {
  const [state, setState] = useState<TreasuryState>({
    poolState: null,
    stats: null,
    outlets: [],
    distributions: [],
    loading: true,
    error: false,
  });

  // Load treasury data
  useEffect(() => {
    let isActive = true;

    const loadData = async (): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true, error: false }));

      try {
        const [poolState, stats, outlets, distributionsResult] = await Promise.all([
          crowdstackingService.getPoolState(),
          crowdstackingService.getPoolStats(),
          outletRegistryService.getActiveOutlets(),
          outletRegistryService.getDistributionHistory({ limit: 10, offset: 0 }),
        ]);

        if (!isActive) return;

        setState({
          poolState,
          stats,
          outlets,
          distributions: distributionsResult.items,
          loading: false,
          error: false,
        });
      } catch {
        if (isActive) {
          setState((prev) => ({ ...prev, loading: false, error: true }));
        }
      }
    };

    void loadData();

    return () => {
      isActive = false;
    };
  }, []);

  // Format share price for display
  const formattedSharePrice = useMemo(() => {
    if (!state.poolState) return '1.00';
    // Share price is in 18 decimals
    return (Number(state.poolState.sharePrice) / 1e18).toFixed(6);
  }, [state.poolState]);

  if (state.loading) {
    return (
      <div className="py-16 text-center">
        <div className="text-[var(--fg-tertiary)]">Loading...</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="py-16 text-center">
        <div className="text-[var(--fg-error)]">Failed to load treasury data</div>
      </div>
    );
  }

  const { stats, outlets, distributions } = state;

  return (
    <div className="space-y-8">
      {/* Top stats */}
      <div className="grid gap-6 sm:grid-cols-3">
        <TVLCard value={stats?.tvl ?? ZERO_PUSD} label={t.tvl} />
        <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6 text-center">
          <p className="mb-2 text-sm text-[var(--fg-tertiary)]">{t.contributors}</p>
          <p className="font-display text-3xl font-medium text-[var(--fg-primary)]">
            {stats?.activeContributors ?? 0}
          </p>
        </div>
        <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6 text-center">
          <p className="mb-2 text-sm text-[var(--fg-tertiary)]">{t.sharePrice}</p>
          <p className="font-mono text-2xl font-medium text-[var(--fg-primary)]">
            {formattedSharePrice}
          </p>
        </div>
      </div>

      {/* Contributor tier breakdown */}
      {stats && (
        <TierBreakdownCard
          contributorsByTier={stats.contributorsByTier}
          translations={{
            title: t.tiersTitle,
            spark: t.tierSpark,
            flame: t.tierFlame,
            beacon: t.tierBeacon,
            lighthouse: t.tierLighthouse,
          }}
        />
      )}

      {/* Funded outlets */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-medium text-[var(--fg-primary)]">{t.outletsTitle}</h2>
          <p className="text-sm text-[var(--fg-secondary)]">{t.outletsDescription}</p>
        </div>

        {outlets.length === 0 ? (
          <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-8 text-center">
            <p className="text-[var(--fg-tertiary)]">{t.noOutlets}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {outlets.map((outlet) => (
              <OutletAllocationCard
                key={outlet.outletId}
                outlet={outlet}
                translations={{
                  weight: t.outletWeight,
                  distributed: t.outletDistributed,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Distribution history */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-medium text-[var(--fg-primary)]">{t.distributionsTitle}</h2>
          <p className="text-sm text-[var(--fg-secondary)]">{t.distributionsDescription}</p>
        </div>

        {distributions.length === 0 ? (
          <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-8 text-center">
            <p className="text-[var(--fg-tertiary)]">{t.noDistributions}</p>
          </div>
        ) : (
          <DistributionHistoryTable
            distributions={distributions}
            translations={{
              amount: t.distributionAmount,
              date: t.distributionDate,
            }}
          />
        )}
      </div>
    </div>
  );
}
