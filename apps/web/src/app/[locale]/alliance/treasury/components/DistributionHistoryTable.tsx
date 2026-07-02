'use client';

/**
 * DistributionHistoryTable — Displays recent yield distributions.
 */

import type { ReactElement } from 'react';
import type { DistributionEvent } from '@cocuyo/types';

interface DistributionHistoryTableTranslations {
  amount: string;
  date: string;
}

export interface DistributionHistoryTableProps {
  distributions: readonly DistributionEvent[];
  translations: DistributionHistoryTableTranslations;
}

export function DistributionHistoryTable({
  distributions,
  translations: t,
}: DistributionHistoryTableProps): ReactElement {
  return (
    <div className="overflow-hidden rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)]">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-container)]">
            <th className="px-4 py-3 text-left text-sm font-medium text-[var(--fg-tertiary)]">
              Outlet
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-[var(--fg-tertiary)]">
              {t.amount}
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-[var(--fg-tertiary)]">
              {t.date}
            </th>
          </tr>
        </thead>
        <tbody>
          {distributions.map((dist, index) => {
            // Format total amount (pUSD has 6 decimals)
            const formattedAmount = (Number(dist.totalAmount) / 1e6).toFixed(2);

            // Format date
            const date = new Date(dist.distributedAt);
            const formattedDate = date.toLocaleDateString();

            // Get first outlet or pool ID as display name
            const [firstDistribution] = dist.distributions;
            const displayName =
              firstDistribution !== undefined ? firstDistribution.outletId : dist.poolId;

            return (
              <tr
                key={`${dist.txHash}-${index}`}
                className="border-b border-[var(--border-subtle)] last:border-0"
              >
                <td className="px-4 py-3 text-sm text-[var(--fg-primary)]">
                  {dist.distributions.length > 1
                    ? `${dist.distributions.length} outlets`
                    : displayName}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-[var(--fg-success)]">
                  +${formattedAmount}
                </td>
                <td className="px-4 py-3 text-right text-sm text-[var(--fg-tertiary)]">
                  {formattedDate}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
