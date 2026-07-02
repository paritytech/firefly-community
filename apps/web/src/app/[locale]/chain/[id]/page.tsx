/**
 * Story Chain detail page — View a complete story with posts, analysis, and bounties.
 *
 * This page shows:
 * - Chain title, description, and status
 * - Verification trail summary
 * - Tabbed content:
 *   - What's Happening: Posts in the chain
 *   - Deep Dives: Analysis posts related to this chain
 *   - Help Needed: Open bounties for this chain
 */

import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { signalService, chainService } from '@/lib/services/service-instances';
import { ChainPostList } from './ChainPostList';
import { ChainTabs } from './ChainTabs';
import { AddPostButton } from './AddPostButton';
import { createChainId } from '@cocuyo/types';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { createServerFormatters } from '@/hooks/serverFormatters';
import { validateChainId } from '@/lib/utils/validators';

interface ChainPageProps {
  params: Promise<{ locale: string; id: string }>;
}

/**
 * Generate static params for build.
 * With output: export, we must generate all locale+id combinations.
 */
// Static export prebuilds only the ids below; any other id 404s in the export (dynamicParams=false
// makes that explicit). Note: `next dev` returns 500 for un-prebuilt ids — a dev-only output:export
// quirk that does not occur in the built static site.
export const dynamicParams = false;

export function generateStaticParams(): { locale: string; id: string }[] {
  const locales = ['en', 'es'];
  const ids = ['_', 'seed-chain-001'];
  return locales.flatMap((locale) => ids.map((id) => ({ locale, id })));
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'var(--color-corroborated)';
    case 'established':
      return 'var(--color-accent)';
    case 'emerging':
      return 'var(--color-text-secondary)';
    case 'contested':
      return 'var(--color-challenged)';
    default:
      return 'var(--color-text-tertiary)';
  }
}

/**
 * Empty state component shown when chain is not found.
 */
function ChainNotFound({ locale }: { locale: string }): ReactNode {
  return (
    <main className="min-h-screen bg-[var(--bg-default)]">
      <div className="border-b border-[var(--border-default)]">
        <div className="container mx-auto max-w-3xl px-4 py-4">
          <Link
            href={`/${locale}/explore`}
            className="inline-flex items-center gap-2 text-sm text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg-primary)]"
          >
            <span aria-hidden="true">&larr;</span>
            <span>Back to Explore</span>
          </Link>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="mb-4 font-display text-2xl text-[var(--fg-primary)]">
          Story Chain Not Found
        </h1>
        <p className="mb-8 text-[var(--fg-secondary)]">
          This story chain doesn&apos;t exist or hasn&apos;t been created yet.
        </p>
        <Link
          href={`/${locale}/explore`}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--bg-default)] transition-opacity hover:opacity-90"
        >
          Explore Stories
        </Link>
      </div>
    </main>
  );
}

