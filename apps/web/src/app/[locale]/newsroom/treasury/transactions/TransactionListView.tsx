'use client';

/**
 * TransactionListView — Full transaction history with filters.
 *
 * Shows all transactions with ability to filter by status and type,
 * and take actions (approve, execute, cancel) based on permissions.
 */

import type { ReactElement } from 'react';
import { useState, useEffect, useCallback } from 'react';
import type {
  OrganizationPreview,
  OrganizationId,
  TreasuryTransaction,
  TreasuryTransactionStatus,
  TreasuryId,
  DIMCredential,
} from '@cocuyo/types';
import { deriveCredentialFromString, formatPUSD, createTreasuryId } from '@cocuyo/types';
import { useSigner } from '@/hooks';
import { EmptyState } from '@cocuyo/ui';
import { organizationService } from '@/lib/services/organization-service';
import { treasuryService } from '@/lib/services/treasury-service';

interface TransactionListViewTranslations {
  signInRequired: string;
  noAccess: string;
  // Filters
  filterByStatus: string;
  filterByType: string;
  // Status
  pending: string;
  approved: string;
  executed: string;
  rejected: string;
  cancelled: string;
  // Type
  withdrawal: string;
  deposit: string;
  transfer: string;
  allocation: string;
  // Actions
  approve: string;
  execute: string;
  cancel: string;
  approvals: string;
  // Empty
  noTransactions: string;
  // Permissions
  insufficientPermission: string;
}

export interface TransactionListViewProps {
  translations: TransactionListViewTranslations;
}

interface TransactionListState {
  organizations: readonly OrganizationPreview[];
  selectedOrgId: OrganizationId | null;
  treasuryId: TreasuryId | null;
  transactions: readonly TreasuryTransaction[];
  statusFilter: TreasuryTransactionStatus | 'all';
  typeFilter: string;
  canApprove: boolean;
  loading: boolean;
  error: boolean;
}

