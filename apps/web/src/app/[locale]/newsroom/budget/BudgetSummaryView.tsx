'use client';

/**
 * BudgetSummaryView — Financial summary for the organization.
 *
 * Shows income/expenses breakdown, burn rate, and runway.
 */

import type { ReactElement } from 'react';
import { useState, useEffect, useMemo } from 'react';
import type {
  OrganizationPreview,
  OrganizationId,
  TreasuryId,
  BudgetSummary,
  DIMCredential,
  BudgetCategory,
  DepositSource,
} from '@cocuyo/types';
import { deriveCredentialFromString, createTreasuryId, formatPUSD } from '@cocuyo/types';
import { useSigner } from '@/hooks';
import { EmptyState } from '@cocuyo/ui';
import { organizationService } from '@/lib/services/organization-service';
import { treasuryService } from '@/lib/services/treasury-service';

interface BudgetSummaryViewTranslations {
  signInRequired: string;
  noAccess: string;
  // Period
  period: string;
  thisMonth: string;
  thisQuarter: string;
  thisYear: string;
  // Summary
  startingBalance: string;
  endingBalance: string;
  income: string;
  expenses: string;
  burnRate: string;
  runway: string;
  months: string;
  // Breakdown
  byCategory: string;
  bySource: string;
  noData: string;
  // Categories
  categoryEditorial: string;
  categoryTechnology: string;
  categoryAdministration: string;
  categoryFieldOperations: string;
  categoryLegal: string;
  categoryGrantsOut: string;
  // Sources
  sourceCampaigns: string;
  sourceGrants: string;
  sourceDonations: string;
  sourceOther: string;
}

export interface BudgetSummaryViewProps {
  translations: BudgetSummaryViewTranslations;
}

type PeriodType = 'month' | 'quarter' | 'year';

interface BudgetState {
  organizations: readonly OrganizationPreview[];
  selectedOrgId: OrganizationId | null;
  treasuryId: TreasuryId | null;
  summary: BudgetSummary | null;
  period: PeriodType;
  loading: boolean;
  error: boolean;
}

function getPeriodDates(period: PeriodType): { startDate: number; endDate: number } {
  const now = new Date();
  const endDate = now.getTime();
  let startDate: number;

  switch (period) {
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      break;
    case 'quarter': {
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), quarterStart, 1).getTime();
      break;
    }
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1).getTime();
      break;
  }

  return { startDate, endDate };
}

