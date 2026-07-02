'use client';

/**
 * NewProposalView — Form for creating governance proposals.
 *
 * Shows type-specific fields based on selected proposal type.
 */

import type { ReactElement, FormEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { AllianceProposalType } from '@cocuyo/types';
import { createPolkadotAddress, createPoolId, createOutletId } from '@cocuyo/types';
import { useSigner } from '@/hooks';
import { EmptyState } from '@cocuyo/ui';
import { getAllianceGovernanceService } from '@/lib/services/alliance-governance-service';

interface NewProposalViewTranslations {
  // Form fields
  typeLabel: string;
  titleLabel: string;
  titlePlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  submit: string;
  submitting: string;
  success: string;
  // Types
  typeOutletAdd: string;
  typeOutletRemove: string;
  typeWeightChange: string;
  typeParameterChange: string;
  typeEmergency: string;
  // Outlet Add fields
  outletAddTitle: string;
  outletIdLabel: string;
  outletIdPlaceholder: string;
  outletNameLabel: string;
  outletNamePlaceholder: string;
  treasuryLabel: string;
  treasuryPlaceholder: string;
  weightLabel: string;
  weightHelp: string;
  rationaleLabel: string;
  rationalePlaceholder: string;
  // Outlet Remove fields
  outletRemoveTitle: string;
  outletToRemoveLabel: string;
  removalReasonLabel: string;
  removalReasonPlaceholder: string;
  // Weight Change fields
  weightChangeTitle: string;
  weightChangeDescription: string;
  newWeightsLabel: string;
  weightRationaleLabel: string;
  weightRationalePlaceholder: string;
  // Parameter Change fields
  parameterChangeTitle: string;
  parameterLabel: string;
  currentValueLabel: string;
  newValueLabel: string;
  parameterRationaleLabel: string;
  parameterRationalePlaceholder: string;
  // Emergency fields
  emergencyTitle: string;
  emergencyWarning: string;
  actionLabel: string;
  emergencyDescriptionLabel: string;
  emergencyDescriptionPlaceholder: string;
  // Access
  signInRequired: string;
  tierRequired: string;
}

export interface NewProposalViewProps {
  translations: NewProposalViewTranslations;
}

const PROPOSAL_TYPES: AllianceProposalType[] = [
  'outlet-add',
  'outlet-remove',
  'weight-change',
  'parameter-change',
  'emergency',
];

const DEFAULT_POOL_ID = createPoolId('alliance-main');

export function NewProposalView({ translations: t }: NewProposalViewProps): ReactElement {
  const router = useRouter();
  const { isConnected, selectedAccount } = useSigner();

  const [canCreate, setCanCreate] = useState(false);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [proposalType, setProposalType] = useState<AllianceProposalType>('outlet-add');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Outlet Add fields
  const [outletId, setOutletId] = useState('');
  const [outletName, setOutletName] = useState('');
  const [treasuryAddress, setTreasuryAddress] = useState('');
  const [initialWeight, setInitialWeight] = useState('5000');

  // Outlet Remove fields
  const [removeOutletId, setRemoveOutletId] = useState('');

  // Parameter Change fields
  const [parameterKey, setParameterKey] = useState('');
  const [parameterValue, setParameterValue] = useState('');

  // Emergency fields
  const [emergencyAction, setEmergencyAction] = useState('');

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

  // Check if user can create proposals
  useEffect(() => {
    let isActive = true;

    const checkPermission = async (): Promise<void> => {
      if (!isConnected || selectedAccount?.address == null || selectedAccount.address === '') {
        if (isActive) {
          setCanCreate(false);
          setChecking(false);
        }
        return;
      }

      try {
        const address = createPolkadotAddress(selectedAccount.address);
        const allowed = await getAllianceGovernanceService().canCreateProposal(
          address,
          DEFAULT_POOL_ID
        );
        if (isActive) {
          setCanCreate(allowed);
          setChecking(false);
        }
      } catch {
        if (isActive) {
          setCanCreate(false);
          setChecking(false);
        }
      }
    };

    void checkPermission();

    return () => {
      isActive = false;
    };
  }, [isConnected, selectedAccount?.address]);

  // Build payload based on type
  const buildPayload = useCallback((): import('@cocuyo/types').AllianceProposalPayload => {
    switch (proposalType) {
      case 'outlet-add':
        return {
          type: 'outlet-add',
          outletId: createOutletId(outletId),
          outletName,
          treasury: treasuryAddress as import('@cocuyo/types').TreasuryId,
          initialWeight: parseInt(initialWeight, 10),
          rationale: description,
        };
      case 'outlet-remove':
        return {
          type: 'outlet-remove',
          outletId: createOutletId(removeOutletId),
          reason: description,
        };
      case 'weight-change':
        // For simplicity, use description as rationale
        // Real implementation would have weight editing UI
        return {
          type: 'weight-change',
          newWeights: [],
          rationale: description,
        };
      case 'parameter-change':
        return {
          type: 'parameter-change',
          parameter: parameterKey as import('@cocuyo/types').PoolParameter,
          oldValue: '',
          newValue: parameterValue,
          rationale: description,
        };
      case 'emergency':
        return {
          type: 'emergency',
          action: emergencyAction as import('@cocuyo/types').EmergencyAction,
          description,
        };
    }
  }, [
    proposalType,
    outletId,
    outletName,
    treasuryAddress,
    initialWeight,
    removeOutletId,
    parameterKey,
    parameterValue,
    emergencyAction,
    description,
  ]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: FormEvent): Promise<void> => {
      e.preventDefault();
      if (!isConnected || selectedAccount?.address == null || selectedAccount.address === '')
        return;

      setSubmitting(true);
      setError(null);

      try {
        const result = await getAllianceGovernanceService().createProposal({
          poolId: DEFAULT_POOL_ID,
          title,
          description,
          payload: buildPayload(),
        });

        if (result.ok) {
          router.push(`/alliance/governance/proposal/${result.value}`);
        } else {
          setError(result.error.type);
          setSubmitting(false);
        }
      } catch {
        setError('UNKNOWN_ERROR');
        setSubmitting(false);
      }
    },
    [isConnected, selectedAccount?.address, proposalType, title, description, buildPayload, router]
  );

  if (checking) {
    return (
      <div className="py-16 text-center">
        <div className="text-[var(--fg-tertiary)]">Loading...</div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="py-16">
        <EmptyState title={t.signInRequired} />
      </div>
    );
  }

  if (!canCreate) {
    return (
      <div className="py-16">
        <EmptyState title={t.tierRequired} />
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="space-y-6"
    >
      {/* Proposal Type */}
      <div>
        <label
          htmlFor="proposalType"
          className="mb-2 block text-sm font-medium text-[var(--fg-primary)]"
        >
          {t.typeLabel}
        </label>
        <select
          id="proposalType"
          value={proposalType}
          onChange={(e) => setProposalType(e.target.value as AllianceProposalType)}
          className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-4 py-3 text-[var(--fg-primary)] focus:border-[var(--border-emphasis)] focus:outline-none"
        >
          {PROPOSAL_TYPES.map((type) => (
            <option key={type} value={type}>
              {getTypeName(type)}
            </option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div>
        <label htmlFor="title" className="mb-2 block text-sm font-medium text-[var(--fg-primary)]">
          {t.titleLabel}
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.titlePlaceholder}
          required
          className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-4 py-3 text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] focus:border-[var(--border-emphasis)] focus:outline-none"
        />
      </div>

      {/* Type-specific fields */}
      {proposalType === 'outlet-add' && (
        <div className="space-y-4 rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4">
          <h3 className="text-sm font-medium text-[var(--fg-secondary)]">{t.outletAddTitle}</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="outletId" className="mb-2 block text-sm text-[var(--fg-secondary)]">
                {t.outletIdLabel}
              </label>
              <input
                id="outletId"
                type="text"
                value={outletId}
                onChange={(e) => setOutletId(e.target.value)}
                placeholder={t.outletIdPlaceholder}
                required
                className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-3 py-2 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] focus:border-[var(--border-emphasis)] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="outletName" className="mb-2 block text-sm text-[var(--fg-secondary)]">
                {t.outletNameLabel}
              </label>
              <input
                id="outletName"
                type="text"
                value={outletName}
                onChange={(e) => setOutletName(e.target.value)}
                placeholder={t.outletNamePlaceholder}
                required
                className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-3 py-2 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] focus:border-[var(--border-emphasis)] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="treasuryAddress"
              className="mb-2 block text-sm text-[var(--fg-secondary)]"
            >
              {t.treasuryLabel}
            </label>
            <input
              id="treasuryAddress"
              type="text"
              value={treasuryAddress}
              onChange={(e) => setTreasuryAddress(e.target.value)}
              placeholder={t.treasuryPlaceholder}
              required
              className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-3 py-2 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] focus:border-[var(--border-emphasis)] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="initialWeight"
              className="mb-2 block text-sm text-[var(--fg-secondary)]"
            >
              {t.weightLabel}
            </label>
            <input
              id="initialWeight"
              type="number"
              value={initialWeight}
              onChange={(e) => setInitialWeight(e.target.value)}
              min="1"
              max="10000"
              required
              className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:border-[var(--border-emphasis)] focus:outline-none"
            />
            <p className="mt-1 text-xs text-[var(--fg-tertiary)]">{t.weightHelp}</p>
          </div>
        </div>
      )}

      {proposalType === 'outlet-remove' && (
        <div className="space-y-4 rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4">
          <h3 className="text-sm font-medium text-[var(--fg-secondary)]">{t.outletRemoveTitle}</h3>

          <div>
            <label
              htmlFor="removeOutletId"
              className="mb-2 block text-sm text-[var(--fg-secondary)]"
            >
              {t.outletToRemoveLabel}
            </label>
            <input
              id="removeOutletId"
              type="text"
              value={removeOutletId}
              onChange={(e) => setRemoveOutletId(e.target.value)}
              placeholder={t.outletIdPlaceholder}
              required
              className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-3 py-2 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] focus:border-[var(--border-emphasis)] focus:outline-none"
            />
          </div>
        </div>
      )}

      {proposalType === 'parameter-change' && (
        <div className="space-y-4 rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4">
          <h3 className="text-sm font-medium text-[var(--fg-secondary)]">
            {t.parameterChangeTitle}
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="parameterKey"
                className="mb-2 block text-sm text-[var(--fg-secondary)]"
              >
                {t.parameterLabel}
              </label>
              <input
                id="parameterKey"
                type="text"
                value={parameterKey}
                onChange={(e) => setParameterKey(e.target.value)}
                required
                className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:border-[var(--border-emphasis)] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="parameterValue"
                className="mb-2 block text-sm text-[var(--fg-secondary)]"
              >
                {t.newValueLabel}
              </label>
              <input
                id="parameterValue"
                type="text"
                value={parameterValue}
                onChange={(e) => setParameterValue(e.target.value)}
                required
                className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:border-[var(--border-emphasis)] focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {proposalType === 'emergency' && (
        <div className="space-y-4 rounded-nested border border-red-500/20 bg-red-500/5 p-4">
          <h3 className="text-sm font-medium text-red-400">{t.emergencyTitle}</h3>
          <p className="text-sm text-red-300">{t.emergencyWarning}</p>

          <div>
            <label
              htmlFor="emergencyAction"
              className="mb-2 block text-sm text-[var(--fg-secondary)]"
            >
              {t.actionLabel}
            </label>
            <input
              id="emergencyAction"
              type="text"
              value={emergencyAction}
              onChange={(e) => setEmergencyAction(e.target.value)}
              required
              className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:border-[var(--border-emphasis)] focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Description */}
      <div>
        <label
          htmlFor="description"
          className="mb-2 block text-sm font-medium text-[var(--fg-primary)]"
        >
          {t.descriptionLabel}
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t.descriptionPlaceholder}
          required
          rows={6}
          className="w-full resize-none rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-4 py-3 text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] focus:border-[var(--border-emphasis)] focus:outline-none"
        />
      </div>

      {/* Error */}
      {error != null && error !== '' && (
        <div className="rounded-nested border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-nested bg-[var(--color-firefly-gold)] px-6 py-3 font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? t.submitting : t.submit}
      </button>
    </form>
  );
}
