'use client';

/**
 * VerdictVotingPanel — Main panel for verdict voting on claims.
 *
 * Displays active proposals, allows creating new proposals, and enables voting.
 * Only visible to members of collectives with jurisdiction over the claim's topics.
 *
 * Extended with MobRule features (Stewardship Court):
 * - Case state indicator (Open/Ripe/Done)
 * - Counter-evidence submission
 * - Turnout progress
 * - Time-weighted vote display
 */

import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import type {
  ClaimId,
  VerdictProposal,
  VerdictProposalV2,
  VerdictStatus,
  CollectivePreview,
  NewVerdictVote,
  CaseState,
} from '@cocuyo/types';
import {
  calculateVotingProgress,
  hasVoted,
  isV2Proposal,
  getCaseState,
  calculateWeightedVotingProgress,
  formatTimeUntilDeadline,
} from '@cocuyo/types';
import { useToast } from '@cocuyo/ui';
import { useSigner } from '@/hooks';
import { collectiveService } from '@/lib/services/collective-service';
import { verdictProposalService, verdictProposalServiceV2 } from '@/lib/services/verdict-service';
import { getConnectedCredential } from '@/lib/services/service-utils';
import { VOTE_DECAY_HALF_LIFE_MS } from '@/lib/services/verdict-constants';
import { VerdictProposalCard } from './VerdictProposalCard';
import { VoteProgress } from './VoteProgress';
import { VoteButtons } from './VoteButtons';
import { CreateProposalSheet } from './CreateProposalSheet';

export interface VerdictVotingPanelProps {
  /** The claim being voted on */
  claimId: ClaimId;
  /** The claim statement for context */
  claimStatement: string;
  /** Translations */
  translations?: {
    title?: string;
    noProposals?: string;
    createProposal?: string;
    castYourVote?: string;
    alreadyVoted?: string;
    notAMember?: string;
    connectWallet?: string;
    loading?: string;
    // MobRule translations
    caseStateOpen?: string;
    caseStateRipe?: string;
    caseStateDone?: string;
    counterEvidenceWindow?: string;
    submitCounterEvidence?: string;
    counterEvidenceSubmitted?: string;
    votingNotStarted?: string;
    turnoutProgress?: string;
    voteWeight?: string;
  };
}

// Case state badge configuration
const CASE_STATE_CONFIG: Record<CaseState, { label: string; colorClass: string }> = {
  open: {
    label: 'Counter-Evidence Window',
    colorClass: 'bg-amber-500/15 text-amber-500',
  },
  ripe: {
    label: 'Voting Active',
    colorClass: 'bg-blue-500/15 text-blue-400',
  },
  done: {
    label: 'Finalized',
    colorClass: 'bg-[var(--fg-tertiary)]/15 text-[var(--fg-tertiary)]',
  },
};