export default async function ChainPage({ params }: ChainPageProps): Promise<ReactElement> {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('chain');
  const { formatDate } = createServerFormatters(locale);

  const chainId = validateChainId(id);
  if (chainId === null) {
    return <ChainNotFound locale={locale} />;
  }

  const chain = await chainService.getChain(chainId, locale);

  if (chain == null) {
    return <ChainNotFound locale={locale} />;
  }

  // Get posts for this chain using service
  const posts = await signalService.getChainPosts(createChainId(id), locale);

  // Deep dives (longer form posts) - for now same as chain posts
  const deepDives = posts.filter((p) => p.content.title !== undefined);

  // Chain-linked campaigns require indexing that doesn't exist yet.
  // Return empty array to avoid showing incorrect/unrelated campaigns.
  const chainCampaigns: never[] = [];

  const statusColor = getStatusColor(chain.status);

  // Posts content
  const postsContent1 = (
    <div>
      {posts.length > 0 ? (
        <>
          <div className="mb-4 text-sm text-[var(--fg-secondary)]">
            {t('whatsHappening.description')}
          </div>
          <ChainPostList posts={[...posts]} />
        </>
      ) : (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-nested)] py-12 text-center">
          <p className="mb-4 text-[var(--fg-secondary)]">{t('whatsHappening.noPosts')}</p>
          <AddPostButton chainId={createChainId(id)}>{t('beFirstToIlluminate')}</AddPostButton>
        </div>
      )}
    </div>
  );

  // Deep dives content
  const deepDivesContent = (
    <div>
      {deepDives.length > 0 ? (
        <>
          <div className="mb-4 text-sm text-[var(--fg-secondary)]">
            {t('deepDives.description')}
          </div>
          <div className="space-y-4">
            {deepDives.map((post) => (
              <Link
                key={post.id}
                href={`/${locale}/post/${post.id}`}
                className="hover:border-[var(--color-firefly-gold)]/40 block rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4 transition-colors"
              >
                <h3 className="mb-2 font-medium text-[var(--fg-primary)]">{post.content.title}</h3>
                <p className="line-clamp-2 text-sm text-[var(--fg-secondary)]">
                  {post.content.text.slice(0, 200)}...
                </p>
                <div className="mt-2 text-xs text-[var(--fg-tertiary)]">
                  By {post.author.pseudonym}
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-nested)] py-12 text-center">
          <p className="text-[var(--fg-secondary)]">{t('deepDives.noPosts')}</p>
        </div>
      )}
    </div>
  );

  // Campaigns content
  const campaignsContent = (
    <div>
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-nested)] py-12 text-center">
        <p className="text-[var(--fg-secondary)]">{t('helpNeeded.noCampaigns')}</p>
      </div>
    </div>
  );

  return (
    <>
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
                {t('backToStories')}
              </Link>
              <span className="mx-2 text-[var(--fg-tertiary)]">/</span>
              <span className="text-[var(--fg-primary)]">{t('storyChain')}</span>
            </nav>

            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                {/* Status badge */}
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className="rounded-full px-3 py-1 text-sm capitalize"
                    style={{
                      color: statusColor,
                      border: `1px solid ${statusColor}`,
                    }}
                  >
                    {chain.status}
                  </span>
                  {chain.location != null && (
                    <span className="text-sm text-[var(--fg-tertiary)]">{chain.location}</span>
                  )}
                </div>

                {/* Title */}
                <h1 className="mb-4 text-3xl font-bold">{chain.title}</h1>

                {/* Description */}
                <p className="max-w-2xl leading-relaxed text-[var(--fg-secondary)]">
                  {chain.description}
                </p>

                {/* Topics */}
                <div className="mt-6 flex flex-wrap gap-2">
                  {chain.topics.map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full bg-[var(--bg-surface-nested)] px-3 py-1 text-sm text-[var(--fg-secondary)]"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats card */}
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6 lg:w-72">
                <h3 className="mb-4 font-semibold">{t('verificationSummary')}</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-[var(--fg-secondary)]">{t('posts')}</dt>
                    <dd className="font-medium text-[var(--fg-primary)]">
                      {chain.stats.postCount}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--fg-secondary)]">{t('corroborations')}</dt>
                    <dd className="font-medium text-[var(--fg-success)]">
                      {chain.stats.corroborationCount}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--fg-secondary)]">{t('challenges')}</dt>
                    <dd
                      className="font-medium"
                      style={{
                        color:
                          chain.stats.challengeCount > 0
                            ? 'var(--fg-error)'
                            : 'var(--fg-secondary)',
                      }}
                    >
                      {chain.stats.challengeCount}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--fg-secondary)]">{t('contributors')}</dt>
                    <dd className="font-medium text-[var(--fg-primary)]">
                      {chain.stats.contributorCount}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 border-t border-[var(--border-subtle)] pt-4">
                  <p className="mb-1 text-xs text-[var(--fg-tertiary)]">{t('chainStarted')}</p>
                  <p className="text-sm text-[var(--fg-secondary)]">
                    {formatDate(chain.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Add to Chain CTA */}
        <section className="border-b border-[var(--border-default)] bg-[var(--bg-surface-raised)] py-6">
          <div className="container-wide flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-[var(--fg-secondary)]">{t('addPostCta')}</p>
            <AddPostButton chainId={createChainId(id)} />
          </div>
        </section>

        {/* Tabbed Content */}
        <section className="py-6">
          <div className="container-wide">
            <ChainTabs
              signalsContent={postsContent1}
              postsContent={deepDivesContent}
              campaignsContent={campaignsContent}
              signalsCount={posts.length}
              postsCount={deepDives.length}
              campaignsCount={chainCampaigns.length}
              translations={{
                whatsHappening: t('tabs.whatsHappening'),
                deepDives: t('tabs.deepDives'),
                helpNeeded: t('tabs.helpNeeded'),
              }}
            />
          </div>
        </section>
      </main>
    </>
  );
}
