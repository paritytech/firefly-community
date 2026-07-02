'use client';

/**
 * InviteFormView — Form to invite a new team member.
 *
 * Sends an invitation to a DIM credential with a specified role.
 */

import type { ReactElement, FormEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type {
  OrganizationPreview,
  OrganizationId,
  OrganizationRole,
  DIMCredential,
} from '@cocuyo/types';
import { deriveCredentialFromString, createDIMCredential } from '@cocuyo/types';
import { useSigner } from '@/hooks';
import { EmptyState } from '@cocuyo/ui';
import { organizationService } from '@/lib/services/organization-service';

interface InviteFormViewTranslations {
  signInRequired: string;
  noAccess: string;
  // Form fields
  credential: string;
  credentialPlaceholder: string;
  role: string;
  message: string;
  messagePlaceholder: string;
  // Actions
  send: string;
  sending: string;
  // Success
  success: string;
  // Permissions
  insufficientPermission: string;
  // Roles
  roleAdmin: string;
  roleEditor: string;
  roleContributor: string;
  roleViewer: string;
}

export interface InviteFormViewProps {
  translations: InviteFormViewTranslations;
}

interface FormState {
  organizations: readonly OrganizationPreview[];
  selectedOrgId: OrganizationId | null;
  canInvite: boolean;
  loading: boolean;
  error: boolean;
}

interface FormData {
  credential: string;
  role: OrganizationRole;
  message: string;
}

export function InviteFormView({ translations: t }: InviteFormViewProps): ReactElement {
  const router = useRouter();
  const { isConnected, selectedAccount } = useSigner();

  const [state, setState] = useState<FormState>({
    organizations: [],
    selectedOrgId: null,
    canInvite: false,
    loading: true,
    error: false,
  });

  const [formData, setFormData] = useState<FormData>({
    credential: '',
    role: 'contributor',
    message: '',
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

  // Check permissions when selectedOrgId changes
  useEffect(() => {
    if (!state.selectedOrgId || !credential) {
      if (state.selectedOrgId === null && state.organizations.length === 0) {
        setState((prev) => ({ ...prev, loading: false }));
      }
      return;
    }

    let isActive = true;

    const checkPermissions = async (): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true, error: false }));

      try {
        const orgId = state.selectedOrgId;
        if (!orgId) return;

        const canInvite = await organizationService.hasPermission(
          orgId,
          credential,
          'members:invite'
        );

        if (!isActive) return;

        setState((prev) => ({
          ...prev,
          canInvite,
          loading: false,
          error: false,
        }));
      } catch {
        if (isActive) {
          setState((prev) => ({ ...prev, loading: false, error: true }));
        }
      }
    };

    void checkPermissions();

    return () => {
      isActive = false;
    };
  }, [state.selectedOrgId, credential, state.organizations.length]);

  const handleSubmit = useCallback(
    async (e: FormEvent): Promise<void> => {
      e.preventDefault();
      if (!state.selectedOrgId || !state.canInvite) return;

      setSubmitting(true);
      setSubmitError(null);

      try {
        const inviteeCredential = createDIMCredential(formData.credential);

        const result = await organizationService.inviteMember(
          state.selectedOrgId,
          inviteeCredential,
          formData.role,
          formData.message || undefined
        );

        if (result.ok) {
          setSubmitSuccess(true);
          // Redirect after brief delay
          setTimeout(() => {
            router.push('/newsroom/team');
          }, 1500);
        } else {
          setSubmitError(result.error);
        }
      } catch {
        setSubmitError('Failed to send invitation');
      } finally {
        setSubmitting(false);
      }
    },
    [state.selectedOrgId, state.canInvite, formData, router]
  );

  // Show sign-in required message
  if (!isConnected || !selectedAccount) {
    return (
      <EmptyState
        title={t.signInRequired}
        description="Connect your wallet to invite team members."
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
  if (!state.canInvite) {
    return (
      <EmptyState
        title={t.insufficientPermission}
        description="You don't have permission to invite team members."
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
        <p className="mt-2 text-sm text-[var(--fg-secondary)]">Redirecting to team...</p>
      </div>
    );
  }

  const roleOptions: { value: OrganizationRole; label: string }[] = [
    { value: 'admin', label: t.roleAdmin },
    { value: 'editor', label: t.roleEditor },
    { value: 'contributor', label: t.roleContributor },
    { value: 'viewer', label: t.roleViewer },
  ];

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      {/* Credential */}
      <div>
        <label
          htmlFor="credential"
          className="mb-2 block text-sm font-medium text-[var(--fg-primary)]"
        >
          {t.credential}
        </label>
        <input
          type="text"
          id="credential"
          value={formData.credential}
          onChange={(e) => setFormData((prev) => ({ ...prev, credential: e.target.value }))}
          placeholder={t.credentialPlaceholder}
          required
          className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] px-4 py-2 text-[var(--fg-primary)] placeholder-[var(--fg-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
        />
      </div>

      {/* Role */}
      <div>
        <label htmlFor="role" className="mb-2 block text-sm font-medium text-[var(--fg-primary)]">
          {t.role}
        </label>
        <select
          id="role"
          value={formData.role}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, role: e.target.value as OrganizationRole }))
          }
          className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] px-4 py-2 text-[var(--fg-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
        >
          {roleOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Message */}
      <div>
        <label
          htmlFor="message"
          className="mb-2 block text-sm font-medium text-[var(--fg-primary)]"
        >
          {t.message}
        </label>
        <textarea
          id="message"
          value={formData.message}
          onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
          placeholder={t.messagePlaceholder}
          rows={3}
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
        {submitting ? t.sending : t.send}
      </button>
    </form>
  );
}
