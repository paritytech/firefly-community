'use client';

/**
 * SettingsView — Organization configuration.
 *
 * View and edit organization settings, governance rules, and treasury config.
 */

import type { ReactElement } from 'react';
import { useState, useEffect } from 'react';
import type {
  OrganizationPreview,
  Organization,
  OrganizationId,
  TreasuryConfig,
  DIMCredential,
} from '@cocuyo/types';
import { deriveCredentialFromString, createTreasuryId, formatPUSD, ZERO_PUSD } from '@cocuyo/types';
import { useSigner } from '@/hooks';
import { EmptyState } from '@cocuyo/ui';
import { organizationService } from '@/lib/services/organization-service';
import { treasuryService } from '@/lib/services/treasury-service';

interface SettingsViewTranslations {
  signInRequired: string;
  noAccess: string;
  // Sections
  general: string;
  generalDescription: string;
  treasury: string;
  treasuryDescription: string;
  governance: string;
  governanceDescription: string;
  // General fields
  name: string;
  description: string;
  mission: string;
  // Treasury fields
  signers: string;
  threshold: string;
  thresholdHelp: string;
  limits: string;
  perTransaction: string;
  daily: string;
  // Actions
  save: string;
  saving: string;
  saved: string;
  // Permissions
  insufficientPermission: string;
}

export interface SettingsViewProps {
  translations: SettingsViewTranslations;
}

interface SettingsState {
  organizations: readonly OrganizationPreview[];
  selectedOrgId: OrganizationId | null;
  organization: Organization | null;
  treasuryConfig: TreasuryConfig | null;
  canEdit: boolean;
  loading: boolean;
  error: boolean;
}

export function SettingsView({ translations: t }: SettingsViewProps): ReactElement {
  const { isConnected, selectedAccount } = useSigner();

  const [state, setState] = useState<SettingsState>({
    organizations: [],
    selectedOrgId: null,
    organization: null,
    treasuryConfig: null,
    canEdit: false,
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

  // Load settings when selectedOrgId changes
  useEffect(() => {
    if (!state.selectedOrgId || !credential) {
      if (state.selectedOrgId === null && state.organizations.length === 0) {
        setState((prev) => ({ ...prev, loading: false }));
      }
      return;
    }

    let isActive = true;

    const loadSettings = async (): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true, error: false }));

      try {
        const orgId = state.selectedOrgId;
        if (!orgId) return;

        // Get organization details
        const organization = await organizationService.getOrganization(orgId);

        // Derive treasury ID from organization ID
        const treasuryId = createTreasuryId(`treasury-${orgId}`);

        // Get treasury config
        const treasuryConfig = await treasuryService.getTreasuryConfig(treasuryId);

        // Check if user can edit settings
        const canEdit = await organizationService.hasPermission(orgId, credential, 'settings:edit');

        if (!isActive) return;

        setState((prev) => ({
          ...prev,
          organization,
          treasuryConfig,
          canEdit,
          loading: false,
          error: false,
        }));
      } catch {
        if (isActive) {
          setState((prev) => ({ ...prev, loading: false, error: true }));
        }
      }
    };

    void loadSettings();

    return () => {
      isActive = false;
    };
  }, [state.selectedOrgId, credential, state.organizations.length]);

  // Show sign-in required message
  if (!isConnected || !selectedAccount) {
    return (
      <EmptyState title={t.signInRequired} description="Connect your wallet to view settings." />
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
        <div className="text-[var(--fg-error)]">Failed to load settings</div>
      </div>
    );
  }

  const { organization, treasuryConfig, canEdit } = state;

  if (!organization) {
    return (
      <div className="py-16 text-center">
        <div className="text-[var(--fg-tertiary)]">Organization not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* General section */}
      <section className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium text-[var(--fg-primary)]">{t.general}</h2>
          <p className="text-sm text-[var(--fg-tertiary)]">{t.generalDescription}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--fg-secondary)]">
              {t.name}
            </label>
            <div className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-4 py-2 text-[var(--fg-primary)]">
              {organization.name}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--fg-secondary)]">
              {t.description}
            </label>
            <div className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-4 py-2 text-[var(--fg-primary)]">
              {organization.description}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--fg-secondary)]">
              {t.mission}
            </label>
            <div className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-4 py-2 text-[var(--fg-primary)]">
              {organization.mission}
            </div>
          </div>

          {!canEdit && (
            <p className="text-xs text-[var(--fg-tertiary)]">{t.insufficientPermission}</p>
          )}
        </div>
      </section>

      {/* Treasury configuration */}
      {treasuryConfig && (
        <section className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
          <div className="mb-4">
            <h2 className="text-lg font-medium text-[var(--fg-primary)]">{t.treasury}</h2>
            <p className="text-sm text-[var(--fg-tertiary)]">{t.treasuryDescription}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--fg-secondary)]">
                {t.signers}
              </label>
              <div className="space-y-2">
                {treasuryConfig.signers.map((signer, idx) => (
                  <div
                    key={idx}
                    className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-4 py-2 font-mono text-sm text-[var(--fg-primary)]"
                  >
                    {signer.slice(0, 16)}...{signer.slice(-8)}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--fg-secondary)]">
                {t.threshold}
              </label>
              <div className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-4 py-2 text-[var(--fg-primary)]">
                {treasuryConfig.multisigThreshold} of {treasuryConfig.signers.length}
              </div>
              <p className="mt-1 text-xs text-[var(--fg-tertiary)]">{t.thresholdHelp}</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--fg-secondary)]">
                {t.limits}
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-[var(--fg-tertiary)]">{t.perTransaction}</p>
                  <div className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-4 py-2 font-mono text-sm text-[var(--fg-primary)]">
                    {formatPUSD(treasuryConfig.perTransactionLimit ?? ZERO_PUSD)}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[var(--fg-tertiary)]">{t.daily}</p>
                  <div className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-4 py-2 font-mono text-sm text-[var(--fg-primary)]">
                    {formatPUSD(treasuryConfig.dailyLimit ?? ZERO_PUSD)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Governance section */}
      <section className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium text-[var(--fg-primary)]">{t.governance}</h2>
          <p className="text-sm text-[var(--fg-tertiary)]">{t.governanceDescription}</p>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--fg-secondary)]">
                Proposal Threshold
              </label>
              <div className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-4 py-2 text-[var(--fg-primary)]">
                {organization.governance.proposalThreshold}%
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--fg-secondary)]">
                Treasury Threshold
              </label>
              <div className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-4 py-2 text-[var(--fg-primary)]">
                {organization.governance.treasuryThreshold} of{' '}
                {organization.governance.treasurySigners}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--fg-secondary)]">
                Proposal Duration
              </label>
              <div className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-4 py-2 text-[var(--fg-primary)]">
                {Math.floor(organization.governance.proposalDurationMs / (24 * 60 * 60 * 1000))}{' '}
                days
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--fg-secondary)]">
                Min Votes for Proposal
              </label>
              <div className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-4 py-2 text-[var(--fg-primary)]">
                {organization.governance.minVotesForProposal}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
