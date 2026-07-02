'use client';

/**
 * ProposalListView — Filterable list of all governance proposals.
 */

import type { ReactElement } from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { ProposalCard } from '../components/ProposalCard';

interface ProposalListViewTranslations {
  // Create
  createProposal: string;
  // Filters
  filterByType: string;
  filterByStatus: string;
  searchPlaceholder: string;
  clearFilters: string;
  // Results
  noProposals: string;
  proposalWord: string;
  proposalsWord: string;
  ofWord: string;
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
  // Permissions
  signInRequired: string;
  tierRequired: string;
}

export interface ProposalListViewProps {
  translations: ProposalListViewTranslations;
}

interface ListState {
  proposals: readonly AllianceProposalPreview[];
  total: number;
  canCreate: boolean;
  loading: boolean;
  error: boolean;
}

const PROPOSAL_TYPES: AllianceProposalType[] = [
  'outlet-add',
  'outlet-remove',
  'weight-change',
  'parameter-change',
  'emergency',
];

const PROPOSAL_STATUSES: AllianceProposalStatus[] = [
  'voting',
  'approved',
  'rejected',
  'expired',
  'executed',
];

const DEFAULT_POOL_ID = createPoolId('alliance-main');

export function ProposalListView({ translations: t }: ProposalListViewProps): ReactElement {
  const { isConnected, selectedAccount } = useSigner();

  const [state, setState] = useState<ListState>({
    proposals: [],
    total: 0,
    canCreate: false,
    loading: true,
    error: false,
  });

  const [typeFilter, setTypeFilter] = useState<AllianceProposalType | null>(null);
  const [statusFilter, setStatusFilter] = useState<AllianceProposalStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Load proposals
  useEffect(() => {
    let isActive = true;

    const loadData = async (): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true, error: false }));

      try {
        const params: {
          poolId: typeof DEFAULT_POOL_ID;
          type?: AllianceProposalType;
          status?: AllianceProposalStatus;
          pagination: { offset: number; limit: number };
        } = {
          poolId: DEFAULT_POOL_ID,
          pagination: { offset: 0, limit: 50 },
        };

        if (typeFilter) {
          params.type = typeFilter;
        }
        if (statusFilter) {
          params.status = statusFilter;
        }

        const governance = getAllianceGovernanceService();
        const result = await governance.getProposalsForPool(params);

        let canCreate = false;
        if (isConnected && selectedAccount?.address != null && selectedAccount.address !== '') {
          const address = createPolkadotAddress(selectedAccount.address);
          canCreate = await governance.canCreateProposal(address, DEFAULT_POOL_ID);
        }

        if (!isActive) return;

        setState({
          proposals: result.items,
          total: result.total,
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
  }, [isConnected, selectedAccount?.address, typeFilter, statusFilter]);

  // Filter proposals by search query
  const filteredProposals = useMemo(() => {
    if (!searchQuery.trim()) {
      return state.proposals;
    }
    const query = searchQuery.toLowerCase();
    return state.proposals.filter((p) => p.title.toLowerCase().includes(query));
  }, [state.proposals, searchQuery]);

  const hasFilters = typeFilter !== null || statusFilter !== null || searchQuery.trim() !== '';

  const clearFilters = (): void => {
    setTypeFilter(null);
    setStatusFilter(null);
    setSearchQuery('');
  };

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
        <div className="text-[var(--fg-error)]">Failed to load proposals</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Type filter */}
          <select
            value={typeFilter ?? ''}
            onChange={(e) =>
              setTypeFilter(e.target.value === '' ? null : (e.target.value as AllianceProposalType))
            }
            className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:border-[var(--border-emphasis)] focus:outline-none"
          >
            <option value="">{t.filterByType}</option>
            {PROPOSAL_TYPES.map((type) => (
              <option key={type} value={type}>
                {getTypeName(type)}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter ?? ''}
            onChange={(e) =>
              setStatusFilter(
                e.target.value === '' ? null : (e.target.value as AllianceProposalStatus)
              )
            }
            className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:border-[var(--border-emphasis)] focus:outline-none"
          >
            <option value="">{t.filterByStatus}</option>
            {PROPOSAL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {getStatusName(status)}
              </option>
            ))}
          </select>

          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-48 rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-3 py-2 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] focus:border-[var(--border-emphasis)] focus:outline-none"
          />

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
            >
              {t.clearFilters}
            </button>
          )}
        </div>

        {/* Create button */}
        {state.canCreate && (
          <Link
            href="/alliance/governance/proposals/new"
            className="flex items-center gap-2 rounded-nested bg-[var(--color-firefly-gold)] px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
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
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-[var(--fg-tertiary)]">
        {filteredProposals.length} {t.ofWord} {state.total}{' '}
        {state.total === 1 ? t.proposalWord : t.proposalsWord}
      </div>

      {/* Proposals list */}
      {filteredProposals.length > 0 ? (
        <div className="space-y-4">
          {filteredProposals.map((proposal) => (
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
        <EmptyState title={t.noProposals} />
      )}
    </div>
  );
}
