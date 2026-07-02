'use client';

/**
 * TeamListView — Display and manage organization team members.
 *
 * Shows members with role management and pending invitations.
 */

import type { ReactElement } from 'react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type {
  OrganizationPreview,
  OrganizationId,
  OrganizationMember,
  OrganizationInvitation,
  OrganizationRole,
  DIMCredential,
} from '@cocuyo/types';
import { deriveCredentialFromString } from '@cocuyo/types';
import { useSigner } from '@/hooks';
import { EmptyState } from '@cocuyo/ui';
import { organizationService } from '@/lib/services/organization-service';

interface TeamListViewTranslations {
  signInRequired: string;
  noAccess: string;
  // Team
  members: string;
  invitations: string;
  invite: string;
  noMembers: string;
  noInvitations: string;
  role: string;
  joinedAt: string;
  status: string;
  active: string;
  suspended: string;
  pending: string;
  changeRole: string;
  remove: string;
  revokeInvite: string;
  // Roles
  roleOwner: string;
  roleAdmin: string;
  roleEditor: string;
  roleContributor: string;
  roleViewer: string;
  // Permissions
  insufficientPermission: string;
}

export interface TeamListViewProps {
  translations: TeamListViewTranslations;
}

interface TeamState {
  organizations: readonly OrganizationPreview[];
  selectedOrgId: OrganizationId | null;
  members: readonly OrganizationMember[];
  invitations: readonly OrganizationInvitation[];
  canInvite: boolean;
  canChangeRoles: boolean;
  canRemove: boolean;
  loading: boolean;
  error: boolean;
}

