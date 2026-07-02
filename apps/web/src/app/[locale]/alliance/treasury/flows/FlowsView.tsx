'use client';

/**
 * FlowsView — Client component for the distribution history page.
 *
 * Displays the full history of yield distributions to funded outlets.
 */

import type { ReactElement } from 'react';
import { useState, useEffect } from 'react';
import type { DistributionEvent } from '@cocuyo/types';
import { outletRegistryService } from '@/lib/services/outlet-registry-service';
import { DistributionHistoryTable } from '../components/DistributionHistoryTable';

interface FlowsViewTranslations {
  amount: string;
  date: string;
  noDistributions: string;
}

export interface FlowsViewProps {
  translations: FlowsViewTranslations;
}

export function FlowsView({ translations: t }: FlowsViewProps): ReactElement {
  const [distributions, setDistributions] = useState<readonly DistributionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Load distribution history
  useEffect(() => {
    let isActive = true;

    const loadData = async (): Promise<void> => {
      try {
        const result = await outletRegistryService.getDistributionHistory({
          limit: 50,
          offset: 0,
        });
        if (isActive) setDistributions(result.items);
      } catch {
        if (isActive) setDistributions([]);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    void loadData();

    return () => {
      isActive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="text-[var(--fg-tertiary)]">Loading...</div>
      </div>
    );
  }

  if (distributions.length === 0) {
    return (
      <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-16 text-center">
        <p className="text-[var(--fg-tertiary)]">{t.noDistributions}</p>
      </div>
    );
  }

  // Calculate summary stats
  const totalDistributed = distributions.reduce((sum, d) => sum + Number(d.totalAmount), 0);
  const formattedTotal = (totalDistributed / 1e6).toFixed(2);

  // Count unique outlets
  const uniqueOutlets = new Set<string>();
  for (const dist of distributions) {
    for (const d of dist.distributions) {
      uniqueOutlets.add(d.outletId);
    }
  }

  return (
    <div>
      {/* Summary stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4">
          <div className="text-sm text-[var(--fg-tertiary)]">Total Distributions</div>
          <div className="font-display text-2xl font-medium text-[var(--fg-primary)]">
            {distributions.length}
          </div>
        </div>
        <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4">
          <div className="text-sm text-[var(--fg-tertiary)]">Unique Outlets</div>
          <div className="font-display text-2xl font-medium text-[var(--fg-primary)]">
            {uniqueOutlets.size}
          </div>
        </div>
        <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4">
          <div className="text-sm text-[var(--fg-tertiary)]">{t.amount}</div>
          <div className="font-display text-2xl font-medium text-[var(--fg-success)]">
            ${formattedTotal}
          </div>
        </div>
      </div>

      {/* Distribution table */}
      <DistributionHistoryTable
        distributions={distributions}
        translations={{
          amount: t.amount,
          date: t.date,
        }}
      />
    </div>
  );
}