export function BudgetSummaryView({ translations: t }: BudgetSummaryViewProps): ReactElement {
  const { isConnected, selectedAccount } = useSigner();

  const [state, setState] = useState<BudgetState>({
    organizations: [],
    selectedOrgId: null,
    treasuryId: null,
    summary: null,
    period: 'month',
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

        setState((prev) => ({
          ...prev,
          organizations: orgs,
          selectedOrgId: orgs[0]?.id ?? null,
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

  // Load budget summary when selectedOrgId or period changes
  useEffect(() => {
    if (!state.selectedOrgId || !credential) {
      if (state.selectedOrgId === null && state.organizations.length === 0) {
        setState((prev) => ({ ...prev, loading: false }));
      }
      return;
    }

    let isActive = true;

    const loadBudgetData = async (): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true, error: false }));

      try {
        const orgId = state.selectedOrgId;
        if (!orgId) return;

        // Derive treasury ID from organization ID
        const treasuryId = createTreasuryId(`treasury-${orgId}`);

        const { startDate, endDate } = getPeriodDates(state.period);

        const summary = await treasuryService.getBudgetSummary({
          treasuryId,
          periodStart: startDate,
          periodEnd: endDate,
        });

        if (!isActive) return;

        setState((prev) => ({
          ...prev,
          treasuryId,
          summary,
          loading: false,
          error: false,
        }));
      } catch {
        if (isActive) {
          setState((prev) => ({ ...prev, loading: false, error: true }));
        }
      }
    };

    void loadBudgetData();

    return () => {
      isActive = false;
    };
  }, [state.selectedOrgId, state.period, credential, state.organizations.length]);

  // Calculate runway (using BudgetSummary.runwayMonths if available)
  const runway = useMemo(() => {
    if (!state.summary) return null;
    return state.summary.runwayMonths > 0 ? state.summary.runwayMonths : null;
  }, [state.summary]);

  // Show sign-in required message
  if (!isConnected || !selectedAccount) {
    return (
      <EmptyState
        title={t.signInRequired}
        description="Connect your wallet to view budget summary."
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
        <div className="text-[var(--fg-error)]">Failed to load budget data</div>
      </div>
    );
  }

  const { summary, period } = state;

  const categoryLabels: Record<BudgetCategory, string> = {
    editorial: t.categoryEditorial,
    technology: t.categoryTechnology,
    administration: t.categoryAdministration,
    'field-operations': t.categoryFieldOperations,
    legal: t.categoryLegal,
    'grants-out': t.categoryGrantsOut,
  };

  const sourceLabels: Record<DepositSource, string> = {
    campaigns: t.sourceCampaigns,
    grants: t.sourceGrants,
    donations: t.sourceDonations,
    other: t.sourceOther,
  };

  const periodLabels: Record<PeriodType, string> = {
    month: t.thisMonth,
    quarter: t.thisQuarter,
    year: t.thisYear,
  };

  return (
    <div className="space-y-8">
      {/* Period selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-[var(--fg-secondary)]">{t.period}</label>
        <div className="flex gap-2">
          {(['month', 'quarter', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setState((prev) => ({ ...prev, period: p }))}
              className={`rounded-nested px-4 py-2 text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'bg-[var(--bg-surface-nested)] text-[var(--fg-secondary)] hover:bg-[var(--bg-surface-container)]'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {!summary ? (
        <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-8 text-center">
          <p className="text-[var(--fg-tertiary)]">{t.noData}</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Starting Balance */}
            <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6 text-center">
              <p className="mb-2 text-sm text-[var(--fg-tertiary)]">{t.startingBalance}</p>
              <p className="font-display text-2xl font-medium text-[var(--fg-primary)]">
                {formatPUSD(summary.startingBalance)}
              </p>
            </div>

            {/* Income */}
            <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6 text-center">
              <p className="mb-2 text-sm text-[var(--fg-tertiary)]">{t.income}</p>
              <p className="font-display text-2xl font-medium text-[var(--fg-success)]">
                +{formatPUSD(summary.totalIncome)}
              </p>
            </div>

            {/* Expenses */}
            <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6 text-center">
              <p className="mb-2 text-sm text-[var(--fg-tertiary)]">{t.expenses}</p>
              <p className="font-display text-2xl font-medium text-[var(--fg-error)]">
                -{formatPUSD(summary.totalExpenses)}
              </p>
            </div>

            {/* Ending Balance */}
            <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6 text-center">
              <p className="mb-2 text-sm text-[var(--fg-tertiary)]">{t.endingBalance}</p>
              <p className="font-display text-2xl font-medium text-[var(--fg-primary)]">
                {formatPUSD(summary.endingBalance)}
              </p>
            </div>
          </div>

          {/* Burn rate and runway */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
              <p className="mb-2 text-sm text-[var(--fg-tertiary)]">{t.burnRate}</p>
              <p className="font-display text-3xl font-medium text-[var(--fg-primary)]">
                {formatPUSD(summary.burnRate)}/mo
              </p>
            </div>

            <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
              <p className="mb-2 text-sm text-[var(--fg-tertiary)]">{t.runway}</p>
              <p className="font-display text-3xl font-medium text-[var(--fg-primary)]">
                {runway !== null ? `${runway} ${t.months}` : '∞'}
              </p>
            </div>
          </div>

          {/* Breakdowns */}
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Expenses by category */}
            <div>
              <h2 className="mb-4 text-lg font-medium text-[var(--fg-primary)]">{t.byCategory}</h2>
              <div className="space-y-3">
                {Object.entries(summary.expensesByCategory).map(([category, amount]) => (
                  <div
                    key={category}
                    className="flex items-center justify-between rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-3"
                  >
                    <span className="text-sm text-[var(--fg-primary)]">
                      {categoryLabels[category as BudgetCategory]}
                    </span>
                    <span className="font-mono text-sm text-[var(--fg-primary)]">
                      {formatPUSD(amount)}
                    </span>
                  </div>
                ))}
                {Object.keys(summary.expensesByCategory).length === 0 && (
                  <div className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4 text-center">
                    <p className="text-sm text-[var(--fg-tertiary)]">No expenses</p>
                  </div>
                )}
              </div>
            </div>

            {/* Income by source */}
            <div>
              <h2 className="mb-4 text-lg font-medium text-[var(--fg-primary)]">{t.bySource}</h2>
              <div className="space-y-3">
                {Object.entries(summary.incomeBySource).map(([source, amount]) => (
                  <div
                    key={source}
                    className="flex items-center justify-between rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-3"
                  >
                    <span className="text-sm text-[var(--fg-primary)]">
                      {sourceLabels[source as DepositSource]}
                    </span>
                    <span className="font-mono text-sm text-[var(--fg-success)]">
                      +{formatPUSD(amount)}
                    </span>
                  </div>
                ))}
                {Object.keys(summary.incomeBySource).length === 0 && (
                  <div className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4 text-center">
                    <p className="text-sm text-[var(--fg-tertiary)]">No income</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
