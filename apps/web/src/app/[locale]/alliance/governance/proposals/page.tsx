/**
 * Proposals list page — Browse all governance proposals.
 *
 * Shows filterable list of all proposals with search and status filters.
 */

import type { ReactElement } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProposalListView } from './ProposalListView';

interface ProposalsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function ProposalsPage({ params }: ProposalsPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('alliance.governance');

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="container-wide py-8">
          <h1 className="mb-2 font-display text-2xl font-medium text-[var(--fg-primary)]">
            {t('proposals.title')}
          </h1>
          <p className="max-w-2xl text-sm text-[var(--fg-secondary)]">{t('description')}</p>
        </div>
      </header>

      {/* Main content */}
      <section className="py-8">
        <div className="container-wide">
          <ProposalListView
            translations={{
              // Create
              createProposal: t('proposals.create'),
              // Filters
              filterByType: t('proposals.filterByType'),
              filterByStatus: t('proposals.filterByStatus'),
              searchPlaceholder: t('proposals.searchPlaceholder'),
              clearFilters: t('proposals.clearFilters'),
              // Results
              noProposals: t('proposals.noProposals'),
              proposalWord: t('proposals.proposalWord'),
              proposalsWord: t('proposals.proposalsWord'),
              ofWord: t('proposals.ofWord'),
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
              // Permissions
              signInRequired: t('create.signInRequired'),
              tierRequired: t('create.tierRequired'),
            }}
          />
        </div>
      </section>
    </main>
  );
}
