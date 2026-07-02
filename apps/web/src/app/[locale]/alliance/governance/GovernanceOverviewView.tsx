'use client';

/**
 * GovernanceOverviewView — Main client component for governance overview.
 *
 * Shows active proposals, user voting power, and recently finalized proposals.
 */

import type { ReactElement } from 'react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type {
  AllianceProposalPreview,
  AllianceProposalType,
  AllianceProposalStatus,
} from '@cocuyo/types';
import { createPolkadotAddress, createPoolId } from '@cocuyo/types';
import { useSigner } from '@/hooks';
import { EmptyState } from '@cocuyo/ui';
import { getAllianceGovernanceService } from '@/lib/services/alliance-governance-service';
import { crowdstackingService } from '@/lib/services/crowdstacking-service';
import { ProposalCard } from './components/ProposalCard';

interface GovernanceOverviewViewTranslations {
  // Overview
  activeProposals: string;
  yourVotingPower: string;
  noActiveProposals: string;
  recentlyFinalized: string;
  viewAll: string;
  // Proposals
  createProposal: string;
  // Types
  typeOutletAdd: string;
  typeOutletRemove: string;
  typeWeightChange: string;
  typeParameterChange: string;
  typeEmergency: string;
  // Status
  statusVoting: string;
  statusApproved: string;
  statusRejected: string;
  statusExpired: string;
  statusExecuted: string;
  // Proposal card
  votingEnds: string;
  quorumProgress: string;
  // Errors
  signInRequired: string;
  tierRequired: string;
}

export interface GovernanceOverviewViewProps {
  translations: GovernanceOverviewViewTranslations;
}

interface OverviewState {
  activeProposals: readonly AllianceProposalPreview[];
  recentProposals: readonly AllianceProposalPreview[];
  votingPower: number;
  canCreate: boolean;
  loading: boolean;
  error: boolean;
}

// Default pool ID for the Alliance
const DEFAULT_POOL_ID = createPoolId('alliance-main');

export function GovernanceOverviewView({
  translations: t,
}: GovernanceOverviewViewProps): ReactElement {
  const { isConnected, selectedAccount } = useSigner();

  const [state, setState] = useState<OverviewState>({
    activeProposals: [],
    recentProposals: [],
    votingPower: 0,
    canCreate: false,
    loading: true,
    error: false,
  });

  // Get type display name
  const getTypeName = useCallback(
    (type: AllianceProposalType): string => {
      switch (type) {
        case 'outlet-add':
          return t.typeOutletAdd;
        case 'outlet-remove':
          return t.typeOutletRemove;
        case 'weight-change':
          return t.typeWeightChange;
        case 'parameter-change':
          return t.typeParameterChange;
        case 'emergency':
          return t.typeEmergency;
      }
    },
    [t]
  );

  // Get status display name
  const getStatusName = useCallback(
    (status: AllianceProposalStatus): string => {
      switch (status) {
        case 'voting':
          return t.statusVoting;
        case 'approved':
          return t.statusApproved;
        case 'rejected':
          return t.statusRejected;
        case 'expired':
          return t.statusExpired;
        case 'executed':
          return t.statusExecuted;
      }
    },
    [t]
  );

  // Load governance data
  useEffect(() => {
    let isActive = true;

    const loadData = async (): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true, error: false }));

      try {
        // Load active proposals
        const governance = getAllianceGovernanceService();
        const activeProposals = await governance.getActiveProposals(DEFAULT_POOL_ID);

        // Load recent finalized proposals
        const recentResult = await governance.getProposalsForPool({
          poolId: DEFAULT_POOL_ID,
          status: 'approved',
          pagination: { offset: 0, limit: 3 },
        });

        // Get user voting power and create permission if connected
        let votingPower = 0;
        let canCreate = false;

        if (isConnected && selectedAccount?.address != null && selectedAccount.address !== '') {
          const address = createPolkadotAddress(selectedAccount.address);
          canCreate = await governance.canCreateProposal(address, DEFAULT_POOL_ID);

          // Get position to calculate voting power
          const position = await crowdstackingService.getPosition(address);
          if (position) {
            // Voting power is based on shares (simplified)
            votingPower = Number(position.shares);
          }
        }

        if (!isActive) return;

        setState({
          activeProposals,
          recentProposals: recentResult.items,
          votingPower,
          canCreate,
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
  }, [isConnected, selectedAccount?.address]);

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
        <div className="text-[var(--fg-error)]">Failed to load governance data</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Active Proposals Count */}
        <div className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] p-6">
          <div className="text-sm text-[var(--fg-tertiary)]">{t.activeProposals}</div>
          <div className="mt-2 font-display text-3xl font-medium text-[var(--fg-primary)]">
            {state.activeProposals.length}
          </div>
        </div>

        {/* Your Voting Power */}
        <div className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] p-6">
          <div className="text-sm text-[var(--fg-tertiary)]">{t.yourVotingPower}</div>
          <div className="mt-2 font-display text-3xl font-medium text-[var(--fg-primary)]">
            {isConnected ? state.votingPower.toLocaleString() : '—'}
          </div>
          {!isConnected && (
            <div className="mt-2 text-xs text-[var(--fg-tertiary)]">{t.signInRequired}</div>
          )}
        </div>

        {/* Create Proposal CTA */}
        <div className="flex items-center justify-center rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] p-6">
          {state.canCreate ? (
            <Link
              href="/alliance/governance/proposals/new"
              className="flex items-center gap-2 rounded-nested bg-[var(--color-firefly-gold)] px-6 py-3 font-medium text-black transition-opacity hover:opacity-90"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {t.createProposal}
            </Link>
          ) : (
            <div className="text-center text-sm text-[var(--fg-tertiary)]">
              {!isConnected ? t.signInRequired : t.tierRequired}
            </div>
          )}
        </div>
      </div>

      {/* Active Proposals */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-[var(--fg-primary)]">{t.activeProposals}</h2>
          <Link
            href="/alliance/governance/proposals"
            className="text-sm text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
          >
            {t.viewAll}
          </Link>
        </div>

        {state.activeProposals.length > 0 ? (
          <div className="space-y-4">
            {state.activeProposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                typeName={getTypeName(proposal.proposalType)}
                statusName={getStatusName(proposal.status)}
                translations={{
                  votingEnds: t.votingEnds,
                  quorumProgress: t.quorumProgress,
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState title={t.noActiveProposals} />
        )}
      </div>

      {/* Recently Finalized */}
      {state.recentProposals.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-[var(--fg-primary)]">{t.recentlyFinalized}</h2>
            <Link
              href="/alliance/governance/proposals?status=approved"
              className="text-sm text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
            >
              {t.viewAll}
            </Link>
          </div>

          <div className="space-y-4">
            {state.recentProposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                typeName={getTypeName(proposal.proposalType)}
                statusName={getStatusName(proposal.status)}
                translations={{
                  votingEnds: t.votingEnds,
                  quorumProgress: t.quorumProgress,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