export function TeamListView({ translations: t }: TeamListViewProps): ReactElement {
  const { isConnected, selectedAccount } = useSigner();

  const [state, setState] = useState<TeamState>({
    organizations: [],
    selectedOrgId: null,
    members: [],
    invitations: [],
    canInvite: false,
    canChangeRoles: false,
    canRemove: false,
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

  // Load team data when selectedOrgId changes
  useEffect(() => {
    if (!state.selectedOrgId || !credential) {
      if (state.selectedOrgId === null && state.organizations.length === 0) {
        setState((prev) => ({ ...prev, loading: false }));
      }
      return;
    }

    let isActive = true;

    const loadTeamData = async (): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true, error: false }));

      try {
        const orgId = state.selectedOrgId;
        if (!orgId) return;

        // Get organization with members
        const org = await organizationService.getOrganization(orgId);

        // Get pending invitations for the organization
        // Note: This would need admin access - for now we'll show empty if no permission
        let invitations: readonly OrganizationInvitation[] = [];
        try {
          // This is a simplified approach - in reality you'd need an org-level query
          invitations = await organizationService.getPendingInvitations(credential);
          // Filter to only show invitations for this org
          invitations = invitations.filter((inv) => inv.organizationId === orgId);
        } catch {
          // Ignore - user may not have permission
        }

        // Check permissions
        const [canInvite, canChangeRoles, canRemove] = await Promise.all([
          organizationService.hasPermission(orgId, credential, 'members:invite'),
          organizationService.hasPermission(orgId, credential, 'members:role-change'),
          organizationService.hasPermission(orgId, credential, 'members:remove'),
        ]);

        if (!isActive) return;

        setState((prev) => ({
          ...prev,
          members: org?.members ?? [],
          invitations,
          canInvite,
          canChangeRoles,
          canRemove,
          loading: false,
          error: false,
        }));
      } catch {
        if (isActive) {
          setState((prev) => ({ ...prev, loading: false, error: true }));
        }
      }
    };

    void loadTeamData();

    return () => {
      isActive = false;
    };
  }, [state.selectedOrgId, credential, state.organizations.length]);

  const handleChangeRole = useCallback(
    async (memberCredential: DIMCredential, newRole: OrganizationRole): Promise<void> => {
      if (!state.selectedOrgId) return;
      setActionLoading(memberCredential);
      try {
        const result = await organizationService.updateMemberRole(
          state.selectedOrgId,
          memberCredential,
          newRole
        );
        if (result.ok) {
          // Reload team data
          const org = await organizationService.getOrganization(state.selectedOrgId);
          setState((prev) => ({ ...prev, members: org?.members ?? [] }));
        }
      } finally {
        setActionLoading(null);
      }
    },
    [state.selectedOrgId]
  );

  const handleRemove = useCallback(
    async (memberCredential: DIMCredential): Promise<void> => {
      if (!state.selectedOrgId) return;
      setActionLoading(memberCredential);
      try {
        const result = await organizationService.removeMember(
          state.selectedOrgId,
          memberCredential
        );
        if (result.ok) {
          // Reload team data
          const org = await organizationService.getOrganization(state.selectedOrgId);
          setState((prev) => ({ ...prev, members: org?.members ?? [] }));
        }
      } finally {
        setActionLoading(null);
      }
    },
    [state.selectedOrgId]
  );

  // Show sign-in required message
  if (!isConnected || !selectedAccount) {
    return (
      <EmptyState
        title={t.signInRequired}
        description="Connect your wallet to view team members."
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
        <div className="text-[var(--fg-error)]">Failed to load team data</div>
      </div>
    );
  }

  const { members, invitations, canInvite, canChangeRoles, canRemove } = state;

  const roleLabels: Record<OrganizationRole, string> = {
    owner: t.roleOwner,
    admin: t.roleAdmin,
    editor: t.roleEditor,
    contributor: t.roleContributor,
    viewer: t.roleViewer,
  };

  const statusColors: Record<string, string> = {
    active: 'text-[var(--fg-success)]',
    suspended: 'text-[var(--fg-error)]',
    pending: 'text-[var(--fg-warning)]',
  };

  const statusLabels: Record<string, string> = {
    active: t.active,
    suspended: t.suspended,
    pending: t.pending,
  };

  return (
    <div className="space-y-8">
      {/* Invite button */}
      {canInvite && (
        <div className="flex justify-end">
          <Link
            href="/newsroom/team/invite"
            className="rounded-nested bg-[var(--accent-primary)] px-6 py-2 text-sm font-medium text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-primary-hover)]"
          >
            {t.invite}
          </Link>
        </div>
      )}

      {/* Members section */}
      <div>
        <h2 className="mb-4 text-lg font-medium text-[var(--fg-primary)]">{t.members}</h2>

        {members.length === 0 ? (
          <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-8 text-center">
            <p className="text-[var(--fg-tertiary)]">{t.noMembers}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-container border border-[var(--border-default)]">
            <table className="w-full">
              <thead className="bg-[var(--bg-surface-container)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--fg-tertiary)]">
                    Member
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--fg-tertiary)]">
                    {t.role}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--fg-tertiary)]">
                    {t.status}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--fg-tertiary)]">
                    {t.joinedAt}
                  </th>
                  {(canChangeRoles || canRemove) && (
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--fg-tertiary)]">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)] bg-[var(--bg-surface-nested)]">
                {members.map((member) => (
                  <tr key={member.credentialHash}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--fg-primary)]">
                          {member.pseudonym}
                        </p>
                        <p className="font-mono text-xs text-[var(--fg-tertiary)]">
                          {member.credentialHash.slice(0, 12)}...
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--fg-primary)]">
                      {canChangeRoles && member.role !== 'owner' ? (
                        <select
                          value={member.role}
                          onChange={(e) =>
                            void handleChangeRole(
                              member.credentialHash,
                              e.target.value as OrganizationRole
                            )
                          }
                          disabled={actionLoading === member.credentialHash}
                          className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-2 py-1 text-sm"
                        >
                          <option value="admin">{t.roleAdmin}</option>
                          <option value="editor">{t.roleEditor}</option>
                          <option value="contributor">{t.roleContributor}</option>
                          <option value="viewer">{t.roleViewer}</option>
                        </select>
                      ) : (
                        roleLabels[member.role]
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm ${statusColors[member.status] ?? 'text-[var(--fg-tertiary)]'}`}
                    >
                      {statusLabels[member.status] ?? member.status}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--fg-tertiary)]">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </td>
                    {(canChangeRoles || canRemove) && (
                      <td className="px-4 py-3">
                        {canRemove && member.role !== 'owner' && (
                          <button
                            onClick={() => void handleRemove(member.credentialHash)}
                            disabled={actionLoading === member.credentialHash}
                            className="rounded-nested border border-[var(--border-error)] px-3 py-1 text-xs font-medium text-[var(--fg-error)] transition-colors hover:bg-[var(--bg-error)] disabled:opacity-50"
                          >
                            {t.remove}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending invitations section */}
      <div>
        <h2 className="mb-4 text-lg font-medium text-[var(--fg-primary)]">{t.invitations}</h2>

        {invitations.length === 0 ? (
          <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-8 text-center">
            <p className="text-[var(--fg-tertiary)]">{t.noInvitations}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4"
              >
                <div>
                  <p className="font-mono text-sm text-[var(--fg-primary)]">
                    {inv.invitee.slice(0, 16)}...
                  </p>
                  <p className="text-xs text-[var(--fg-tertiary)]">
                    {roleLabels[inv.proposedRole]} • Expires{' '}
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                {canInvite && (
                  <button className="rounded-nested border border-[var(--border-default)] px-3 py-1 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-surface-container)]">
                    {t.revokeInvite}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
