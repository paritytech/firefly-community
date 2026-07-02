'use client';

/**
 * WithdrawalsView — Client component for the withdrawals page.
 *
 * Displays all withdrawal requests with filtering by status.
 */

import type { ReactElement } from 'react';
import { useState, useEffect, useCallback } from 'react';
import type { WithdrawalRequest, WithdrawalRequestStatus } from '@cocuyo/types';
import { createPolkadotAddress, createWithdrawalRequestId } from '@cocuyo/types';
import { useSigner } from '@/hooks';
import { EmptyState } from '@cocuyo/ui';
import { crowdstackingService } from '@/lib/services/crowdstacking-service';
import { WithdrawalRequestCard } from '../components/WithdrawalRequestCard';

interface WithdrawalsViewTranslations {
  allWithdrawals: string;
  pending: string;
  completed: string;
  cancelled: string;
  noWithdrawals: string;
  signInRequired: string;
  signInDescription: string;
  // Card translations
  status: string;
  shares: string;
  requestedAt: string;
  availableAt: string;
  complete: string;
  cancel: string;
  ready: string;
}

export interface WithdrawalsViewProps {
  translations: WithdrawalsViewTranslations;
}

type FilterStatus = 'all' | WithdrawalRequestStatus;

export function WithdrawalsView({ translations: t }: WithdrawalsViewProps): ReactElement {
  const { isConnected, selectedAccount } = useSigner();

  const [withdrawals, setWithdrawals] = useState<readonly WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [reloadKey, setReloadKey] = useState(0);

  const triggerReload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Load withdrawal requests
  useEffect(() => {
    let isActive = true;

    const loadData = async (): Promise<void> => {
      if (!isConnected || selectedAccount?.address == null || selectedAccount.address === '') {
        if (isActive) {
          setWithdrawals([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        const address = createPolkadotAddress(selectedAccount.address);
        const data = await crowdstackingService.getWithdrawalRequests(address);

        if (!isActive) return;
        setWithdrawals(data);
      } catch {
        // Silently fail - empty list will show
        if (isActive) setWithdrawals([]);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    void loadData();

    return () => {
      isActive = false;
    };
  }, [isConnected, selectedAccount?.address, reloadKey]);

  // Handle withdrawal completion
  const handleComplete = useCallback(
    async (requestId: string): Promise<void> => {
      const result = await crowdstackingService.completeWithdrawal(
        createWithdrawalRequestId(requestId)
      );
      if (result.ok) {
        triggerReload();
      }
    },
    [triggerReload]
  );

  // Handle withdrawal cancellation
  const handleCancel = useCallback(
    async (requestId: string): Promise<void> => {
      const result = await crowdstackingService.cancelWithdrawal(
        createWithdrawalRequestId(requestId)
      );
      if (result.ok) {
        triggerReload();
      }
    },
    [triggerReload]
  );

  // Filter withdrawals by status
  const filteredWithdrawals =
    filter === 'all' ? withdrawals : withdrawals.filter((w) => w.status === filter);

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

  // Status filter tabs
  const filterOptions: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: t.allWithdrawals },
    { key: 'pending', label: t.pending },
    { key: 'completed', label: t.completed },
    { key: 'cancelled', label: t.cancelled },
  ];

  return (
    <div>
      {/* Filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-[var(--border-default)] pb-4">
        {filterOptions.map((option) => (
          <button
            key={option.key}
            onClick={() => setFilter(option.key)}
            className={`rounded-nested px-4 py-2 text-sm font-medium transition-colors ${
              filter === option.key
                ? 'bg-[var(--color-firefly-gold)] text-black'
                : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-surface-container)] hover:text-[var(--fg-primary)]'
            }`}
          >
            {option.label}
            {option.key !== 'all' && (
              <span className="ml-2 text-xs opacity-70">
                ({withdrawals.filter((w) => w.status === option.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Withdrawals list */}
      {filteredWithdrawals.length === 0 ? (
        <div className="py-16">
          <EmptyState title={t.noWithdrawals} description="" />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWithdrawals.map((withdrawal) => (
            <WithdrawalRequestCard
              key={withdrawal.id}
              withdrawal={withdrawal}
              translations={{
                status: t.status,
                shares: t.shares,
                requestedAt: t.requestedAt,
                availableAt: t.availableAt,
                complete: t.complete,
                cancel: t.cancel,
                ready: t.ready,
              }}
              onComplete={handleComplete}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
