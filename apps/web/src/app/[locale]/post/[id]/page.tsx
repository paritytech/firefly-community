/**
 * Post detail page — View a single post with its claims.
 */

import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { postService } from '@/lib/services/service-instances';
import { claimService } from '@/lib/services/claim-service';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ClaimCard } from '@cocuyo/ui';
import { validatePostId } from '@/lib/utils/validators';
import { PostActions } from './PostActions';
import { ExternalLink } from '@/components/ExternalLink';

interface PostDetailPageProps {
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
  const ids = ['_', 'seed-post-001', 'seed-post-002', 'seed-post-003'];
  return locales.flatMap((locale) => ids.map((id) => ({ locale, id })));
}

/**
 * Empty state component shown when post is not found.
 */
function PostNotFound({ locale }: { locale: string }): ReactNode {
  return (
    <main className="min-h-screen bg-[var(--bg-default)]">
      <div className="border-b border-[var(--border-default)]">
        <div className="container mx-auto max-w-3xl px-4 py-4">
          <Link
            href={`/${locale}/posts`}
            className="inline-flex items-center gap-2 text-sm text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg-primary)]"
          >
            <span aria-hidden="true">&larr;</span>
            <span>Back to Posts</span>
          </Link>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="mb-4 font-display text-2xl text-[var(--fg-primary)]">Post Not Found</h1>
        <p className="mb-8 text-[var(--fg-secondary)]">
          This post doesn&apos;t exist or hasn&apos;t been created yet.
        </p>
        <Link
          href={`/${locale}/posts`}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--bg-default)] transition-opacity hover:opacity-90"
        >
          Browse Posts
        </Link>
      </div>
    </main>
  );
}

export default async function PostDetailPage({
  params,
}: PostDetailPageProps): Promise<ReactElement> {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tPosts = await getTranslations('posts');
  const tClaims = await getTranslations('claims');

  const postId = validatePostId(id);
  if (postId === null) {
    return <PostNotFound locale={locale} />;
  }

  // Fetch the post
  const post = await postService.getPost(postId, locale);

  if (post === null) {
    return <PostNotFound locale={locale} />;
  }

  // Fetch claims for this post
  const claims = await claimService.getClaimsByPost(post.id, locale);

  // Build topic translation map
  const topicTranslations: Record<string, string> = {};
  for (const topic of post.context.topics) {
    try {
      topicTranslations[topic] = tPosts(`topics.${topic}`);
    } catch {
      topicTranslations[topic] = topic.replace(/-/g, ' ');
    }
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <div className="container-wide py-6">
          <Link
            href={`/${locale}/posts`}
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg-primary)]"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span>{tPosts('backToPosts')}</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <article className="py-8">
        <div className="container-wide max-w-3xl">
          {/* Title */}
          <h1 className="mb-4 font-display text-2xl font-medium text-[var(--fg-primary)]">
            {post.content.title}
          </h1>

          {/* Meta info */}
          <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-[var(--fg-secondary)]">
            <span>
              By{' '}
              <Link
                href={`/${locale}/profile/${post.author.credentialHash}`}
                className="text-[var(--fg-primary)] hover:text-[var(--color-firefly-gold)] hover:underline"
              >
                {post.author.pseudonym}
              </Link>
            </span>
            {post.context.locationName !== undefined && (
              <>
                <span className="text-[var(--fg-tertiary)]">•</span>
                <span>{post.context.locationName}</span>
              </>
            )}
            <span className="text-[var(--fg-tertiary)]">•</span>
            <span>{new Date(post.createdAt).toLocaleDateString()}</span>
          </div>

          {/* Topics */}
          <div className="mb-6 flex flex-wrap gap-2">
            {post.context.topics.map((topic) => (
              <span
                key={topic}
                className="rounded-full bg-[var(--bg-surface-nested)] px-2 py-1 text-xs text-[var(--fg-secondary)]"
              >
                {topicTranslations[topic] ?? topic.replace(/-/g, ' ')}
              </span>
            ))}
          </div>

          {/* Post content */}
          <div className="prose prose-invert mb-8 max-w-none">
            {post.content.text.split('\n\n').map((paragraph, index) => (
              <p key={index} className="mb-4 leading-relaxed text-[var(--fg-primary)]">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Links */}
          {post.content.links !== undefined && post.content.links.length > 0 && (
            <div className="mb-8 rounded-container bg-[var(--bg-surface-nested)] p-4">
              <h3 className="mb-2 text-sm font-medium text-[var(--fg-primary)]">
                {tPosts('sources')}
              </h3>
              <ul className="space-y-1">
                {post.content.links.map((link, index) => (
                  <li key={index}>
                    <ExternalLink
                      href={link}
                      className="break-all text-sm text-[var(--color-firefly-gold)] hover:underline"
                    >
                      {link}
                    </ExternalLink>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <PostActions
            post={post}
            translations={{
              extractClaim: tClaims('extractClaim'),
              extracting: tClaims('extracting'),
              claimExtracted: tClaims('claimExtracted'),
              noClaimFound: tClaims('noClaimFound'),
              extractionFailed: tClaims('extractionFailed'),
              extractionUnavailable: tClaims('extractionUnavailable'),
              claimSaveFailed: tClaims('claimSaveFailed'),
              extractedClaimTitle: tClaims('extractedClaimTitle'),
              extractedClaimSaved: tClaims('extractedClaimSaved'),
              close: tClaims('close'),
              corroborate: tPosts('corroborate'),
              dispute: tPosts('dispute'),
              viewTrust: tPosts('viewTrust'),
              addToStory: tPosts('addToStory'),
            }}
          />

          {/* Extracted Claims Section */}
          {claims.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-4 font-display text-lg font-medium text-[var(--fg-primary)]">
                {tClaims('extractedClaims')} ({claims.length})
              </h2>
              <div className="space-y-3">
                {claims.map((claim) => (
                  <Link key={claim.id} href={`/${locale}/claim/${claim.id}`}>
                    <ClaimCard
                      claim={{
                        id: claim.id,
                        statement: claim.statement,
                        sourcePostId: claim.sourcePostId,
                        status: claim.status,
                        topics: claim.topics,
                        evidenceCount: claim.evidence.length,
                        supportingCount: claim.evidence.filter((e) => e.supports).length,
                        contradictingCount: claim.evidence.filter((e) => !e.supports).length,
                        createdAt: claim.createdAt,
                      }}
                      topicTranslations={topicTranslations}
                      translations={{
                        supporting: tClaims('supporting'),
                        contradicting: tClaims('contradicting'),
                        evidence: tClaims('evidence'),
                        viewClaim: tClaims('viewClaim'),
                        statusPending: tClaims('statusPending'),
                        statusUnderReview: tClaims('statusUnderReview'),
                        statusVerified: tClaims('statusVerified'),
                        statusDisputed: tClaims('statusDisputed'),
                        statusFalse: tClaims('statusFalse'),
                        statusUnverifiable: tClaims('statusUnverifiable'),
                      }}
                    />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </article>
    </main>
  );
}
