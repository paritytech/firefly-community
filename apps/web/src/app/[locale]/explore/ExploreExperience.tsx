'use client';

/**
 * ExploreExperience — the Explore discovery surface.
 *
 * Browse Signals, Claims, and Story chains with topic filters, free-text
 * search, and sort. Deliberately avoids feed/engagement patterns: ranking is by
 * corroboration weight, never popularity. Built from the @cocuyo/ui design
 * system with real data from the services.
 *
 * Data sourcing: signals, chains, and collectives have server-available seed
 * data and arrive as props (server-rendered). Claims are user-extracted and
 * live only in browser-side storage (via the host), so they are loaded
 * client-side here — fetching them on the server would always read empty.
 *
 * Page chrome (Navbar/Footer) is provided by the [locale] layout, so this
 * component renders only the page body. Wallet/signing flows through the
 * existing host-aware providers (useIlluminate / corroborate / trust).
 */

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { Post, ClaimPreview, ChainPreview, CollectivePreview, ChainId } from '@cocuyo/types';
import {
  FeedPostCard,
  ClaimCard,
  EmptyState,
  Button,
  FireflySymbol,
  Breadcrumb,
  AnimatedList,
  InfoPopover,
  type FeedPostCardTranslations,
} from '@cocuyo/ui';
import { useIlluminate } from '@/hooks/useIlluminate';
import { useCorroborateDispute } from '@/components/CorroborateDisputeSheet';
import { useTrustDrawer } from '@/components/TrustDrawer';
import { claimService } from '@/lib/services/claim-service';
import { useFormatters } from '@/hooks/useFormatters';
import { createLogger } from '@/lib/logging';
import { StoryChainCard } from './StoryChainCard';
import {
  type ExploreTab,
  type ExploreSort,
  filterSortSignals,
  filterSortClaims,
  filterSortChains,
  collectTopics,
  humanizeTopic,
} from './explore-filtering';

const logger = createLogger('ExploreExperience');

export interface ExploreExperienceProps {
  signals: readonly Post[];
  chains: readonly ChainPreview[];
  collectives: readonly CollectivePreview[];
}

function isSort(value: string): value is ExploreSort {
  return value === 'recent' || value === 'corroborated' || value === 'awaiting';
}

