'use client';

/**
 * TreasuryOverviewView — Organization treasury overview component.
 *
 * Shows balance breakdown, recent transactions, and quick actions.
 */

import type { ReactElement } from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import type {
  OrganizationPreview,
  OrganizationId,
  TreasuryBalance,
  TreasuryTransaction,
  TreasuryId,
  DIMCredential,
} from '@cocuyo/types';
import { deriveCredentialFromString, ZERO_PUSD, formatPUSD, createTreasuryId } from '@cocuyo/types';
import { useSigner } from '@/hooks';
import { EmptyState } from '@cocuyo/ui';
import { organizationService } from '@/lib/services/organization-service';
import { treasuryService } from '@/lib/services/treasury-service';

interface TreasuryOverviewViewTranslations {
  signInRequired: string;
  noAccess: string;
  // Balance
  balance: string;
  available: string;
  escrowed: string;
  // Actions
  withdraw: string;
  deposit: string;
  // Transactions
  transactions: string;
  noTransactions: string;
  viewAll: string;
  // Status
  pending: string;
  approved: string;
  executed: string;
  rejected: string;
  cancelled: string;
  // Permissions
  insufficientPermission: string;
}

export interface TreasuryOverviewViewProps {
  translations: TreasuryOverviewViewTranslations;
}

interface TreasuryState {
  organizations: readonly OrganizationPreview[];
  selectedOrgId: OrganizationId | null;
  treasuryId: TreasuryId | null;
  balance: TreasuryBalance | null;
  recentTransactions: readonly TreasuryTransaction[];
  canPropose: boolean;
  loading: boolean;
  error: boolean;
}

export function TreasuryOverviewView({ translations: t }: TreasuryOverviewViewProps): ReactElement {
  const { isConnected, selectedAccount } = useSigner();

  const [state, setState] = useState<TreasuryState>({
    organizations: [],
    selectedOrgId: null,
    treasuryId: null,
    balance: null,
    recentTransactions: [],
    canPropose: false,
    loading: true,
    error: false,
  });

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

  // Load treasury data when selectedOrgId changes
  useEffect(() => {
    const orgId = state.selectedOrgId;
    if (!orgId || !credential) {
      if (orgId === null && state.organizations.length === 0) {
        setState((prev) => ({ ...prev, loading: false }));
      }
      return;
    }

    let isActive = true;

    const loadTreasuryData = async (): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true, error: false }));

      try {
        // Get treasury balance for organization
        const balance = await treasuryService.getTreasuryForOrganization(orgId);

        // Derive treasury ID from organization ID
        const treasuryId = createTreasuryId(`treasury-${orgId}`);

        // Get recent transactions
        const txResult = await treasuryService.getTransactionHistory({
          treasuryId,
          pagination: { limit: 5, offset: 0 },
        });

        // Check if user can propose transactions
        const canPropose = await organizationService.hasPermission(
          orgId,
          credential,
          'treasury:propose'
        );

        if (!isActive) return;

        setState((prev) => ({
          ...prev,
          balance,
          treasuryId,
          recentTransactions: txResult.items,
          canPropose,
          loading: false,
          error: false,
        }));
      } catch {
        if (isActive) {
          setState((prev) => ({ ...prev, loading: false, error: true }));
        }
      }
    };

    void loadTreasuryData();

    return () => {
      isActive = false;
    };
  }, [state.selectedOrgId, credential, state.organizations.length]);

  // Show sign-in required message
  if (!isConnected || !selectedAccount) {
    return (
      <EmptyState title={t.signInRequired} description="Connect your wallet to access treasury." />
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
        <div className="text-[var(--fg-error)]">Failed to load treasury data</div>
      </div>
    );
  }

  const { balance, recentTransactions, canPropose } = state;

  const statusColors: Record<string, string> = {
    pending: 'text-[var(--fg-warning)]',
    approved: 'text-[var(--fg-info)]',
    executed: 'text-[var(--fg-success)]',
    rejected: 'text-[var(--fg-error)]',
    cancelled: 'text-[var(--fg-tertiary)]',
  };

  return (
    <div className="space-y-8">
      {/* Balance cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        {/* Total Balance */}
        <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6 text-center">
          <p className="mb-2 text-sm text-[var(--fg-tertiary)]">{t.balance}</p>
          <p className="font-display text-3xl font-medium text-[var(--fg-primary)]">
            {formatPUSD(balance?.total ?? ZERO_PUSD)}
          </p>
        </div>

        {/* Available */}
        <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6 text-center">
          <p className="mb-2 text-sm text-[var(--fg-tertiary)]">{t.available}</p>
          <p className="font-display text-3xl font-medium text-[var(--fg-success)]">
            {formatPUSD(balance?.available ?? ZERO_PUSD)}
          </p>
        </div>

        {/* Escrowed */}
        <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6 text-center">
          <p className="mb-2 text-sm text-[var(--fg-tertiary)]">{t.escrowed}</p>
          <p className="font-display text-3xl font-medium text-[var(--fg-warning)]">
            {formatPUSD(balance?.escrowed ?? ZERO_PUSD)}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      {canPropose && (
        <div className="flex gap-4">
          <Link
            href="/newsroom/treasury/withdraw"
            className="rounded-nested bg-[var(--accent-primary)] px-6 py-2 text-sm font-medium text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-primary-hover)]"
          >
            {t.withdraw}
          </Link>
        </div>
      )}

      {/* Recent transactions */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-[var(--fg-primary)]">{t.transactions}</h2>
          <Link
            href="/newsroom/treasury/transactions"
            className="text-sm text-[var(--accent-primary)] hover:underline"
          >
            {t.viewAll} &rarr;
          </Link>
        </div>

        {recentTransactions.length === 0 ? (
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
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)] bg-[var(--bg-surface-nested)]">
                {recentTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-3 text-sm text-[var(--fg-primary)]">
                      {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-[var(--fg-primary)]">
                      {formatPUSD(tx.amount)}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm ${statusColors[tx.status] ?? 'text-[var(--fg-tertiary)]'}`}
                    >
                      {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--fg-tertiary)]">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
