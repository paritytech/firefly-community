'use client';

/**
 * ProposalDetailView — Full proposal details with voting UI.
 */

import type { ReactElement, FormEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type {
  AllianceProposal,
  AllianceProposalType,
  AllianceProposalStatus,
  AllianceVoteDecision,
  AllianceVotingProgress,
} from '@cocuyo/types';
import { createPolkadotAddress } from '@cocuyo/types';
import { useSigner } from '@/hooks';
import { EmptyState } from '@cocuyo/ui';
import { getAllianceGovernanceService } from '@/lib/services/alliance-governance-service';
import { ProposalTypeIcon } from '../../components/ProposalTypeIcon';

interface ProposalDetailViewTranslations {
  // Proposal info
  votingPeriod: string;
  quorum: string;
  threshold: string;
  proposedBy: string;
  votingEnds: string;
  votingEnded: string;
  payload: string;
  // Voting
  castVote: string;
  approve: string;
  reject: string;
  abstain: string;
  yourVote: string;
  alreadyVoted: string;
  voteRationale: string;
  voteRationalePlaceholder: string;
  // Vote stats
  votes: string;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  totalWeight: string;
  quorumProgress: string;
  quorumReached: string;
  quorumNotReached: string;
  approvalProgress: string;
  // Actions
  execute: string;
  cancel: string;
  executionAvailable: string;
  timelockRemaining: string;
  // Types
  typeOutletAdd: string;
  typeOutletRemove: string;
  typeWeightChange: string;
  typeParameterChange: string;
  typeEmergency: string;
  // Status
  statusVoting: string;
  statusApproved: string;
  statusRejected: string;
  statusExpired: string;
  statusExecuted: string;
  // Errors
  notFound: string;
  signInRequired: string;
  insufficientTier: string;
  executionFailed: string;
}

export interface ProposalDetailViewProps {
  proposalId: string;
  translations: ProposalDetailViewTranslations;
}

interface DetailState {
  proposal: AllianceProposal | null;
  progress: AllianceVotingProgress | null;
  hasVoted: boolean;
  userVote: AllianceVoteDecision | null;
  votingPower: number;
  canVote: boolean;
  loading: boolean;
  error: boolean;
}

function getStatusColor(status: AllianceProposalStatus): string {
  switch (status) {
    case 'voting':
      return 'bg-[var(--color-firefly-gold)]/20 text-[var(--color-firefly-gold)]';
    case 'approved':
      return 'bg-green-500/20 text-green-400';
    case 'rejected':
      return 'bg-red-500/20 text-red-400';
    case 'expired':
      return 'bg-gray-500/20 text-gray-400';
    case 'executed':
      return 'bg-blue-500/20 text-blue-400';
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeRemaining(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff < 0) return 'Ended';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

export function ProposalDetailView({
  proposalId,
  translations: t,
}: ProposalDetailViewProps): ReactElement {
  const { isConnected, selectedAccount } = useSigner();

  const [state, setState] = useState<DetailState>({
    proposal: null,
    progress: null,
    hasVoted: false,
    userVote: null,
    votingPower: 0,
    canVote: false,
    loading: true,
    error: false,
  });

  const [voteDecision, setVoteDecision] = useState<AllianceVoteDecision | null>(null);
  const [rationale, setRationale] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const triggerReload = useCallback(() => setReloadKey((k) => k + 1), []);

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

  // Get status display name
  const getStatusName = useCallback(
    (status: AllianceProposalStatus): string => {
      switch (status) {
        case 'voting':
          return t.statusVoting;
        case 'approved':
          return t.statusApproved;
        case 'rejected':
          return t.statusRejected;
        case 'expired':
          return t.statusExpired;
        case 'executed':
          return t.statusExecuted;
      }
    },
    [t]
  );

  // Load proposal data
  useEffect(() => {
    let isActive = true;

    const loadData = async (): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true, error: false }));

      try {
        const [proposal, progress] = await Promise.all([
          getAllianceGovernanceService().getProposal(proposalId),
          getAllianceGovernanceService().getVotingProgress(proposalId),
        ]);

        if (!proposal) {
          if (isActive) {
            setState((prev) => ({ ...prev, loading: false, error: true }));
          }
          return;
        }

        let hasVoted = false;
        let userVote: AllianceVoteDecision | null = null;
        let votingPower = 0;
        let canVote = false;

        if (isConnected && selectedAccount?.address != null && selectedAccount.address !== '') {
          const address = createPolkadotAddress(selectedAccount.address);
          hasVoted = await getAllianceGovernanceService().hasVoted(proposalId, address);
          votingPower = await getAllianceGovernanceService().getVotingPower(address, proposalId);
          canVote = proposal.status === 'voting' && !hasVoted && votingPower > 0;

          // Find user's vote if they voted
          if (hasVoted) {
            const vote = proposal.votes.find(
              (v) => v.voterAddress.toLowerCase() === address.toLowerCase()
            );
            if (vote) {
              userVote = vote.decision;
            }
          }
        }

        if (!isActive) return;

        setState({
          proposal,
          progress,
          hasVoted,
          userVote,
          votingPower,
          canVote,
          loading: false,
          error: false,
        });
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
  }, [isConnected, selectedAccount?.address, proposalId, reloadKey]);

  // Handle vote submission
  const handleVote = useCallback(
    async (e: FormEvent): Promise<void> => {
      e.preventDefault();
      if (
        voteDecision === null ||
        !isConnected ||
        selectedAccount?.address == null ||
        selectedAccount.address === ''
      )
        return;

      setSubmitting(true);
      setVoteError(null);

      try {
        const result = await getAllianceGovernanceService().vote(proposalId, {
          decision: voteDecision,
          ...(rationale.trim() ? { rationale: rationale.trim() } : {}),
        });

        if (result.ok) {
          setVoteDecision(null);
          setRationale('');
          triggerReload();
        } else {
          setVoteError(result.error.type);
        }
      } catch {
        setVoteError('UNKNOWN_ERROR');
      } finally {
        setSubmitting(false);
      }
    },
    [proposalId, voteDecision, rationale, isConnected, selectedAccount?.address, triggerReload]
  );

  // Handle execution
  const handleExecute = useCallback(async (): Promise<void> => {
    setSubmitting(true);
    setVoteError(null);

    try {
      const result = await getAllianceGovernanceService().executeProposal(proposalId);

      if (result.ok) {
        triggerReload();
      } else {
        setVoteError(result.error.type);
      }
    } catch {
      setVoteError('EXECUTION_FAILED');
    } finally {
      setSubmitting(false);
    }
  }, [proposalId, triggerReload]);

  if (state.loading) {
    return (
      <div className="py-16 text-center">
        <div className="text-[var(--fg-tertiary)]">Loading...</div>
      </div>
    );
  }

  if (state.error || !state.proposal) {
    return (
      <div className="py-16">
        <EmptyState title={t.notFound} />
        <div className="mt-4 text-center">
          <Link
            href="/alliance/governance/proposals"
            className="text-sm text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
          >
            Back to Proposals
          </Link>
        </div>
      </div>
    );
  }

  const { proposal, progress } = state;
  const isVoting = proposal.status === 'voting';
  const canExecute =
    proposal.status === 'approved' &&
    (proposal.executionTxHash == null || proposal.executionTxHash === '');
  const votingEndsAt = new Date(proposal.expiresAt * 1000);

  // Extract weights from progress
  const forWeight = progress?.weightByDecision.approve ?? 0;
  const againstWeight = progress?.weightByDecision.reject ?? 0;
  const abstainWeight = progress?.weightByDecision.abstain ?? 0;
  const totalWeight = progress?.totalWeight ?? 0;
  const quorumPercent = progress
    ? Math.min((progress.totalWeight / progress.quorumRequired) * 100, 100)
    : 0;

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {/* Main content */}
      <div className="lg:col-span-2">
        {/* Proposal header */}
        <div className="mb-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {/* Type badge */}
            <span className="flex items-center gap-1 rounded-full bg-[var(--bg-surface-nested)] px-3 py-1 text-sm text-[var(--fg-tertiary)]">
              <ProposalTypeIcon type={proposal.proposalType} className="h-4 w-4" />
              {getTypeName(proposal.proposalType)}
            </span>
            {/* Status badge */}
            <span className={`rounded-full px-3 py-1 text-sm ${getStatusColor(proposal.status)}`}>
              {getStatusName(proposal.status)}
            </span>
          </div>

          <h1 className="mb-4 font-display text-2xl font-medium text-[var(--fg-primary)]">
            {proposal.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--fg-tertiary)]">
            <span>
              {t.proposedBy}: {proposal.proposedBy.slice(0, 8)}...{proposal.proposedBy.slice(-6)}
            </span>
            <span>
              {isVoting ? t.votingEnds : t.votingEnded}: {formatDate(votingEndsAt)}
            </span>
          </div>
        </div>

        {/* Description */}
        <div className="mb-8">
          <div className="prose prose-invert max-w-none">
            <p className="whitespace-pre-wrap text-[var(--fg-secondary)]">{proposal.description}</p>
          </div>
        </div>

        {/* Payload details */}
        <div className="mb-8 rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] p-6">
          <h2 className="mb-4 text-lg font-medium text-[var(--fg-primary)]">{t.payload}</h2>
          <pre className="overflow-x-auto text-sm text-[var(--fg-secondary)]">
            {JSON.stringify(proposal.payload, null, 2)}
          </pre>
        </div>

        {/* Voting UI */}
        {isVoting && (
          <div className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] p-6">
            <h2 className="mb-4 text-lg font-medium text-[var(--fg-primary)]">{t.castVote}</h2>

            {!isConnected ? (
              <p className="text-[var(--fg-tertiary)]">{t.signInRequired}</p>
            ) : state.hasVoted ? (
              <div>
                <p className="mb-2 text-[var(--fg-secondary)]">{t.alreadyVoted}</p>
                <p className="text-sm text-[var(--fg-tertiary)]">
                  {t.yourVote}:{' '}
                  <span className="font-medium text-[var(--fg-primary)]">
                    {state.userVote === 'approve'
                      ? t.approve
                      : state.userVote === 'reject'
                        ? t.reject
                        : t.abstain}
                  </span>
                </p>
              </div>
            ) : state.votingPower === 0 ? (
              <p className="text-[var(--fg-tertiary)]">{t.insufficientTier}</p>
            ) : (
              <form
                onSubmit={(e) => {
                  void handleVote(e);
                }}
                className="space-y-4"
              >
                <div className="mb-2 text-sm text-[var(--fg-tertiary)]">
                  Your voting power: {state.votingPower.toLocaleString()}
                </div>

                {/* Vote options */}
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setVoteDecision('approve')}
                    className={`flex-1 rounded-nested border px-4 py-3 text-center transition-colors ${
                      voteDecision === 'approve'
                        ? 'border-green-500 bg-green-500/20 text-green-400'
                        : 'border-[var(--border-default)] text-[var(--fg-secondary)] hover:border-green-500/50'
                    }`}
                  >
                    {t.approve}
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoteDecision('reject')}
                    className={`flex-1 rounded-nested border px-4 py-3 text-center transition-colors ${
                      voteDecision === 'reject'
                        ? 'border-red-500 bg-red-500/20 text-red-400'
                        : 'border-[var(--border-default)] text-[var(--fg-secondary)] hover:border-red-500/50'
                    }`}
                  >
                    {t.reject}
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoteDecision('abstain')}
                    className={`flex-1 rounded-nested border px-4 py-3 text-center transition-colors ${
                      voteDecision === 'abstain'
                        ? 'border-gray-500 bg-gray-500/20 text-gray-400'
                        : 'border-[var(--border-default)] text-[var(--fg-secondary)] hover:border-gray-500/50'
                    }`}
                  >
                    {t.abstain}
                  </button>
                </div>

                {/* Rationale */}
                <div>
                  <label
                    htmlFor="rationale"
                    className="mb-2 block text-sm text-[var(--fg-secondary)]"
                  >
                    {t.voteRationale}
                  </label>
                  <textarea
                    id="rationale"
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    placeholder={t.voteRationalePlaceholder}
                    rows={3}
                    className="w-full resize-none rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] px-3 py-2 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] focus:border-[var(--border-emphasis)] focus:outline-none"
                  />
                </div>

                {/* Error */}
                {voteError != null && voteError !== '' && (
                  <div className="text-sm text-red-400">{voteError}</div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!voteDecision || submitting}
                  className="w-full rounded-nested bg-[var(--color-firefly-gold)] px-4 py-3 font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : t.castVote}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Execute button */}
        {canExecute && (
          <div className="mt-6 rounded-nested border border-green-500/20 bg-green-500/10 p-6">
            <h2 className="mb-2 text-lg font-medium text-green-400">{t.executionAvailable}</h2>
            <p className="mb-4 text-sm text-[var(--fg-tertiary)]">
              This proposal has passed and can be executed.
            </p>
            {voteError != null && voteError !== '' && (
              <div className="mb-4 text-sm text-red-400">{voteError}</div>
            )}
            <button
              onClick={() => {
                void handleExecute();
              }}
              disabled={submitting}
              className="rounded-nested bg-green-500 px-6 py-3 font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Executing...' : t.execute}
            </button>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Voting progress */}
        {progress && (
          <div className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] p-6">
            <h2 className="mb-4 text-lg font-medium text-[var(--fg-primary)]">{t.votes}</h2>

            {/* Time remaining */}
            {isVoting && (
              <div className="mb-4 text-sm text-[var(--color-firefly-gold)]">
                {formatTimeRemaining(votingEndsAt)}
              </div>
            )}

            {/* Vote breakdown */}
            <div className="space-y-4">
              {/* For */}
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-green-400">{t.forVotes}</span>
                  <span className="text-[var(--fg-tertiary)]">{forWeight.toLocaleString()}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface-nested)]">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{
                      width: `${totalWeight > 0 ? (forWeight / totalWeight) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Against */}
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-red-400">{t.againstVotes}</span>
                  <span className="text-[var(--fg-tertiary)]">
                    {againstWeight.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface-nested)]">
                  <div
                    className="h-full rounded-full bg-red-500 transition-all"
                    style={{
                      width: `${totalWeight > 0 ? (againstWeight / totalWeight) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Abstain */}
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-gray-400">{t.abstainVotes}</span>
                  <span className="text-[var(--fg-tertiary)]">
                    {abstainWeight.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface-nested)]">
                  <div
                    className="h-full rounded-full bg-gray-500 transition-all"
                    style={{
                      width: `${totalWeight > 0 ? (abstainWeight / totalWeight) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Quorum */}
            <div className="mt-6 border-t border-[var(--border-subtle)] pt-4">
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-[var(--fg-tertiary)]">{t.quorumProgress}</span>
                <span
                  className={
                    progress.quorumReached ? 'text-green-400' : 'text-[var(--fg-tertiary)]'
                  }
                >
                  {progress.quorumReached ? t.quorumReached : t.quorumNotReached}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface-nested)]">
                <div
                  className={`h-full rounded-full transition-all ${
                    progress.quorumReached ? 'bg-green-500' : 'bg-[var(--color-firefly-gold)]'
                  }`}
                  style={{ width: `${Math.min(quorumPercent, 100)}%` }}
                />
              </div>
              <div className="mt-1 text-right text-xs text-[var(--fg-tertiary)]">
                {quorumPercent.toFixed(1)}%
              </div>
            </div>

            {/* Approval threshold */}
            <div className="mt-4">
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-[var(--fg-tertiary)]">{t.approvalProgress}</span>
                <span className="text-[var(--fg-tertiary)]">
                  {progress.approvalPercentage.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface-nested)]">
                <div
                  className={`h-full rounded-full transition-all ${
                    progress.approvalPercentage >= progress.approvalThreshold
                      ? 'bg-green-500'
                      : 'bg-[var(--color-firefly-gold)]'
                  }`}
                  style={{ width: `${Math.min(progress.approvalPercentage, 100)}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-[var(--fg-tertiary)]">
                {t.threshold}: {progress.approvalThreshold}%
              </div>
            </div>
          </div>
        )}

        {/* Total votes */}
        <div className="rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] p-6">
          <div className="text-sm text-[var(--fg-tertiary)]">{t.totalWeight}</div>
          <div className="mt-1 font-display text-2xl font-medium text-[var(--fg-primary)]">
            {totalWeight.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