export function ExploreExperience({
  signals,
  chains,
  collectives,
}: ExploreExperienceProps): ReactElement {
  const t = useTranslations('explore');
  const tPosts = useTranslations('posts');
  const router = useRouter();
  const locale = useLocale();
  const { formatRelativeTime } = useFormatters();
  const { openModal } = useIlluminate();
  const { openSheet: openCorroborateSheet } = useCorroborateDispute();
  const { openDrawer: openTrustDrawer } = useTrustDrawer();

  // Claims live in browser-side storage, so they load on the client. (Signals,
  // chains, and collectives have server seed data and arrive as props.) We also
  // refetch when the tab regains focus so a claim extracted elsewhere (e.g. on a
  // post page) appears on return without a full reload.
  const [claims, setClaims] = useState<readonly ClaimPreview[]>([]);
  const [claimsError, setClaimsError] = useState(false);
  useEffect(() => {
    let active = true;
    // Focus and visibility refetches can overlap; only the latest request's
    // result is applied so a slow earlier fetch can't clobber a newer one.
    let latestRequest = 0;

    const loadClaims = (): void => {
      const requestId = ++latestRequest;
      claimService
        .getClaimsByStatus({ pagination: { limit: 30, offset: 0 } })
        .then((result) => {
          if (active && requestId === latestRequest) {
            setClaims(result.items);
            setClaimsError(false);
          }
        })
        .catch((error: unknown) => {
          logger.error('Failed to load claims for Explore', 'loadClaims', error);
          if (active && requestId === latestRequest) setClaimsError(true);
        });
    };

    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible') loadClaims();
    };

    loadClaims();
    window.addEventListener('focus', loadClaims);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      window.removeEventListener('focus', loadClaims);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const [tab, setTab] = useState<ExploreTab>('signals');
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('all');
  const [sort, setSort] = useState<ExploreSort>('recent');

  const filteredSignals = useMemo(
    () => filterSortSignals(signals, { topic, query, sort }),
    [signals, topic, query, sort]
  );
  const filteredClaims = useMemo(
    () => filterSortClaims(claims, { topic, query, sort }),
    [claims, topic, query, sort]
  );
  const filteredChains = useMemo(
    () => filterSortChains(chains, { topic, query, sort }),
    [chains, topic, query, sort]
  );

  const counts = {
    signals: filteredSignals.length,
    claims: filteredClaims.length,
    chains: filteredChains.length,
  };

  const topicChips = useMemo(
    () => collectTopics(signals, claims, chains),
    [signals, claims, chains]
  );
  const topicLabel = (slug: string): string =>
    slug === 'all' ? t('topicAll') : humanizeTopic(slug);

  const stats: ReadonlyArray<{ value: number; label: string }> = [
    { value: signals.length, label: t('statSignals') },
    { value: claims.filter((c) => c.status === 'verified').length, label: t('statClaims') },
    { value: chains.length, label: t('statChains') },
    { value: collectives.length, label: t('statCollectives') },
  ];

  const trending = useMemo(
    () => [...chains].sort((a, b) => b.postCount - a.postCount).slice(0, 4),
    [chains]
  );

  const tabs: ReadonlyArray<{ key: ExploreTab; label: string; count: number }> = [
    { key: 'signals', label: t('tabSignals'), count: counts.signals },
    { key: 'claims', label: t('tabClaims'), count: counts.claims },
    { key: 'chains', label: t('tabChains'), count: counts.chains },
  ];

  const activeCount = counts[tab];
  const typeNoun =
    tab === 'signals' ? t('typeSignals') : tab === 'claims' ? t('typeClaims') : t('typeChains');
  const trimmedQuery = query.trim();
  const resultsLabel =
    `${activeCount} ${typeNoun}` +
    (topic !== 'all' ? ` · ${topicLabel(topic)}` : '') +
    (trimmedQuery !== '' ? ` · “${trimmedQuery}”` : '');

  // Empty-state copy: a claims-load failure reads differently from "no results".
  const claimsLoadFailed = tab === 'claims' && claimsError;
  const emptyTitle = claimsLoadFailed
    ? t('claimsErrorTitle')
    : trimmedQuery !== ''
      ? t('emptySearchTitle')
      : t('emptyTopicTitle');
  const emptyDescription = claimsLoadFailed
    ? t('claimsErrorDesc')
    : trimmedQuery !== ''
      ? t('emptySearchDesc')
      : t('emptyTopicDesc');

  const feedTranslations: FeedPostCardTranslations = {
    corroborate: tPosts('corroborate'),
    dispute: tPosts('dispute'),
    extractClaim: tPosts('extractClaim'),
    extracting: tPosts('extracting'),
    viewDetails: tPosts('viewDetails'),
  };
  const goPost = (id: string): void => router.push(`/${locale}/post/${id}`);
  const goChain = (id: ChainId): void => router.push(`/${locale}/chain/${id}`);
  const goClaim = (id: string): void => router.push(`/${locale}/claim/${id}`);
  const goProfile = (credentialHash: string): void =>
    router.push(`/${locale}/profile/${credentialHash}`);
  const goCollective = (id: string): void => router.push(`/${locale}/collective/${id}`);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-7 pb-24">
      <div className="pt-2">
        <Breadcrumb
          items={[
            { label: t('breadcrumbHome'), href: `/${locale}` },
            { label: t('breadcrumbExplore') },
          ]}
        />
      </div>

      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-9 border-b border-[var(--border-subtle)] pb-7 pt-2">
        <div className="max-w-[640px]">
          <div className="flex items-center gap-2.5">
            <FireflySymbol size={28} color="gold" animate />
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--fg-tertiary)]">
              {t('eyebrow')}
            </span>
          </div>
          <h1 className="mt-3 font-display text-4xl leading-tight text-[var(--fg-primary)]">
            {t('heading')}
          </h1>
          <p className="mt-3 text-[var(--fg-secondary)]">{t('subheading')}</p>
        </div>

        {/* Stat strip — 1px dividers via gap over a subtle-border backdrop */}
        <div
          className="flex overflow-hidden rounded-[14px] border border-[var(--border-subtle)]"
          style={{ gap: 1, background: 'var(--border-subtle)' }}
        >
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex min-w-[92px] flex-col gap-1 bg-[var(--bg-surface-main)] px-4 py-3"
            >
              <span className="font-mono text-lg text-[var(--fg-primary)]">{s.value}</span>
              <span className="text-xs text-[var(--fg-tertiary)]">{s.label}</span>
            </div>
          ))}
        </div>
      </header>

      {/* Toolbar */}
      <div className="py-6">
        {/* Content-type filters */}
        <div className="flex flex-wrap gap-2">
          {tabs.map((tb) => {
            const active = tab === tb.key;
            return (
              <button
                key={tb.key}
                type="button"
                aria-pressed={active}
                onClick={() => setTab(tb.key)}
                className={`flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-[var(--bg-surface-container)] text-[var(--fg-primary)]'
                    : 'text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)]'
                }`}
              >
                {tb.label}
                <span
                  className={`rounded-full border px-2 py-0.5 font-mono text-xs ${
                    active
                      ? 'border-[var(--border-accent)] text-[var(--fg-accent)]'
                      : 'border-transparent bg-[var(--bg-surface-nested)] text-[var(--fg-tertiary)]'
                  }`}
                  style={active ? { background: 'var(--color-firefly-gold-glow)' } : undefined}
                >
                  {tb.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5" stroke="var(--fg-tertiary)" strokeWidth="1.5" />
            <line x1="11" y1="11" x2="14" y2="14" stroke="var(--fg-tertiary)" strokeWidth="1.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="w-full rounded-[var(--radius-nested)] border border-[var(--border-default)] bg-[var(--bg-surface-container)] py-3 pl-10 pr-11 text-[var(--fg-primary)] outline-none transition-colors placeholder:text-[var(--fg-tertiary)] focus:border-[var(--border-accent)]"
          />
          {query !== '' && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('clearSearch')}
              className="absolute right-3 top-1/2 flex -translate-y-1/2 text-[var(--fg-tertiary)] transition-colors hover:text-[var(--fg-primary)]"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" />
                <line x1="12" y1="2" x2="2" y2="12" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          )}
        </div>

        {/* Topic chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-[var(--fg-tertiary)]">
            {t('topicsLabel')}
          </span>
          {['all', ...topicChips].map((slug) => {
            const active = topic === slug;
            return (
              <button
                key={slug}
                type="button"
                aria-pressed={active}
                onClick={() => setTopic(slug)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  active
                    ? 'border-[var(--border-accent)] text-[var(--fg-accent)]'
                    : 'border-[var(--border-default)] text-[var(--fg-secondary)] hover:border-[var(--border-emphasis)] hover:text-[var(--fg-primary)]'
                }`}
                style={active ? { background: 'var(--color-firefly-gold-glow)' } : undefined}
              >
                {topicLabel(slug)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body: main column + rail. This is a content column inside the page's <main>, so it must
          not be a second <main> landmark — use a div. */}
      <div className="flex flex-wrap items-start gap-9">
        <div className="min-w-[min(100%,560px)] flex-[999_1_580px]">
          <div className="flex items-center justify-between gap-4 pb-4">
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--fg-tertiary)]">
              {resultsLabel}
            </span>
            <select
              value={sort}
              onChange={(e) => {
                if (isSort(e.target.value)) setSort(e.target.value);
              }}
              aria-label={t('sortLabel')}
              className="rounded-[var(--radius-small)] border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-3 py-1.5 text-sm text-[var(--fg-secondary)] outline-none focus-visible:border-[var(--border-accent)]"
            >
              <option value="recent">{t('sortRecent')}</option>
              <option value="corroborated">{t('sortCorroborated')}</option>
              <option value="awaiting">{t('sortAwaiting')}</option>
            </select>
          </div>

          {activeCount === 0 ? (
            <div className="rounded-[var(--radius-container)] border border-[var(--border-subtle)] bg-[var(--bg-surface-main)] p-6">
              <EmptyState
                icon={<FireflySymbol size={42} color="gold" animate />}
                title={emptyTitle}
                description={emptyDescription}
                action={
                  <Button variant="illuminate" onClick={() => openModal()}>
                    {t('emptyAction')}
                  </Button>
                }
              />
            </div>
          ) : tab === 'signals' ? (
            <div className="grid grid-cols-1 gap-[18px]">
              {filteredSignals.map((post) => (
                <FeedPostCard
                  key={post.id}
                  post={post}
                  showActions
                  translations={feedTranslations}
                  onClick={() => goPost(post.id)}
                  onAuthorClick={goProfile}
                  onChainClick={goChain}
                  onCorroborate={() => openCorroborateSheet({ post, mode: 'corroborate' })}
                  onDispute={() => openCorroborateSheet({ post, mode: 'dispute' })}
                  onViewTrust={() => openTrustDrawer(post.id)}
                />
              ))}
            </div>
          ) : tab === 'claims' ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-[18px]">
              {filteredClaims.map((claim) => (
                <ClaimCard key={claim.id} claim={claim} onClick={() => goClaim(claim.id)} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-[18px]">
              {filteredChains.map((chain) => (
                <StoryChainCard
                  key={chain.id}
                  chain={chain}
                  topicLabel={topicLabel(chain.topics[0] ?? 'all')}
                  labels={{
                    eyebrow: t('chainEyebrow'),
                    signals: t('typeSignals'),
                    corroborations: t('corroborations'),
                    updated: t('updated'),
                  }}
                  updatedLabel={formatRelativeTime(chain.updatedAt)}
                  onClick={goChain}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right rail */}
        <aside className="min-w-[min(100%,288px)] flex-[1_1_296px] pt-1">
          {/* Trending chains */}
          {trending.length > 0 && (
            <RailCard title={t('railTrending')}>
              <AnimatedList variant="fast">
                {trending.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => goChain(ch.id)}
                    className="flex w-full flex-col gap-1 border-t border-[var(--border-subtle)] py-3 text-left transition-opacity first:border-t-0 hover:opacity-80"
                  >
                    <span className="text-sm text-[var(--fg-primary)]">{ch.title}</span>
                    <span className="font-mono text-xs text-[var(--fg-tertiary)]">
                      {ch.postCount} {t('typeSignals')} · {formatRelativeTime(ch.updatedAt)}
                    </span>
                  </button>
                ))}
              </AnimatedList>
            </RailCard>
          )}

          {/* Active collectives — real seed data; no per-user role on a public page */}
          {collectives.length > 0 && (
            <RailCard title={t('railCollectives')}>
              <div className="flex flex-col gap-3">
                {collectives.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => goCollective(c.id)}
                    className="flex w-full flex-col gap-1 border-t border-[var(--border-subtle)] pt-3 text-left transition-opacity first:border-t-0 hover:opacity-80"
                  >
                    <span className="font-display text-base text-[var(--fg-primary)]">
                      {c.name}
                    </span>
                    <span className="font-mono text-xs text-[var(--fg-tertiary)]">
                      {c.verificationsCompleted} {t('verifications')} ·{' '}
                      {c.topics.slice(0, 2).map(humanizeTopic).join(', ')}
                    </span>
                  </button>
                ))}
              </div>
            </RailCard>
          )}

          {/* No vanity metrics */}
          <RailCard>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg text-[var(--fg-primary)]">
                {t('railNoVanityTitle')}
              </h3>
              <InfoPopover title={t('railNoVanityInfoTitle')} position="left">
                {t('railNoVanityInfoBody')}
              </InfoPopover>
            </div>
            <p className="mt-2 text-sm text-[var(--fg-secondary)]">{t('railNoVanityBody')}</p>
            <div className="mt-4">
              <Button variant="illuminate" size="sm" onClick={() => openModal()}>
                {t('railIlluminateCta')}
              </Button>
            </div>
          </RailCard>
        </aside>
      </div>
    </div>
  );
}

/** A rail card shell matching the design's surface/border/radius tokens. */
function RailCard({
  title,
  children,
}: {
  title?: string;
  children: ReactElement | ReactElement[];
}): ReactElement {
  return (
    <section className="mb-[18px] rounded-[var(--radius-container)] border border-[var(--border-subtle)] bg-[var(--bg-surface-container)] p-5">
      {title !== undefined && (
        <div className="mb-3 flex items-center gap-2">
          <span className="font-mono text-[var(--fg-accent)]">//</span>
          <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--fg-secondary)]">
            {title}
          </h2>
        </div>
      )}
      {children}
    </section>
  );
}
