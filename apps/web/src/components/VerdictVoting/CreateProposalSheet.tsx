'use client';

/**
 * CreateProposalSheet — Modal sheet for creating a new verdict proposal.
 *
 * Allows collective members to propose a verdict status and rationale.
 */

import { useState, type ReactElement, type FormEvent } from 'react';
import type { ClaimId, CollectiveId, VerdictStatus, CollectivePreview } from '@cocuyo/types';
import { VoteButtons } from './VoteButtons';

export interface CreateProposalSheetProps {
  /** The claim to propose a verdict for */
  claimId: ClaimId;
  /** The claim statement for context */
  claimStatement: string;
  /** Available collectives the user is a member of */
  collectives: readonly CollectivePreview[];
  /** Called when proposal is submitted */
  onSubmit: (params: {
    claimId: ClaimId;
    collectiveId: CollectiveId;
    proposedStatus: VerdictStatus;
    rationale: string;
  }) => Promise<void>;
  /** Called when sheet is closed */
  onClose: () => void;
  /** Whether submission is in progress */
  loading?: boolean;
  /** Translations */
  translations?: {
    title?: string;
    claimLabel?: string;
    collectiveLabel?: string;
    verdictLabel?: string;
    rationaleLabel?: string;
    rationalePlaceholder?: string;
    submit?: string;
    cancel?: string;
    selectCollective?: string;
    selectVerdict?: string;
  };
}

export function CreateProposalSheet({
  claimId,
  claimStatement,
  collectives,
  onSubmit,
  onClose,
  loading = false,
  translations: t = {},
}: CreateProposalSheetProps): ReactElement {
  const [selectedCollective, setSelectedCollective] = useState<CollectiveId | null>(
    collectives.length === 1 ? (collectives[0]?.id ?? null) : null
  );
  const [selectedStatus, setSelectedStatus] = useState<VerdictStatus | null>(null);
  const [rationale, setRationale] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!selectedCollective) {
      setError(t.selectCollective ?? 'Please select a collective');
      return;
    }

    if (!selectedStatus) {
      setError(t.selectVerdict ?? 'Please select a verdict');
      return;
    }

    if (rationale.trim().length < 10) {
      setError('Please provide a rationale (at least 10 characters)');
      return;
    }

    try {
      await onSubmit({
        claimId,
        collectiveId: selectedCollective,
        proposedStatus: selectedStatus,
        rationale: rationale.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create proposal');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-auto rounded-t-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] sm:rounded-2xl">
        {/* Header */}
        <div className="sticky top-0 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-medium text-[var(--fg-primary)]">
              {t.title ?? 'Propose Verdict'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-[var(--fg-tertiary)] transition-colors hover:text-[var(--fg-primary)]"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6 p-6">
          {/* Claim context */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">
              {t.claimLabel ?? 'Claim'}
            </label>
            <blockquote className="border-l-2 border-[var(--border-emphasis)] pl-3 text-sm text-[var(--fg-primary)]">
              &ldquo;{claimStatement}&rdquo;
            </blockquote>
          </div>

          {/* Collective selection */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">
              {t.collectiveLabel ?? 'Collective'}
            </label>
            {collectives.length === 1 ? (
              <div className="text-sm text-[var(--fg-primary)]">{collectives[0]?.name}</div>
            ) : (
              <select
                value={selectedCollective ?? ''}
                onChange={(e) => setSelectedCollective(e.target.value as CollectiveId)}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-default)] px-3 py-2 text-sm text-[var(--fg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-firefly-gold)]"
              >
                <option value="">{t.selectCollective ?? 'Select a collective...'}</option>
                {collectives.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Verdict selection */}
          <div>
            <label className="mb-3 block text-sm font-medium text-[var(--fg-secondary)]">
              {t.verdictLabel ?? 'Proposed Verdict'}
            </label>
            <VoteButtons
              onVote={setSelectedStatus}
              currentVote={selectedStatus ?? undefined}
              disabled={loading}
            />
          </div>

          {/* Rationale */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">
              {t.rationaleLabel ?? 'Rationale'}
            </label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder={t.rationalePlaceholder ?? 'Explain why this verdict is appropriate...'}
              className="h-24 w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-default)] px-3 py-2 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-firefly-gold)]"
              disabled={loading}
            />
          </div>

          {/* Error message */}
          {error != null && error !== '' && (
            <div className="bg-[var(--fg-error)]/10 rounded-lg px-3 py-2 text-sm text-[var(--fg-error)]">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-default)] px-4 py-2.5 text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-surface-nested)]"
            >
              {t.cancel ?? 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={
                loading || !selectedCollective || !selectedStatus || rationale.trim().length < 10
              }
              className="flex-1 rounded-lg bg-[var(--color-firefly-gold)] px-4 py-2.5 text-sm font-medium text-[var(--bg-default)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Creating...
                </span>
              ) : (
                (t.submit ?? 'Create Proposal')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
