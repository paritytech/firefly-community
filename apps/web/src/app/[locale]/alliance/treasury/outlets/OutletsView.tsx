'use client';

/**
 * OutletsView — Client component for the outlets page.
 *
 * Displays a detailed grid of all funded outlets.
 */

import type { ReactElement } from 'react';
import { useState, useEffect } from 'react';
import type { OutletAllocation } from '@cocuyo/types';
import { outletRegistryService } from '@/lib/services/outlet-registry-service';
import { OutletAllocationCard } from '../components/OutletAllocationCard';

interface OutletsViewTranslations {
  weight: string;
  distributed: string;
  noOutlets: string;
}

export interface OutletsViewProps {
  translations: OutletsViewTranslations;
}

export function OutletsView({ translations: t }: OutletsViewProps): ReactElement {
  const [outlets, setOutlets] = useState<readonly OutletAllocation[]>([]);
  const [loading, setLoading] = useState(true);

  // Load outlets
  useEffect(() => {
    let isActive = true;

    const loadData = async (): Promise<void> => {
      try {
        const data = await outletRegistryService.getOutlets();
        if (isActive) setOutlets(data);
      } catch {
        if (isActive) setOutlets([]);
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

  if (outlets.length === 0) {
    return (
      <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-16 text-center">
        <p className="text-[var(--fg-tertiary)]">{t.noOutlets}</p>
      </div>
    );
  }

  // Separate active and inactive outlets
  const activeOutlets = outlets.filter((o) => o.isActive);
  const inactiveOutlets = outlets.filter((o) => !o.isActive);

  // Calculate total distributed
  const totalDistributed = outlets.reduce((sum, o) => sum + Number(o.totalDistributed), 0);
  const formattedTotal = (totalDistributed / 1e6).toFixed(2);

  return (
    <div>
      {/* Summary stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4">
          <div className="text-sm text-[var(--fg-tertiary)]">Active Outlets</div>
          <div className="font-display text-2xl font-medium text-[var(--fg-primary)]">
            {activeOutlets.length}
          </div>
        </div>
        <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4">
          <div className="text-sm text-[var(--fg-tertiary)]">Total Outlets</div>
          <div className="font-display text-2xl font-medium text-[var(--fg-primary)]">
            {outlets.length}
          </div>
        </div>
        <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4">
          <div className="text-sm text-[var(--fg-tertiary)]">{t.distributed}</div>
          <div className="font-display text-2xl font-medium text-[var(--fg-success)]">
            ${formattedTotal}
          </div>
        </div>
      </div>

      {/* Active outlets */}
      {activeOutlets.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-medium text-[var(--fg-primary)]">
            Active Outlets ({activeOutlets.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeOutlets.map((outlet) => (
              <OutletAllocationCard
                key={outlet.outletId}
                outlet={outlet}
                translations={{
                  weight: t.weight,
                  distributed: t.distributed,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inactive outlets */}
      {inactiveOutlets.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-medium text-[var(--fg-tertiary)]">
            Inactive Outlets ({inactiveOutlets.length})
          </h2>
          <div className="grid gap-4 opacity-50 sm:grid-cols-2 lg:grid-cols-3">
            {inactiveOutlets.map((outlet) => (
              <OutletAllocationCard
                key={outlet.outletId}
                outlet={outlet}
                translations={{
                  weight: t.weight,
                  distributed: t.distributed,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
