'use client';

/**
 * NewsroomDashboardView — Main client component for the newsroom dashboard.
 *
 * Shows organization overview including treasury balance, team members,
 * pending approvals, and recent activity. Requires organization membership.
 */

import type { ReactElement } from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import type {
  OrganizationPreview,
  OrganizationId,
  TreasuryBalance,
  TreasuryTransaction,
  OrganizationMember,
  DIMCredential,
  TreasuryId,
} from '@cocuyo/types';
import { deriveCredentialFromString, ZERO_PUSD, formatPUSD, createTreasuryId } from '@cocuyo/types';
import { useSigner } from '@/hooks';
import { EmptyState } from '@cocuyo/ui';
import { organizationService } from '@/lib/services/organization-service';
import { treasuryService } from '@/lib/services/treasury-service';

interface NewsroomDashboardViewTranslations {
  signInRequired: string;
  noAccess: string;
  selectOrg: string;
  noOrgs: string;
  // Overview
  treasuryBalance: string;
  teamMembers: string;
  pendingApprovals: string;
  recentActivity: string;
  noActivity: string;
  // Treasury
  treasuryTitle: string;
  available: string;
  escrowed: string;
  withdraw: string;
  viewAll: string;
  // Team
  teamTitle: string;
  invite: string;
  // Navigation
  navTreasury: string;
  navTeam: string;
  navBudget: string;
  navSettings: string;
}

export interface NewsroomDashboardViewProps {
  translations: NewsroomDashboardViewTranslations;
}

interface DashboardState {
  organizations: readonly OrganizationPreview[];
  selectedOrgId: OrganizationId | null;
  treasuryId: TreasuryId | null;
  balance: TreasuryBalance | null;
  members: readonly OrganizationMember[];
  pendingTransactions: readonly TreasuryTransaction[];
  recentActivity: readonly TreasuryTransaction[];
  loading: boolean;
  error: boolean;
}

