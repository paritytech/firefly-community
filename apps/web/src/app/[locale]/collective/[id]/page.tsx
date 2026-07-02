/**
 * Collective detail page — View a fact-checking collective.
 *
 * Shows the collective's mission and description, focus topics, reputation
 * metrics (score, accuracy, verifications, response time), and the governance
 * rules that determine how it reaches verdicts and admits members.
 */

import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { createCollectiveId } from '@cocuyo/types';
import { collectiveService, getActiveCollectives } from '@/lib/services/collective-service';
import { createServerFormatters } from '@/hooks/serverFormatters';
import { humanizeTopic } from '../../explore/explore-filtering';

interface CollectivePageProps {
  params: Promise<{ locale: string; id: string }>;
}

// Static export prebuilds only the ids below (the seed collectives + a '_' sentinel);
// dynamicParams=false makes any other id 404 in the exported build — the same constraint as the
// chain/[id] route. The Explore rail only links these prebuilt seed collectives, so it never
// dead-ends; a session-created collective is not prebuilt and thus not reachable in the static
// host build (there is no in-app UI to create one, so this is not a live gap).
export const dynamicParams = false;

export function generateStaticParams(): { locale: string; id: string }[] {
  const locales = ['en', 'es'];
  // '_' is a sentinel so the route always has at least one prebuilt param.
  const ids = ['_', ...getActiveCollectives().map((c) => c.id)];
  return locales.flatMap((locale) => ids.map((id) => ({ locale, id })));
}

/**
 * Empty state shown when the collective is not found.
 */
function CollectiveNotFound({
  locale,
  strings,
}: {
  locale: string;
  strings: { back: string; title: string; body: string; cta: string };
}): ReactNode {
  return (
    <main className="min-h-screen bg-[var(--bg-default)]">
      <div className="border-b border-[var(--border-default)]">
        <div className="container mx-auto max-w-3xl px-4 py-4">
          <Link
            href={`/${locale}/explore`}
            className="inline-flex items-center gap-2 text-sm text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg-primary)]"
          >
            <span aria-hidden="true">&larr;</span>
            <span>{strings.back}</span>
          </Link>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="mb-4 font-display text-2xl text-[var(--fg-primary)]">{strings.title}</h1>
        <p className="mb-8 text-[var(--fg-secondary)]">{strings.body}</p>
        <Link
          href={`/${locale}/explore`}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--bg-default)] transition-opacity hover:opacity-90"
        >
          {strings.cta}
        </Link>
      </div>
    </main>
  );
}

export default async function CollectivePage({
  params,
}: CollectivePageProps): Promise<ReactElement> {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('collectives');
  const { formatDate, formatRelativeTime, formatNumber } = createServerFormatters(locale);

  const collective = await collectiveService.getCollective(createCollectiveId(id));

  if (collective == null) {
    return (
      <CollectiveNotFound
        locale={locale}
        strings={{
          back: t('backToExplore'),
          title: t('notFoundTitle'),
          body: t('notFoundBody'),
          cta: t('exploreCta'),
        }}
      />
    );
  }

  const { reputation, governance } = collective;
  const accuracyPct = Math.round(reputation.accuracyRate * 100);
  const membershipText =
    governance.membershipApproval === 'open'
      ? t('membershipOpen')
      : governance.membershipApproval === 'vote'
        ? t('membershipVote')
        : t('membershipInvite');

  return (
    <main>
      {/* Header */}
      <section className="border-b border-[var(--border-default)] py-12">
        <div className="container-wide">
          {/* Breadcrumb */}
          <nav className="mb-6 text-sm">
            <Link
              href={`/${locale}/explore`}
              className="text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg-primary)]"
            >
              {t('backToExplore')}
            </Link>
            <span className="mx-2 text-[var(--fg-tertiary)]">/</span>
            <span className="text-[var(--fg-primary)]">{t('collective')}</span>
          </nav>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1">
              {/* Name */}
              <h1 className="mb-4 font-display text-3xl text-[var(--fg-primary)]">
                {collective.name}
              </h1>

              {/* Mission */}
              <p className="max-w-2xl border-l-2 border-[var(--accent)] pl-4 text-lg italic leading-relaxed text-[var(--fg-secondary)]">
                {collective.mission}
              </p>

              {/* Description */}
              <p className="mt-6 max-w-2xl leading-relaxed text-[var(--fg-secondary)]">
                {collective.description}
              </p>

              {/* Topics */}
              <div className="mt-6 flex flex-wrap gap-2">
                {collective.topics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full bg-[var(--bg-surface-nested)] px-3 py-1 text-sm text-[var(--fg-secondary)]"
                  >
                    {humanizeTopic(topic)}
                  </span>
                ))}
              </div>
            </div>

            {/* Reputation card */}
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6 lg:w-72">
              <h2 className="mb-4 font-semibold text-[var(--fg-primary)]">
                {t('reputationTitle')}
              </h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--fg-secondary)]">{t('reputationScore')}</dt>
                  <dd className="font-medium text-[var(--fg-primary)]">
                    {formatNumber(reputation.score)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--fg-secondary)]">{t('accuracyRate')}</dt>
                  <dd className="font-medium text-[var(--fg-success)]">{accuracyPct}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--fg-secondary)]">{t('verificationsLabel')}</dt>
                  <dd className="font-medium text-[var(--fg-primary)]">
                    {formatNumber(reputation.verificationsCompleted)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--fg-secondary)]">{t('avgResponseTime')}</dt>
                  <dd className="font-medium text-[var(--fg-primary)]">
                    {formatNumber(reputation.avgResponseTime)} {t('hours')}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--fg-secondary)]">{t('membersLabel')}</dt>
                  <dd className="font-medium text-[var(--fg-primary)]">
                    {formatNumber(collective.members.length)}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 border-t border-[var(--border-subtle)] pt-4">
                <p className="mb-1 text-xs text-[var(--fg-tertiary)]">{t('founded')}</p>
                <p className="mb-3 text-sm text-[var(--fg-secondary)]">
                  {formatDate(collective.createdAt)}
                </p>
                <p className="mb-1 text-xs text-[var(--fg-tertiary)]">{t('lastActive')}</p>
                <p className="text-sm text-[var(--fg-secondary)]">
                  {formatRelativeTime(collective.updatedAt)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Governance */}
      <section className="py-8">
        <div className="container-wide">
          <h2 className="mb-4 font-display text-xl text-[var(--fg-primary)]">{t('governance')}</h2>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4">
              <dt className="mb-1 text-xs uppercase tracking-wide text-[var(--fg-tertiary)]">
                {t('minVotesForVerdict')}
              </dt>
              <dd className="font-display text-2xl text-[var(--fg-primary)]">
                {formatNumber(governance.minVotesForVerdict)}
              </dd>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4">
              <dt className="mb-1 text-xs uppercase tracking-wide text-[var(--fg-tertiary)]">
                {t('verdictThreshold')}
              </dt>
              <dd className="font-display text-2xl text-[var(--fg-primary)]">
                {governance.verdictThreshold}%
              </dd>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4">
              <dt className="mb-1 text-xs uppercase tracking-wide text-[var(--fg-tertiary)]">
                {t('membership')}
              </dt>
              <dd className="font-display text-2xl text-[var(--fg-primary)]">{membershipText}</dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}
