'use client';

/**
 * DashboardView — Main client component for the contributor dashboard.
 *
 * Shows position details, withdrawal requests, and pool statistics.
 * Requires wallet connection to view.
 */

import type { ReactElement } from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Newspaper, Vote, UserPlus, ShieldCheck } from 'lucide-react';
import type {
  ContributorPosition,
  ContributorTier,
  WithdrawalRequest,
  PoolStats,
} from '@cocuyo/types';
import { createPolkadotAddress, createWithdrawalRequestId } from '@cocuyo/types';
import { useSigner } from '@/hooks';
import { EmptyState } from '@cocuyo/ui';
import { crowdstackingService } from '@/lib/services/crowdstacking-service';
import { FeatureCard } from '@/components/FeatureCard';
import { PositionCard } from './components/PositionCard';
import { WithdrawalRequestCard } from './components/WithdrawalRequestCard';
import { PoolStatsCard } from './components/PoolStatsCard';
import { WithdrawSheet } from './components/WithdrawSheet';

interface FeatureCardTranslations {
  title: string;
  description: string;
}

interface DashboardViewTranslations {
  signInRequired: string;
  signInDescription: string;
  // Feature cards
  featureCards: {
    newsroom: FeatureCardTranslations;
    alliance: FeatureCardTranslations;
    join: FeatureCardTranslations;
    verify: FeatureCardTranslations;
  };
  // Position
  positionTitle: string;
  positionShares: string;
  positionValue: string;
  positionContributed: string;
  positionTier: string;
  // Actions
  contributeMore: string;
  requestWithdraw: string;
  // Withdrawals
  withdrawalsTitle: string;
  noWithdrawals: string;
  withdrawalStatus: string;
  withdrawalShares: string;
  withdrawalRequestedAt: string;
  withdrawalAvailableAt: string;
  withdrawalComplete: string;
  withdrawalCancel: string;
  withdrawalReady: string;
  // Stats
  statsTitle: string;
  statsTvl: string;
  statsContributors: string;
  statsOutlets: string;
  statsDistributed: string;
  // Withdraw modal
  withdrawTitle: string;
  withdrawDescription: string;
  withdrawSharesLabel: string;
  withdrawEstimatedValue: string;
  withdrawCooldownNote: string;
  withdrawSubmit: string;
  withdrawSubmitting: string;
  withdrawCancel: string;
  // Tiers
  tierNone: string;
  tierSpark: string;
  tierFlame: string;
  tierBeacon: string;
  tierLighthouse: string;
}

export interface DashboardViewProps {
  translations: DashboardViewTranslations;
}

interface DashboardState {
  position: ContributorPosition | null;
  withdrawals: readonly WithdrawalRequest[];
  stats: PoolStats | null;
  loading: boolean;
  error: boolean;
}

