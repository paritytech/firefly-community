'use client';

/**
 * HistoryView — Client component for the history page.
 *
 * Displays contribution and withdrawal history in a chronological table.
 */

import type { ReactElement } from 'react';
import { useState, useEffect } from 'react';
import type { WithdrawalRequest } from '@cocuyo/types';
import { createPolkadotAddress } from '@cocuyo/types';
import { useSigner } from '@/hooks';
import { EmptyState } from '@cocuyo/ui';
import { crowdstackingService } from '@/lib/services/crowdstacking-service';
import {
  ContributionHistoryTable,
  type HistoryEntry,
} from '../components/ContributionHistoryTable';

interface HistoryViewTranslations {
  type: string;
  amount: string;
  shares: string;
  date: string;
  txHash: string;
  contribution: string;
  withdrawal: string;
  noHistory: string;
  signInRequired: string;
  signInDescription: string;
}

export interface HistoryViewProps {
  translations: HistoryViewTranslations;
}

export function HistoryView({ translations: t }: HistoryViewProps): ReactElement {
  const { isConnected, selectedAccount } = useSigner();

  const [entries, setEntries] = useState<readonly HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Load history data
  useEffect(() => {
    let isActive = true;

    const loadData = async (): Promise<void> => {
      if (!isConnected || selectedAccount?.address == null || selectedAccount.address === '') {
        if (isActive) {
          setEntries([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        const address = createPolkadotAddress(selectedAccount.address);
        const [position, withdrawals] = await Promise.all([
          crowdstackingService.getPosition(address),
          crowdstackingService.getWithdrawalRequests(address),
        ]);

        if (!isActive) return;

        // Build history entries from available data
        const historyEntries: HistoryEntry[] = [];

        // Add initial contribution if position exists
        if (position) {
          historyEntries.push({
            id: `contribution-initial-${position.contributor}`,
            type: 'contribution',
            amount: position.cumulativeContributed,
            shares: position.shares,
            txHash: '0x' + '0'.repeat(64), // Placeholder - would come from real tx history
            timestamp: position.createdAt,
          });
        }

        // Add completed withdrawals
        const completedWithdrawals = withdrawals.filter(
          (w: WithdrawalRequest) => w.status === 'completed' && w.amountReceived !== undefined
        );
        for (const withdrawal of completedWithdrawals) {
          if (withdrawal.amountReceived !== undefined) {
            historyEntries.push({
              id: `withdrawal-${withdrawal.id}`,
              type: 'withdrawal',
              amount: withdrawal.amountReceived,
              shares: withdrawal.shares,
              txHash: '0x' + withdrawal.id.slice(0, 62), // Placeholder
              timestamp: withdrawal.completedAt ?? withdrawal.requestedAt,
            });
          }
        }

        // Sort by timestamp descending (newest first)
        historyEntries.sort((a, b) => b.timestamp - a.timestamp);

        setEntries(historyEntries);
      } catch {
        // Silently fail - empty list will show
        if (isActive) setEntries([]);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    void loadData();

    return () => {
      isActive = false;
    };
  }, [isConnected, selectedAccount?.address]);

  // Access gate for non-connected users
  if (!isConnected) {
    return (
      <div className="py-16">
        <EmptyState title={t.signInRequired} description={t.signInDescription} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="text-[var(--fg-tertiary)]">Loading...</div>
      </div>
    );
  }

  return (
    <ContributionHistoryTable
      entries={entries}
      translations={{
        type: t.type,
        amount: t.amount,
        shares: t.shares,
        date: t.date,
        txHash: t.txHash,
        contribution: t.contribution,
        withdrawal: t.withdrawal,
        noHistory: t.noHistory,
      }}
    />
  );
}