export function NewsroomDashboardView({
  translations: t,
}: NewsroomDashboardViewProps): ReactElement {
  const { isConnected, selectedAccount } = useSigner();

  const [state, setState] = useState<DashboardState>({
    organizations: [],
    selectedOrgId: null,
    treasuryId: null,
    balance: null,
    members: [],
    pendingTransactions: [],
    recentActivity: [],
    loading: true,
    error: false,
  });

  // Get credential from connected account using canonical derivation
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

  // Load organization data when selectedOrgId changes
  useEffect(() => {
    const orgId = state.selectedOrgId;
    if (!orgId || !credential) {
      if (orgId === null && state.organizations.length === 0) {
        setState((prev) => ({ ...prev, loading: false }));
      }
      return;
    }

    let isActive = true;

    const loadOrgData = async (): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true, error: false }));

      try {
        // Get organization details for members
        const org = await organizationService.getOrganization(orgId);

        // Get treasury balance for organization
        const balance = await treasuryService.getTreasuryForOrganization(orgId);

        // Derive treasury ID from organization ID
        const treasuryId = createTreasuryId(`treasury-${orgId}`);

        // Get pending transactions
        const pendingResult = await treasuryService.getTransactionHistory({
          treasuryId,
          status: 'pending',
          pagination: { limit: 10, offset: 0 },
        });

        // Get recent transactions for activity
        const recentResult = await treasuryService.getTransactionHistory({
          treasuryId,
          pagination: { limit: 5, offset: 0 },
        });

        if (!isActive) return;

        setState((prev) => ({
          ...prev,
          balance,
          treasuryId,
          members: org?.members ?? [],
          pendingTransactions: pendingResult.items,
          recentActivity: recentResult.items,
          loading: false,
          error: false,
        }));
      } catch {
        if (isActive) {
          setState((prev) => ({ ...prev, loading: false, error: true }));
        }
      }
    };

    void loadOrgData();

    return () => {
      isActive = false;
    };
  }, [state.selectedOrgId, credential, state.organizations.length]);

  // Show sign-in required message
  if (!isConnected || !selectedAccount) {
    return (
      <EmptyState
        title={t.signInRequired}
        description="Connect your wallet to access your organization's newsroom."
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
      <EmptyState title={t.noOrgs} description="Join an organization to access the newsroom." />
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="py-16 text-center">
        <div className="text-[var(--fg-error)]">Failed to load newsroom data</div>
      </div>
    );
  }

  const { balance, members, pendingTransactions, recentActivity } = state;

  return (
    <div className="space-y-8">
      {/* Organization selector (if multiple) */}
      {state.organizations.length > 1 && (
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">
            {t.selectOrg}
          </label>
          <select
            value={state.selectedOrgId ?? ''}
            onChange={(e) =>
              setState((prev) => ({ ...prev, selectedOrgId: e.target.value as OrganizationId }))
            }
            className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] px-4 py-2 text-sm text-[var(--fg-primary)]"
          >
            {state.organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Top stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Treasury Balance */}
        <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
          <p className="mb-2 text-sm text-[var(--fg-tertiary)]">{t.treasuryBalance}</p>
          <p className="font-display text-2xl font-medium text-[var(--fg-primary)]">
            {formatPUSD(balance?.total ?? ZERO_PUSD)}
          </p>
          <div className="mt-2 flex gap-4 text-xs text-[var(--fg-tertiary)]">
            <span>
              {t.available}: {formatPUSD(balance?.available ?? ZERO_PUSD)}
            </span>
          </div>
        </div>

        {/* Team Members */}
        <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
          <p className="mb-2 text-sm text-[var(--fg-tertiary)]">{t.teamMembers}</p>
          <p className="font-display text-2xl font-medium text-[var(--fg-primary)]">
            {members.length}
          </p>
          <Link
            href="/newsroom/team"
            className="mt-2 inline-block text-xs text-[var(--accent-primary)] hover:underline"
          >
            {t.navTeam} &rarr;
          </Link>
        </div>

        {/* Pending Approvals */}
        <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
          <p className="mb-2 text-sm text-[var(--fg-tertiary)]">{t.pendingApprovals}</p>
          <p className="font-display text-2xl font-medium text-[var(--fg-primary)]">
            {pendingTransactions.length}
          </p>
          {pendingTransactions.length > 0 && (
            <Link
              href="/newsroom/treasury/transactions"
              className="mt-2 inline-block text-xs text-[var(--accent-primary)] hover:underline"
            >
              {t.viewAll} &rarr;
            </Link>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
          <p className="mb-2 text-sm text-[var(--fg-tertiary)]">Quick Actions</p>
          <div className="flex flex-col gap-2">
            <Link
              href="/newsroom/treasury/withdraw"
              className="rounded-nested bg-[var(--bg-surface-container)] px-3 py-1.5 text-center text-sm text-[var(--fg-primary)] transition-colors hover:bg-[var(--bg-surface-elevated)]"
            >
              {t.withdraw}
            </Link>
            <Link
              href="/newsroom/team/invite"
              className="rounded-nested bg-[var(--bg-surface-container)] px-3 py-1.5 text-center text-sm text-[var(--fg-primary)] transition-colors hover:bg-[var(--bg-surface-elevated)]"
            >
              {t.invite}
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-medium text-[var(--fg-primary)]">{t.recentActivity}</h2>
        </div>

        {recentActivity.length === 0 ? (
          <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-8 text-center">
            <p className="text-[var(--fg-tertiary)]">{t.noActivity}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--fg-primary)]">
                    {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                  </p>
                  <p className="text-xs text-[var(--fg-tertiary)]">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-[var(--fg-primary)]">
                    {formatPUSD(tx.amount)}
                  </p>
                  <p
                    className={`text-xs ${
                      tx.status === 'executed'
                        ? 'text-[var(--fg-success)]'
                        : tx.status === 'pending'
                          ? 'text-[var(--fg-warning)]'
                          : 'text-[var(--fg-tertiary)]'
                    }`}
                  >
                    {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {recentActivity.length > 0 && (
          <div className="mt-4 text-center">
            <Link
              href="/newsroom/treasury/transactions"
              className="text-sm text-[var(--accent-primary)] hover:underline"
            >
              {t.viewAll} &rarr;
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
