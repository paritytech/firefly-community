/**
 * Alliance Governance page — Overview of governance activity.
 *
 * Shows active proposals, voting power, and recently finalized proposals.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { GovernanceOverviewView } from './GovernanceOverviewView';

interface GovernancePageProps {
  params: Promise<{ locale: string }>;
}

export default async function GovernancePage({
  params,
}: GovernancePageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('alliance.governance');

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="container-wide py-8">
          <h1 className="mb-2 font-display text-2xl font-medium text-[var(--fg-primary)]">
            {t('title')}
          </h1>
          <p className="max-w-2xl text-sm text-[var(--fg-secondary)]">{t('description')}</p>
        </div>
      </header>

      {/* Main content */}
      <section className="py-8">
        <div className="container-wide">
          <GovernanceOverviewView
            translations={{
              // Overview
              activeProposals: t('overview.activeProposals'),
              yourVotingPower: t('overview.yourVotingPower'),
              noActiveProposals: t('overview.noActiveProposals'),
              recentlyFinalized: t('overview.recentlyFinalized'),
              viewAll: t('overview.viewAll'),
              // Proposals
              createProposal: t('proposals.create'),
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
              // Proposal card
              votingEnds: t('proposal.votingEnds'),
              quorumProgress: t('proposal.quorumProgress'),
              // Errors
              signInRequired: t('create.signInRequired'),
              tierRequired: t('create.tierRequired'),
            }}
          />
        </div>
      </section>
    </main>
  );
}
