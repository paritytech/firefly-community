'use client';

/**
 * WithdrawFormView — Form to request treasury withdrawal.
 *
 * Validates amount against available balance and spending limits.
 */

import type { ReactElement, FormEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type {
  OrganizationPreview,
  OrganizationId,
  TreasuryBalance,
  TreasuryId,
  DIMCredential,
  BudgetCategory,
} from '@cocuyo/types';
import {
  deriveCredentialFromString,
  createTreasuryId,
  createPolkadotAddress,
  ZERO_PUSD,
  formatPUSD,
  parsePUSD,
  comparePUSD,
} from '@cocuyo/types';
import { useSigner } from '@/hooks';
import { EmptyState } from '@cocuyo/ui';
import { organizationService } from '@/lib/services/organization-service';
import { treasuryService } from '@/lib/services/treasury-service';

interface WithdrawFormViewTranslations {
  signInRequired: string;
  noAccess: string;
  // Form fields
  amount: string;
  recipient: string;
  category: string;
  purpose: string;
  // Actions
  submit: string;
  submitting: string;
  // Validation
  insufficientBalance: string;
  exceedsLimit: string;
  // Success
  success: string;
  // Balance
  available: string;
  // Permissions
  insufficientPermission: string;
  // Categories
  categoryEditorial: string;
  categoryTechnology: string;
  categoryAdministration: string;
  categoryFieldOperations: string;
  categoryLegal: string;
  categoryGrantsOut: string;
}

export interface WithdrawFormViewProps {
  translations: WithdrawFormViewTranslations;
}

interface FormState {
  organizations: readonly OrganizationPreview[];
  selectedOrgId: OrganizationId | null;
  treasuryId: TreasuryId | null;
  balance: TreasuryBalance | null;
  canPropose: boolean;
  loading: boolean;
  error: boolean;
}

interface FormData {
  amount: string;
  recipient: string;
  category: BudgetCategory;
  purpose: string;
}

export function WithdrawFormView({ translations: t }: WithdrawFormViewProps): ReactElement {
  const router = useRouter();
  const { isConnected, selectedAccount } = useSigner();

  const [state, setState] = useState<FormState>({
    organizations: [],
    selectedOrgId: null,
    treasuryId: null,
    balance: null,
    canPropose: false,
    loading: true,
    error: false,
  });

  const [formData, setFormData] = useState<FormData>({
    amount: '',
    recipient: '',
    category: 'editorial',
    purpose: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

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

  // Load balance and permissions when selectedOrgId changes
  useEffect(() => {
    if (!state.selectedOrgId || !credential) {
      if (state.selectedOrgId === null && state.organizations.length === 0) {
        setState((prev) => ({ ...prev, loading: false }));
      }
      return;
    }

    let isActive = true;

    const loadData = async (): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true, error: false }));

      try {
        const orgId = state.selectedOrgId;
        if (!orgId) return;

        // Derive treasury ID from organization ID
        const treasuryId = createTreasuryId(`treasury-${orgId}`);

        // Get treasury balance
        const balance = await treasuryService.getTreasuryForOrganization(orgId);

        // Check if user can propose transactions
        const canPropose = await organizationService.hasPermission(
          orgId,
          credential,
          'treasury:propose'
        );

        if (!isActive) return;

        setState((prev) => ({
          ...prev,
          treasuryId,
          balance,
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

    void loadData();

    return () => {
      isActive = false;
    };
  }, [state.selectedOrgId, credential, state.organizations.length]);

  const handleSubmit = useCallback(
    async (e: FormEvent): Promise<void> => {
      e.preventDefault();
      if (!state.selectedOrgId || !state.treasuryId || !state.canPropose) return;

      setSubmitting(true);
      setSubmitError(null);

      try {
        const amount = parsePUSD(formData.amount);

        // Validate amount
        if (state.balance && comparePUSD(amount, state.balance.available) > 0) {
          setSubmitError(t.insufficientBalance);
          setSubmitting(false);
          return;
        }

        const result = await treasuryService.proposeWithdrawal({
          treasuryId: state.treasuryId,
          amount,
          recipient: createPolkadotAddress(formData.recipient),
          category: formData.category,
          purpose: formData.purpose,
        });

        if (result.ok) {
          setSubmitSuccess(true);
          // Redirect after brief delay
          setTimeout(() => {
            router.push('/newsroom/treasury/transactions');
          }, 1500);
        } else {
          setSubmitError(result.error);
        }
      } catch {
        setSubmitError('Failed to submit withdrawal request');
      } finally {
        setSubmitting(false);
      }
    },
    [
      state.selectedOrgId,
      state.treasuryId,
      state.canPropose,
      state.balance,
      formData,
      t.insufficientBalance,
      router,
    ]
  );

  // Show sign-in required message
  if (!isConnected || !selectedAccount) {
    return (
      <EmptyState
        title={t.signInRequired}
        description="Connect your wallet to request withdrawals."
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

  // No permission
  if (!state.canPropose) {
    return (
      <EmptyState
        title={t.insufficientPermission}
        description="You don't have permission to propose treasury transactions."
      />
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="py-16 text-center">
        <div className="text-[var(--fg-error)]">Failed to load data</div>
      </div>
    );
  }

  // Success state
  if (submitSuccess) {
    return (
      <div className="rounded-container border border-[var(--border-success)] bg-[var(--bg-success)] p-8 text-center">
        <p className="text-lg font-medium text-[var(--fg-success)]">{t.success}</p>
        <p className="mt-2 text-sm text-[var(--fg-secondary)]">Redirecting to transactions...</p>
      </div>
    );
  }

  const { balance } = state;

  const categoryOptions: { value: BudgetCategory; label: string }[] = [
    { value: 'editorial', label: t.categoryEditorial },
    { value: 'technology', label: t.categoryTechnology },
    { value: 'administration', label: t.categoryAdministration },
    { value: 'field-operations', label: t.categoryFieldOperations },
    { value: 'legal', label: t.categoryLegal },
    { value: 'grants-out', label: t.categoryGrantsOut },
  ];

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      {/* Available balance */}
      <div className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4">
        <p className="text-sm text-[var(--fg-tertiary)]">{t.available}</p>
        <p className="font-display text-2xl font-medium text-[var(--fg-success)]">
          {formatPUSD(balance?.available ?? ZERO_PUSD)}
        </p>
      </div>

      {/* Amount */}
      <div>
        <label htmlFor="amount" className="mb-2 block text-sm font-medium text-[var(--fg-primary)]">
          {t.amount}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-tertiary)]">
            $
          </span>
          <input
            type="number"
            id="amount"
            value={formData.amount}
            onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
            placeholder="0.00"
            step="0.01"
            min="0"
            required
            className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] py-2 pl-8 pr-4 text-[var(--fg-primary)] placeholder-[var(--fg-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
          />
        </div>
      </div>

      {/* Recipient */}
      <div>
        <label
          htmlFor="recipient"
          className="mb-2 block text-sm font-medium text-[var(--fg-primary)]"
        >
          {t.recipient}
        </label>
        <input
          type="text"
          id="recipient"
          value={formData.recipient}
          onChange={(e) => setFormData((prev) => ({ ...prev, recipient: e.target.value }))}
          placeholder="5GrwvaEF5zXb26..."
          required
          className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] px-4 py-2 text-[var(--fg-primary)] placeholder-[var(--fg-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
        />
      </div>

      {/* Category */}
      <div>
        <label
          htmlFor="category"
          className="mb-2 block text-sm font-medium text-[var(--fg-primary)]"
        >
          {t.category}
        </label>
        <select
          id="category"
          value={formData.category}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, category: e.target.value as BudgetCategory }))
          }
          className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] px-4 py-2 text-[var(--fg-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
        >
          {categoryOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Purpose */}
      <div>
        <label
          htmlFor="purpose"
          className="mb-2 block text-sm font-medium text-[var(--fg-primary)]"
        >
          {t.purpose}
        </label>
        <textarea
          id="purpose"
          value={formData.purpose}
          onChange={(e) => setFormData((prev) => ({ ...prev, purpose: e.target.value }))}
          placeholder="Describe the purpose of this withdrawal..."
          rows={4}
          required
          className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] px-4 py-2 text-[var(--fg-primary)] placeholder-[var(--fg-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
        />
      </div>

      {/* Error message */}
      {submitError != null && submitError !== '' && (
        <div className="rounded-nested border border-[var(--border-error)] bg-[var(--bg-error)] p-3 text-sm text-[var(--fg-error)]">
          {submitError}
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-nested bg-[var(--accent-primary)] px-6 py-3 font-medium text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-primary-hover)] disabled:opacity-50"
      >
        {submitting ? t.submitting : t.submit}
      </button>
    </form>
  );
}
