/**
 * Proposal detail page — View and vote on a governance proposal.
 *
 * Shows proposal details, voting progress, and voting UI.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProposalDetailView } from './ProposalDetailView';

interface ProposalDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
}

/**
 * Generate static params for build.
 * With output: export, we must generate locale+id combinations.
 */
// Static export prebuilds only the ids below; any other id 404s in the export (dynamicParams=false
// makes that explicit). Note: `next dev` returns 500 for un-prebuilt ids — a dev-only output:export
// quirk that does not occur in the built static site.
export const dynamicParams = false;

export function generateStaticParams(): { locale: string; id: string }[] {
  const locales = ['en', 'es'];
  // '_' is a placeholder for dynamic routes; actual proposals are fetched at runtime
  const ids = ['_'];
  return locales.flatMap((locale) => ids.map((id) => ({ locale, id })));
}

export default async function ProposalDetailPage({
  params,
}: ProposalDetailPageProps): Promise<ReactElement> {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('alliance.governance');

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="container-wide py-8">
          <h1 className="mb-2 font-display text-2xl font-medium text-[var(--fg-primary)]">
            {t('proposal.title')}
          </h1>
        </div>
      </header>

      {/* Main content */}
      <section className="py-8">
        <div className="container-wide">
          <ProposalDetailView
            proposalId={id}
            translations={{
              // Proposal info
              votingPeriod: t('proposal.votingPeriod'),
              quorum: t('proposal.quorum'),
              threshold: t('proposal.threshold'),
              proposedBy: t('proposal.proposedBy'),
              votingEnds: t('proposal.votingEnds'),
              votingEnded: t('proposal.votingEnded'),
              payload: t('proposal.payload'),
              // Voting
              castVote: t('proposal.castVote'),
              approve: t('proposal.approve'),
              reject: t('proposal.reject'),
              abstain: t('proposal.abstain'),
              yourVote: t('proposal.yourVote'),
              alreadyVoted: t('proposal.alreadyVoted'),
              voteRationale: t('proposal.voteRationale'),
              voteRationalePlaceholder: t('proposal.voteRationalePlaceholder'),
              // Vote stats
              votes: t('proposal.votes'),
              forVotes: t('proposal.forVotes'),
              againstVotes: t('proposal.againstVotes'),
              abstainVotes: t('proposal.abstainVotes'),
              totalWeight: t('proposal.totalWeight'),
              quorumProgress: t('proposal.quorumProgress'),
              quorumReached: t('proposal.quorumReached'),
              quorumNotReached: t('proposal.quorumNotReached'),
              approvalProgress: t('proposal.approvalProgress'),
              // Actions
              execute: t('proposal.execute'),
              cancel: t('proposal.cancel'),
              executionAvailable: t('proposal.executionAvailable'),
              timelockRemaining: t('proposal.timelockRemaining'),
              // Types
              typeOutletAdd: t('types.outlet-add'),
              typeOutletRemove: t('types.outlet-remove'),
              typeWeightChange: t('types.weight-change'),
              typeParameterChange: t('types.parameter-change'),
              typeEmergency: t('types.emergency'),
              // Status
              statusVoting: t('status.voting'),
              statusApproved: t('status.approved'),
              statusRejected: t('status.rejected'),
              statusExpired: t('status.expired'),
              statusExecuted: t('status.executed'),
              // Errors
              notFound: t('errors.proposalNotFound'),
              signInRequired: t('errors.walletNotConnected'),
              insufficientTier: t('errors.insufficientTier'),
              executionFailed: t('errors.executionFailed'),
            }}
          />
        </div>
      </section>
    </main>
  );
}