export function TransactionListView({ translations: t }: TransactionListViewProps): ReactElement {
  const { isConnected, selectedAccount } = useSigner();

  const [state, setState] = useState<TransactionListState>({
    organizations: [],
    selectedOrgId: null,
    treasuryId: null,
    transactions: [],
    statusFilter: 'all',
    typeFilter: 'all',
    canApprove: false,
    loading: true,
    error: false,
  });

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Get credential from connected account
  const credential: DIMCredential | null = selectedAccount
    ? deriveCredentialFromString(selectedAccount.address)
    : null;

  // Load user's organizations
  useEffect(() => {
    if (!credential) {
      setState((prev) => ({ ...prev, loading: false, organizations: [] }));
      return;
    }

    let isActive = true;

    const loadOrganizations = async (): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true, error: false }));

      try {
        const orgs = await organizationService.getOrganizationsForMember(credential);

        if (!isActive) return;

        const firstOrgId = orgs[0]?.id ?? null;

        setState((prev) => ({
          ...prev,
          organizations: orgs,
          selectedOrgId: firstOrgId,
          loading: orgs.length > 0,
        }));
      } catch {
        if (isActive) {
          setState((prev) => ({ ...prev, loading: false, error: true }));
        }
      }
    };

    void loadOrganizations();

    return () => {
      isActive = false;
    };
  }, [credential]);

  // Load transactions when selectedOrgId or filters change
  useEffect(() => {
    const orgId = state.selectedOrgId;
    if (!orgId || !credential) {
      if (orgId === null && state.organizations.length === 0) {
        setState((prev) => ({ ...prev, loading: false }));
      }
      return;
    }

    let isActive = true;

    const loadTransactions = async (): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true, error: false }));

      try {
        // Derive treasury ID from organization ID
        const treasuryId = createTreasuryId(`treasury-${orgId}`);

        // Build filter params
        const params: {
          treasuryId: TreasuryId;
          status?: TreasuryTransactionStatus;
          pagination: { limit: number; offset: number };
        } = {
          treasuryId,
          pagination: { limit: 50, offset: 0 },
        };

        if (state.statusFilter !== 'all') {
          params.status = state.statusFilter;
        }

        const txResult = await treasuryService.getTransactionHistory(params);

        // Filter by type client-side if needed
        let filteredItems = txResult.items;
        if (state.typeFilter !== 'all') {
          filteredItems = filteredItems.filter((tx) => tx.type === state.typeFilter);
        }

        // Check if user can approve transactions
        const canApprove = await organizationService.hasPermission(
          orgId,
          credential,
          'treasury:approve'
        );

        if (!isActive) return;

        setState((prev) => ({
          ...prev,
          transactions: filteredItems,
          treasuryId,
          canApprove,
          loading: false,
          error: false,
        }));
      } catch {
        if (isActive) {
          setState((prev) => ({ ...prev, loading: false, error: true }));
        }
      }
    };

    void loadTransactions();

    return () => {
      isActive = false;
    };
  }, [
    state.selectedOrgId,
    state.statusFilter,
    state.typeFilter,
    credential,
    state.organizations.length,
  ]);

  const reloadTransactions = useCallback(async (): Promise<void> => {
    if (!state.treasuryId) return;
    const txResult = await treasuryService.getTransactionHistory({
      treasuryId: state.treasuryId,
      pagination: { limit: 50, offset: 0 },
    });
    setState((prev) => ({ ...prev, transactions: txResult.items }));
  }, [state.treasuryId]);

  const handleApprove = useCallback(
    async (txId: string): Promise<void> => {
      setActionLoading(txId);
      try {
        const result = await treasuryService.approveWithdrawal(txId);
        if (result.ok) {
          await reloadTransactions();
        }
      } finally {
        setActionLoading(null);
      }
    },
    [reloadTransactions]
  );

  const handleExecute = useCallback(
    async (txId: string): Promise<void> => {
      setActionLoading(txId);
      try {
        const result = await treasuryService.executeWithdrawal(txId);
        if (result.ok) {
          await reloadTransactions();
        }
      } finally {
        setActionLoading(null);
      }
    },
    [reloadTransactions]
  );

  const handleCancel = useCallback(
    async (txId: string): Promise<void> => {
      setActionLoading(txId);
      try {
        const result = await treasuryService.cancelWithdrawal(txId);
        if (result.ok) {
          await reloadTransactions();
        }
      } finally {
        setActionLoading(null);
      }
    },
    [reloadTransactions]
  );

  // Show sign-in required message
  if (!isConnected || !selectedAccount) {
    return (
      <EmptyState
        title={t.signInRequired}
        description="Connect your wallet to view transactions."
      />
    );
  }

  // Loading state
  if (state.loading) {
    return (
      <div className="py-16 text-center">
        <div className="text-[var(--fg-tertiary)]">Loading...</div>
      </div>
    );
  }

  // No organizations
  if (state.organizations.length === 0) {
    return (
      <EmptyState title={t.noAccess} description="You are not a member of any organizations." />
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="py-16 text-center">
        <div className="text-[var(--fg-error)]">Failed to load transactions</div>
      </div>
    );
  }

  const { transactions, canApprove } = state;

  const statusColors: Record<string, string> = {
    pending: 'text-[var(--fg-warning)]',
    approved: 'text-[var(--fg-info)]',
    executed: 'text-[var(--fg-success)]',
    rejected: 'text-[var(--fg-error)]',
    cancelled: 'text-[var(--fg-tertiary)]',
  };

  const statusLabels: Record<string, string> = {
    pending: t.pending,
    approved: t.approved,
    executed: t.executed,
    rejected: t.rejected,
    cancelled: t.cancelled,
  };

  const typeLabels: Record<string, string> = {
    withdrawal: t.withdrawal,
    deposit: t.deposit,
    transfer: t.transfer,
    allocation: t.allocation,
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-xs text-[var(--fg-tertiary)]">{t.filterByStatus}</label>
          <select
            value={state.statusFilter}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                statusFilter: e.target.value as TreasuryTransactionStatus | 'all',
              }))
            }
            className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] px-3 py-1.5 text-sm text-[var(--fg-primary)]"
          >
            <option value="all">All</option>
            <option value="pending">{t.pending}</option>
            <option value="approved">{t.approved}</option>
            <option value="executed">{t.executed}</option>
            <option value="rejected">{t.rejected}</option>
            <option value="cancelled">{t.cancelled}</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-[var(--fg-tertiary)]">{t.filterByType}</label>
          <select
            value={state.typeFilter}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                typeFilter: e.target.value,
              }))
            }
            className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] px-3 py-1.5 text-sm text-[var(--fg-primary)]"
          >
            <option value="all">All</option>
            <option value="withdrawal">{t.withdrawal}</option>
            <option value="deposit">{t.deposit}</option>
            <option value="transfer">{t.transfer}</option>
            <option value="allocation">{t.allocation}</option>
          </select>
        </div>
      </div>

      {/* Transactions table */}
      {transactions.length === 0 ? (
        <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-8 text-center">
          <p className="text-[var(--fg-tertiary)]">{t.noTransactions}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-container border border-[var(--border-default)]">
          <table className="w-full">
            <thead className="bg-[var(--bg-surface-container)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--fg-tertiary)]">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--fg-tertiary)]">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--fg-tertiary)]">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--fg-tertiary)]">
                  {t.approvals}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--fg-tertiary)]">
                  Date
                </th>
                {canApprove && (
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--fg-tertiary)]">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)] bg-[var(--bg-surface-nested)]">
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="px-4 py-3 text-sm text-[var(--fg-primary)]">
                    {typeLabels[tx.type] ?? tx.type}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-[var(--fg-primary)]">
                    {formatPUSD(tx.amount)}
                  </td>
                  <td
                    className={`px-4 py-3 text-sm ${statusColors[tx.status] ?? 'text-[var(--fg-tertiary)]'}`}
                  >
                    {statusLabels[tx.status] ?? tx.status}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--fg-tertiary)]">
                    {tx.approvers.length}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--fg-tertiary)]">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </td>
                  {canApprove && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {tx.status === 'pending' && (
                          <button
                            onClick={() => void handleApprove(tx.id)}
                            disabled={actionLoading === tx.id}
                            className="rounded-nested bg-[var(--accent-primary)] px-3 py-1 text-xs font-medium text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-primary-hover)] disabled:opacity-50"
                          >
                            {t.approve}
                          </button>
                        )}
                        {tx.status === 'approved' && (
                          <button
                            onClick={() => void handleExecute(tx.id)}
                            disabled={actionLoading === tx.id}
                            className="rounded-nested bg-[var(--fg-success)] px-3 py-1 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                          >
                            {t.execute}
                          </button>
                        )}
                        {tx.status === 'pending' && (
                          <button
                            onClick={() => void handleCancel(tx.id)}
                            disabled={actionLoading === tx.id}
                            className="rounded-nested border border-[var(--border-default)] px-3 py-1 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-surface-container)] disabled:opacity-50"
                          >
                            {t.cancel}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