export function DashboardView({ translations: t }: DashboardViewProps): ReactElement {
  const { isConnected, selectedAccount } = useSigner();

  const [state, setState] = useState<DashboardState>({
    position: null,
    withdrawals: [],
    stats: null,
    loading: true,
    error: false,
  });

  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const triggerReload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Get tier display name
  const getTierName = useCallback(
    (tier: ContributorTier): string => {
      switch (tier) {
        case 'spark':
          return t.tierSpark;
        case 'flame':
          return t.tierFlame;
        case 'beacon':
          return t.tierBeacon;
        case 'lighthouse':
          return t.tierLighthouse;
        default:
          return t.tierNone;
      }
    },
    [t]
  );

  // Load dashboard data
  useEffect(() => {
    let isActive = true;

    const loadData = async (): Promise<void> => {
      if (!isConnected || selectedAccount?.address == null || selectedAccount.address === '') {
        if (isActive) {
          setState({
            position: null,
            withdrawals: [],
            stats: null,
            loading: false,
            error: false,
          });
        }
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: false }));

      try {
        const address = createPolkadotAddress(selectedAccount.address);

        const [position, withdrawals, stats] = await Promise.all([
          crowdstackingService.getPosition(address),
          crowdstackingService.getWithdrawalRequests(address),
          crowdstackingService.getPoolStats(),
        ]);

        if (!isActive) return;

        setState({
          position,
          withdrawals,
          stats,
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
  }, [isConnected, selectedAccount?.address, reloadKey]);

  // Calculate current value of shares
  const currentValue = useMemo(() => {
    if (!state.position || !state.stats) return 0n;
    // Simple calculation: shares * (totalAssets / totalShares)
    // In reality this would use the pool state's share price
    return state.position.shares; // Simplified for demo
  }, [state.position, state.stats]);

  // Handle withdrawal completion
  const handleCompleteWithdrawal = useCallback(
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
  const handleCancelWithdrawal = useCallback(
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

  // Handle new withdrawal request
  const handleWithdrawSubmit = useCallback(
    async (shares: bigint): Promise<void> => {
      const result = await crowdstackingService.requestWithdrawal(shares);
      if (result.ok) {
        setIsWithdrawOpen(false);
        triggerReload();
      }
    },
    [triggerReload]
  );

  // Access gate for non-connected users
  if (!isConnected) {
    return (
      <div className="py-16">
        <EmptyState title={t.signInRequired} description={t.signInDescription} />
      </div>
    );
  }

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
        <div className="mb-4 text-[var(--fg-error)]">Failed to load dashboard</div>
        <button
          onClick={triggerReload}
          className="rounded-nested border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--fg-primary)] transition-colors hover:border-[var(--border-emphasis)] hover:bg-[var(--bg-surface-container)]"
        >
          Try Again
        </button>
      </div>
    );
  }

  // No position yet - show empty state with CTA
  if (!state.position) {
    return (
      <div className="py-16">
        <EmptyState
          title="No Position Yet"
          description="Join the Alliance to start contributing to independent journalism."
        />
        <div className="mt-8 text-center">
          <Link
            href="/join"
            className="inline-block rounded-nested bg-[var(--color-firefly-gold)] px-6 py-3 font-medium text-black transition-opacity hover:opacity-90"
          >
            Join the Alliance
          </Link>
        </div>
      </div>
    );
  }

  const { position, withdrawals, stats } = state;
  const pendingWithdrawals = withdrawals.filter((w) => w.status === 'pending');

  // Feature cards configuration
  const featureCards = [
    {
      title: t.featureCards.newsroom.title,
      description: t.featureCards.newsroom.description,
      href: '/newsroom',
      icon: Newspaper,
    },
    {
      title: t.featureCards.alliance.title,
      description: t.featureCards.alliance.description,
      href: '/alliance',
      icon: Vote,
    },
    {
      title: t.featureCards.join.title,
      description: t.featureCards.join.description,
      href: '/join',
      icon: UserPlus,
    },
    {
      title: t.featureCards.verify.title,
      description: t.featureCards.verify.description,
      href: '/verify',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {featureCards.map((card) => (
          <FeatureCard
            key={card.href}
            title={card.title}
            description={card.description}
            href={card.href}
            icon={card.icon}
            LinkComponent={Link}
          />
        ))}
      </div>

      {/* Position and Actions */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Position Card */}
        <div className="flex-1">
          <PositionCard
            position={position}
            currentValue={currentValue}
            translations={{
              title: t.positionTitle,
              shares: t.positionShares,
              value: t.positionValue,
              contributed: t.positionContributed,
              tier: t.positionTier,
            }}
            tierName={getTierName(position.tier)}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 lg:w-64">
          <Link
            href="/join"
            className="hover:bg-[var(--color-firefly-gold)]/10 flex items-center justify-center gap-2 rounded-nested border border-[var(--color-firefly-gold)] px-4 py-3 font-medium text-[var(--color-firefly-gold)] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t.contributeMore}
          </Link>
          {position.shares > 0n && (
            <button
              onClick={() => setIsWithdrawOpen(true)}
              className="flex items-center justify-center gap-2 rounded-nested border border-[var(--border-default)] px-4 py-3 text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-emphasis)] hover:text-[var(--fg-primary)]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              {t.requestWithdraw}
            </button>
          )}
        </div>
      </div>

      {/* Pending Withdrawals */}
      {pendingWithdrawals.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-medium text-[var(--fg-primary)]">
            {t.withdrawalsTitle}
          </h2>
          <div className="space-y-3">
            {pendingWithdrawals.map((withdrawal) => (
              <WithdrawalRequestCard
                key={withdrawal.id}
                withdrawal={withdrawal}
                translations={{
                  status: t.withdrawalStatus,
                  shares: t.withdrawalShares,
                  requestedAt: t.withdrawalRequestedAt,
                  availableAt: t.withdrawalAvailableAt,
                  complete: t.withdrawalComplete,
                  cancel: t.withdrawalCancel,
                  ready: t.withdrawalReady,
                }}
                onComplete={handleCompleteWithdrawal}
                onCancel={handleCancelWithdrawal}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pool Stats */}
      {stats && (
        <PoolStatsCard
          stats={stats}
          translations={{
            title: t.statsTitle,
            tvl: t.statsTvl,
            contributors: t.statsContributors,
            outlets: t.statsOutlets,
            distributed: t.statsDistributed,
          }}
        />
      )}

      {/* Withdraw Sheet */}
      <WithdrawSheet
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        availableShares={position.shares}
        translations={{
          title: t.withdrawTitle,
          description: t.withdrawDescription,
          sharesLabel: t.withdrawSharesLabel,
          estimatedValue: t.withdrawEstimatedValue,
          cooldownNote: t.withdrawCooldownNote,
          submit: t.withdrawSubmit,
          submitting: t.withdrawSubmitting,
          cancel: t.withdrawCancel,
        }}
        onSubmit={handleWithdrawSubmit}
      />
    </div>
  );
}
