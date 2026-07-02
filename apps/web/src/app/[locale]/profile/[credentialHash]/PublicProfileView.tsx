/**
 * PublicProfileView — Server component for displaying a public firefly profile.
 *
 * Renders profile information based on disclosure level:
 * - anonymous: pseudonym, stats, badges only
 * - partial: + location
 * - public: + displayName, location, bio
 */

import type { ReactElement } from 'react';
import type { PublicFireflyProfile, PostPreviewForProfile } from '@cocuyo/types';
import Link from 'next/link';
import { PersonhoodBadge, FactCheckerBadge, CollectiveMembershipBadge } from '@cocuyo/ui';

interface PublicProfileViewTranslations {
  backToExplore: string;
  memberSince: string;
  noCollectives: string;
  noPosts: string;
  posts: string;
  corroborations: string;
  reputation: string;
  collectives: string;
  recentPosts: string;
  personhood: {
    full: string;
    lite: string;
    none: string;
  };
  factChecker: {
    verified: string;
    suspended: string;
  };
}

export interface PublicProfileViewProps {
  profile: PublicFireflyProfile;
  posts: readonly PostPreviewForProfile[];
  translations: PublicProfileViewTranslations;
  locale: string;
}

function formatDate(timestamp: number, locale: string): string {
  return new Date(timestamp).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
    year: 'numeric',
    month: 'long',
  });
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days < 1) return 'today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function PublicProfileView({
  profile,
  posts,
  translations: t,
  locale,
}: PublicProfileViewProps): ReactElement {
  const {
    pseudonym,
    disclosureLevel,
    personhoodLevel,
    publicInfo,
    stats,
    reputation,
    collectiveMemberships,
    factCheckerStatus,
    createdAt,
  } = profile;

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-12">
      {/* Back navigation */}
      <Link
        href={`/${locale}/explore`}
        className="inline-flex items-center gap-1 text-sm text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg-primary)]"
      >
        <span aria-hidden="true">&larr;</span>
        {t.backToExplore}
      </Link>

      {/* Profile header */}
      <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
        {/* Avatar and name */}
        <div className="mb-6 flex items-start gap-4">
          {/* Avatar */}
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-surface-container)]">
            <span className="text-2xl font-medium text-[var(--fg-primary)]">
              {pseudonym.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Name and info */}
          <div className="min-w-0 flex-1">
            {/* Display name (only for public disclosure) */}
            {disclosureLevel === 'public' &&
              publicInfo?.displayName != null &&
              publicInfo.displayName !== '' && (
                <h1 className="truncate font-display text-xl font-medium text-[var(--fg-primary)]">
                  {publicInfo.displayName}
                </h1>
              )}
            {/* Pseudonym */}
            <p
              className={
                disclosureLevel === 'public' &&
                publicInfo?.displayName != null &&
                publicInfo.displayName !== ''
                  ? 'text-sm text-[var(--fg-secondary)]'
                  : 'font-display text-xl font-medium text-[var(--fg-primary)]'
              }
            >
              {pseudonym}
            </p>
            {/* Location (partial or public) */}
            {(disclosureLevel === 'partial' || disclosureLevel === 'public') &&
              publicInfo?.location != null &&
              publicInfo.location !== '' && (
                <p className="mt-1 text-sm text-[var(--fg-tertiary)]">{publicInfo.location}</p>
              )}
            {/* Member since */}
            <p className="mt-2 text-xs text-[var(--fg-tertiary)]">
              {t.memberSince} {formatDate(createdAt, locale)}
            </p>
          </div>
        </div>

        {/* Bio (only for public disclosure) */}
        {disclosureLevel === 'public' && publicInfo?.bio != null && publicInfo.bio !== '' && (
          <p className="mb-6 text-sm leading-relaxed text-[var(--fg-secondary)]">
            {publicInfo.bio}
          </p>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <PersonhoodBadge level={personhoodLevel} showLabel size="md" labels={t.personhood} />
          {factCheckerStatus !== 'none' && (
            <FactCheckerBadge status={factCheckerStatus} size="md" labels={t.factChecker} />
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-semibold text-[var(--fg-primary)]">
              {stats.postsCreated}
            </div>
            <div className="text-sm text-[var(--fg-secondary)]">{t.posts}</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-[var(--fg-success)]">
              {stats.corroborationsReceived}
            </div>
            <div className="text-sm text-[var(--fg-secondary)]">{t.corroborations}</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-[var(--fg-primary)]">
              {reputation.overall}
            </div>
            <div className="text-sm text-[var(--fg-secondary)]">{t.reputation}</div>
          </div>
        </div>
      </div>

      {/* Collectives */}
      <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
        <h2 className="mb-4 text-lg font-medium text-[var(--fg-primary)]">{t.collectives}</h2>
        {collectiveMemberships.length === 0 ? (
          <p className="text-sm text-[var(--fg-tertiary)]">{t.noCollectives}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {collectiveMemberships.map((membership) => (
              <CollectiveMembershipBadge
                key={membership.collectiveId}
                collectiveName={membership.collectiveName}
                role={membership.role}
                size="md"
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Posts */}
      <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
        <h2 className="mb-4 text-lg font-medium text-[var(--fg-primary)]">{t.recentPosts}</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-[var(--fg-tertiary)]">{t.noPosts}</p>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/${locale}/posts/${post.id as string}`}
                className="block rounded-nested border border-[var(--border-subtle)] p-4 transition-colors hover:border-[var(--border-default)] hover:bg-[var(--bg-surface-container)]"
              >
                {post.title != null && post.title !== '' && (
                  <h3 className="mb-1 font-medium text-[var(--fg-primary)]">{post.title}</h3>
                )}
                <p className="mb-2 line-clamp-2 text-sm text-[var(--fg-secondary)]">
                  {post.excerpt}
                </p>
                <div className="flex items-center gap-3 text-xs text-[var(--fg-tertiary)]">
                  <span className="flex items-center gap-1">
                    <span className="text-[var(--fg-success)]" aria-hidden="true">
                      ●
                    </span>
                    {post.corroborationCount} {t.corroborations.toLowerCase()}
                  </span>
                  <span>{formatRelativeTime(post.createdAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