export function VerdictVotingPanel({
  claimId,
  claimStatement,
  translations: t = {},
}: VerdictVotingPanelProps): ReactElement | null {
  const { isConnected } = useSigner();
  const { addToast } = useToast();
  const [proposals, setProposals] = useState<readonly (VerdictProposal | VerdictProposalV2)[]>([]);
  const [userCollectives, setUserCollectives] = useState<readonly CollectivePreview[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<
    VerdictProposal | VerdictProposalV2 | null
  >(null);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [counterEvidenceText, setCounterEvidenceText] = useState('');
  const [submittingEvidence, setSubmittingEvidence] = useState(false);

  const credential = getConnectedCredential();
  const isMember = userCollectives.length > 0;

  // Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load proposals and user's collectives
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [proposalsData, collectivesData] = await Promise.all([
        verdictProposalService.getProposalsForClaim(claimId),
        credential ? collectiveService.getCollectivesForMember(credential) : Promise.resolve([]),
      ]);

      // Guard: don't update state if unmounted
      if (!mountedRef.current) return;

      setProposals(proposalsData);
      setUserCollectives(collectivesData);

      // Auto-select first active proposal if any
      const activeProposal = proposalsData.find((p) => p.status === 'voting');
      if (activeProposal) {
        setSelectedProposal(activeProposal);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [claimId, credential]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handle vote submission (uses V2 service if available)
  const handleVote = async (status: VerdictStatus): Promise<void> => {
    if (!selectedProposal || !credential) return;

    setVoting(true);
    try {
      const vote: NewVerdictVote = { decision: status };
      // Use V2 service for V2 proposals (enforces case state check)
      const result = isV2Proposal(selectedProposal)
        ? await verdictProposalServiceV2.voteV2(selectedProposal.id, vote)
        : await verdictProposalService.vote(selectedProposal.id, vote);

      if (result.ok) {
        // Reload data to get updated proposal
        await loadData();
      } else {
        addToast(result.error, 'error');
      }
    } finally {
      setVoting(false);
    }
  };

  // Handle counter-evidence submission
  const handleSubmitCounterEvidence = async (): Promise<void> => {
    if (!selectedProposal || !credential || !counterEvidenceText.trim()) return;

    setSubmittingEvidence(true);
    try {
      const result = await verdictProposalServiceV2.submitCounterEvidence(selectedProposal.id, {
        content: counterEvidenceText.trim(),
      });

      if (result.ok) {
        setCounterEvidenceText('');
        await loadData();
      } else {
        addToast(result.error, 'error');
      }
    } finally {
      setSubmittingEvidence(false);
    }
  };

  // Handle proposal creation
  const handleCreateProposal = async (params: {
    claimId: ClaimId;
    collectiveId: string;
    proposedStatus: VerdictStatus;
    rationale: string;
  }): Promise<void> => {
    const result = await verdictProposalService.createProposal({
      claimId: params.claimId,
      collectiveId: params.collectiveId as Parameters<
        typeof verdictProposalService.createProposal
      >[0]['collectiveId'],
      proposedStatus: params.proposedStatus,
      rationale: params.rationale,
    });

    if (result.ok) {
      await loadData();
    } else {
      throw new Error(result.error);
    }
  };

  // Don't render if not connected
  if (!isConnected) {
    return (
      <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4 text-center">
        <p className="text-sm text-[var(--fg-secondary)]">
          {t.connectWallet ?? 'Connect your wallet to participate in verdict voting'}
        </p>
      </div>
    );
  }

  // Don't render if not a member of any collective
  if (!loading && !isMember) {
    return (
      <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4 text-center">
        <p className="text-sm text-[var(--fg-secondary)]">
          {t.notAMember ?? 'Join a collective to participate in verdict voting'}
        </p>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4 text-center">
        <p className="animate-pulse text-sm text-[var(--fg-tertiary)]">
          {t.loading ?? 'Loading...'}
        </p>
      </div>
    );
  }

  const activeProposals = proposals.filter((p) => p.status === 'voting');
  const pastProposals = proposals.filter((p) => p.status !== 'voting');

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-medium text-[var(--fg-primary)]">
          {t.title ?? 'Collective Verification'}
        </h3>
        {userCollectives.length > 0 && (
          <button
            type="button"
            onClick={() => setShowCreateSheet(true)}
            className="text-sm text-[var(--color-firefly-gold)] hover:underline"
          >
            {t.createProposal ?? '+ New Proposal'}
          </button>
        )}
      </div>

      {/* Active proposals */}
      {activeProposals.length > 0 ? (
        <div className="space-y-4">
          {activeProposals.map((proposal) => (
            <div
              key={proposal.id}
              className={`rounded-container border bg-[var(--bg-surface-nested)] p-4 transition-colors ${
                selectedProposal?.id === proposal.id
                  ? 'border-[var(--color-firefly-gold)]'
                  : 'border-[var(--border-default)]'
              }`}
            >
              <VerdictProposalCard
                proposal={proposal}
                onClick={() => setSelectedProposal(proposal)}
              />

              {/* Expanded voting section */}
              {selectedProposal?.id === proposal.id && (
                <div className="mt-4 space-y-4 border-t border-[var(--border-subtle)] pt-4">
                  {/* Case State Indicator (V2 proposals) */}
                  {isV2Proposal(proposal) && (
                    <CaseStateSection
                      proposal={proposal}
                      credential={credential}
                      counterEvidenceText={counterEvidenceText}
                      onCounterEvidenceChange={setCounterEvidenceText}
                      onSubmitCounterEvidence={() => {
                        void handleSubmitCounterEvidence();
                      }}
                      submitting={submittingEvidence}
                      translations={t}
                    />
                  )}

                  {/* Vote Progress */}
                  {isV2Proposal(proposal) ? (
                    <WeightedVoteProgressSection proposal={proposal} translations={t} />
                  ) : (
                    <VoteProgress progress={calculateVotingProgress(proposal)} />
                  )}

                  {/* Voting Section */}
                  {(() => {
                    // For V2 proposals, check case state
                    if (isV2Proposal(proposal)) {
                      const caseState = getCaseState(proposal);
                      if (caseState === 'open') {
                        return (
                          <p className="text-sm italic text-amber-500">
                            {t.votingNotStarted ??
                              'Voting begins after counter-evidence window ends'}
                          </p>
                        );
                      }
                      if (caseState === 'done') {
                        return (
                          <p className="text-sm italic text-[var(--fg-tertiary)]">
                            This proposal has been finalized
                          </p>
                        );
                      }
                    }

                    // Normal voting UI
                    if (credential && !hasVoted(proposal, credential)) {
                      return (
                        <div>
                          <p className="mb-3 text-sm text-[var(--fg-secondary)]">
                            {t.castYourVote ?? 'Cast your vote:'}
                          </p>
                          <VoteButtons
                            onVote={(status) => void handleVote(status)}
                            disabled={voting}
                            loading={voting}
                          />
                        </div>
                      );
                    }
                    return (
                      <p className="text-sm italic text-[var(--fg-tertiary)]">
                        {t.alreadyVoted ?? 'You have already voted on this proposal'}
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6 text-center">
          <p className="mb-4 text-sm text-[var(--fg-secondary)]">
            {t.noProposals ?? 'No active proposals for this claim'}
          </p>
          <button
            type="button"
            onClick={() => setShowCreateSheet(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-firefly-gold)] px-4 py-2 text-sm font-medium text-[var(--bg-default)] transition-opacity hover:opacity-90"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t.createProposal ?? 'Create Proposal'}
          </button>
        </div>
      )}

      {/* Past proposals (collapsed) */}
      {pastProposals.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)]">
            {pastProposals.length} past proposal{pastProposals.length !== 1 ? 's' : ''}
          </summary>
          <div className="mt-2 space-y-2">
            {pastProposals.map((proposal) => (
              <VerdictProposalCard key={proposal.id} proposal={proposal} />
            ))}
          </div>
        </details>
      )}

      {/* Create proposal sheet */}
      {showCreateSheet && (
        <CreateProposalSheet
          claimId={claimId}
          claimStatement={claimStatement}
          collectives={userCollectives}
          onSubmit={handleCreateProposal}
          onClose={() => setShowCreateSheet(false)}
        />
      )}
    </section>
  );
}

// ============================================================================
// MobRule Helper Components
// ============================================================================

interface CaseStateSectionProps {
  proposal: VerdictProposalV2;
  credential: string | null;
  counterEvidenceText: string;
  onCounterEvidenceChange: (text: string) => void;
  onSubmitCounterEvidence: () => void;
  submitting: boolean;
  translations: VerdictVotingPanelProps['translations'];
}

function CaseStateSection({
  proposal,
  credential,
  counterEvidenceText,
  onCounterEvidenceChange,
  onSubmitCounterEvidence,
  submitting,
  translations: t = {},
}: CaseStateSectionProps): ReactElement {
  const currentState = getCaseState(proposal);
  const stateConfig = CASE_STATE_CONFIG[currentState];
  const isRespondent = proposal.respondent === credential;
  const canSubmitEvidence = currentState === 'open' && isRespondent && !proposal.counterEvidence;
  const counterEvidenceDeadline = formatTimeUntilDeadline(proposal.counterEvidenceDeadline);

  return (
    <div className="space-y-3">
      {/* Case State Badge */}
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${stateConfig.colorClass}`}>
          {currentState === 'open'
            ? (t.caseStateOpen ?? stateConfig.label)
            : currentState === 'ripe'
              ? (t.caseStateRipe ?? stateConfig.label)
              : (t.caseStateDone ?? stateConfig.label)}
        </span>
        {currentState === 'open' && (
          <span className="text-xs text-[var(--fg-tertiary)]">
            {t.counterEvidenceWindow ?? 'Window ends in'}: {counterEvidenceDeadline}
          </span>
        )}
      </div>

      {/* Counter-Evidence Display */}
      {proposal.counterEvidence && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="mb-1 text-xs font-medium text-amber-500">
            {t.counterEvidenceSubmitted ?? 'Counter-Evidence Submitted'}
          </p>
          <p className="text-sm text-[var(--fg-secondary)]">{proposal.counterEvidence.content}</p>
          {proposal.counterEvidence.evidenceUrls &&
            proposal.counterEvidence.evidenceUrls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {proposal.counterEvidence.evidenceUrls.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline"
                  >
                    Evidence #{i + 1}
                  </a>
                ))}
              </div>
            )}
        </div>
      )}

      {/* Counter-Evidence Submission Form */}
      {canSubmitEvidence && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--fg-secondary)]">
            {t.submitCounterEvidence ?? 'Submit your defense (as respondent)'}
          </label>
          <textarea
            value={counterEvidenceText}
            onChange={(e) => onCounterEvidenceChange(e.target.value)}
            placeholder="Explain your side of the dispute..."
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-default)] p-3 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] focus:border-amber-500 focus:outline-none"
            rows={3}
          />
          <button
            type="button"
            onClick={onSubmitCounterEvidence}
            disabled={submitting || !counterEvidenceText.trim()}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Counter-Evidence'}
          </button>
        </div>
      )}
    </div>
  );
}

interface WeightedVoteProgressSectionProps {
  proposal: VerdictProposalV2;
  translations: VerdictVotingPanelProps['translations'];
}

function WeightedVoteProgressSection({
  proposal,
  translations: t = {},
}: WeightedVoteProgressSectionProps): ReactElement {
  const progress = calculateWeightedVotingProgress(proposal, VOTE_DECAY_HALF_LIFE_MS);

  return (
    <div className="space-y-4">
      {/* Standard vote progress */}
      <VoteProgress progress={progress} />

      {/* Turnout Progress */}
      <div>
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-[var(--fg-secondary)]">
            {t.turnoutProgress ?? 'Turnout'}: {progress.turnout.current}/{progress.turnout.required}
          </span>
          <span className={progress.turnout.met ? 'text-green-400' : 'text-[var(--fg-tertiary)]'}>
            {progress.turnout.currentPercentage.toFixed(0)}% of eligible voters
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface-nested)]">
          <div
            className={`h-full transition-all duration-300 ${
              progress.turnout.met ? 'bg-green-500' : 'bg-[var(--fg-tertiary)]'
            }`}
            style={{
              width: `${Math.min((progress.turnout.current / progress.turnout.required) * 100, 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Weighted Vote Info */}
      <div className="flex items-center gap-2 text-xs text-[var(--fg-tertiary)]">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>
          {t.voteWeight ?? 'Time-weighted votes'}: {progress.weightedTotalVotes.toFixed(1)} (
          {progress.weightedAgreementPercentage.toFixed(0)}% weighted agreement)
        </span>
      </div>

      {/* Ready to Finalize Indicator */}
      {progress.readyToFinalize && (
        <div className="bg-[var(--color-firefly-gold)]/10 border-[var(--color-firefly-gold)]/20 flex items-center gap-2 rounded-lg border px-3 py-2">
          <svg
            className="h-4 w-4 text-[var(--color-firefly-gold)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm text-[var(--color-firefly-gold)]">
            Turnout and threshold met — verdict will be finalized
          </span>
        </div>
      )}
    </div>
  );
}
