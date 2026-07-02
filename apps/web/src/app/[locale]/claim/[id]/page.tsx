/**
 * Claim detail page — View a single claim with its evidence.
 */

import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { claimService } from '@/lib/services/claim-service';
import { signalService, postService } from '@/lib/services/service-instances';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ClaimStatusBadge } from '@cocuyo/ui';
import { validateClaimId } from '@/lib/utils/validators';
import { ClaimActions } from './ClaimActions';
import { VerdictVotingPanel } from '@/components/VerdictVoting';

interface ClaimDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
}

/**
 * Generate static params for build.
 * With output: export, we must generate all locale+id combinations.
 */
export function generateStaticParams(): { locale: string; id: string }[] {
  const locales = ['en', 'es'];
  const ids = ['_', 'seed-claim-001'];
  return locales.flatMap((locale) => ids.map((id) => ({ locale, id })));
}

/**
 * Empty state component shown when claim is not found.
 */
function ClaimNotFound({ locale }: { locale: string }): ReactNode {
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
        <h1 className="mb-4 font-display text-2xl text-[var(--fg-primary)]">Claim Not Found</h1>
        <p className="mb-8 text-[var(--fg-secondary)]">
          This claim doesn&apos;t exist or hasn&apos;t been extracted yet.
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

export default async function ClaimDetailPage({
  params,
}: ClaimDetailPageProps): Promise<ReactElement> {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tClaims = await getTranslations('claims');
  const tPosts = await getTranslations('posts');

  const claimId = validateClaimId(id);
  if (claimId === null) {
    return <ClaimNotFound locale={locale} />;
  }

  // Fetch the claim
  const claim = await claimService.getClaim(claimId, locale);

  if (claim === null) {
    return <ClaimNotFound locale={locale} />;
  }

  // Fetch the source post
  const sourcePost = await postService.getPost(claim.sourcePostId, locale);

  // Fetch evidence posts
  const evidencePosts = await Promise.all(
    claim.evidence.map(async (e) => {
      const post = await signalService.getPost(e.postId, locale);
      return { ...e, post };
    })
  );

  const supportingEvidence = evidencePosts.filter((e) => e.supports);
  const contradictingEvidence = evidencePosts.filter((e) => !e.supports);

  // Build topic translation map
  const topicTranslations: Record<string, string> = {};
  for (const topic of claim.topics) {
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
            href={sourcePost !== null ? `/${locale}/post/${sourcePost.id}` : `/${locale}/posts`}
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
            <span>{tClaims('backToPost')}</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <article className="py-8">
        <div className="container-wide max-w-3xl">
          {/* Status badge and meta */}
          <div className="mb-4 flex items-center gap-3">
            <ClaimStatusBadge
              status={claim.status}
              size="md"
              translations={{
                pending: tClaims('statusPending'),
                under_review: tClaims('statusUnderReview'),
                verified: tClaims('statusVerified'),
                disputed: tClaims('statusDisputed'),
                false: tClaims('statusFalse'),
                unverifiable: tClaims('statusUnverifiable'),
              }}
            />
            <span className="text-sm text-[var(--fg-tertiary)]">
              {new Date(claim.createdAt).toLocaleDateString()}
            </span>
          </div>

          {/* Claim statement */}
          <blockquote className="mb-6 border-l-2 border-[var(--color-firefly-gold)] pl-4 text-xl font-medium text-[var(--fg-primary)]">
            &ldquo;{claim.statement}&rdquo;
          </blockquote>

          {/* Source post link */}
          {sourcePost !== null && (
            <div className="mb-6 rounded-container bg-[var(--bg-surface-nested)] p-4">
              <p className="mb-1 text-xs text-[var(--fg-tertiary)]">{tClaims('extractedFrom')}</p>
              <Link
                href={`/${locale}/post/${sourcePost.id}`}
                className="text-sm text-[var(--fg-primary)] transition-colors hover:text-[var(--color-firefly-gold)]"
              >
                {sourcePost.content.title}
              </Link>
            </div>
          )}

          {/* Topics */}
          <div className="mb-8 flex flex-wrap gap-2">
            {claim.topics.map((topic) => (
              <span
                key={topic}
                className="rounded-full bg-[var(--bg-surface-nested)] px-2 py-1 text-xs text-[var(--fg-secondary)]"
              >
                {topicTranslations[topic] ?? topic.replace(/-/g, ' ')}
              </span>
            ))}
          </div>

          {/* Action buttons */}
          <ClaimActions
            claimId={claim.id}
            claimStatement={claim.statement}
            translations={{
              submitEvidence: tClaims('submitEvidence'),
              signInToSubmit: tClaims('signInToSubmit'),
              evidenceSubmitted: tClaims('evidenceSubmitted'),
              supportThisClaim: tClaims('supportThisClaim'),
              contradictThisClaim: tClaims('contradictThisClaim'),
            }}
          />

          {/* Collective verdict voting */}
          <div className="mb-8">
            <VerdictVotingPanel
              claimId={claim.id}
              claimStatement={claim.statement}
              translations={{
                title: tClaims('collectiveVerification'),
                noProposals: tClaims('noActiveProposals'),
                createProposal: tClaims('createProposal'),
                castYourVote: tClaims('castYourVote'),
                alreadyVoted: tClaims('alreadyVoted'),
                notAMember: tClaims('joinCollectiveToVote'),
                connectWallet: tClaims('connectToVote'),
                loading: tClaims('loading'),
              }}
            />
          </div>

          {/* Verdict section (if exists) */}
          {claim.verdict !== undefined && (
            <section className="mb-8 rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4">
              <h2 className="mb-2 text-sm font-medium text-[var(--fg-primary)]">
                {tClaims('verdict')}
              </h2>
              <p className="mb-2 text-sm text-[var(--fg-secondary)]">{claim.verdict.reasoning}</p>
              <p className="text-xs text-[var(--fg-tertiary)]">
                {tClaims('issuedOn')} {new Date(claim.verdict.issuedAt).toLocaleDateString()}
              </p>
            </section>
          )}

          {/* Evidence sections */}
          <div className="space-y-8">
            {/* Supporting evidence */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-medium text-[var(--fg-primary)]">
                <span className="text-[var(--fg-success)]">+</span>
                {tClaims('supportingEvidence')} ({supportingEvidence.length})
              </h2>
              {supportingEvidence.length === 0 ? (
                <p className="text-sm italic text-[var(--fg-tertiary)]">
                  {tClaims('noSupportingEvidence')}
                </p>
              ) : (
                <div className="space-y-3">
                  {supportingEvidence.map((e) => (
                    <div
                      key={e.postId}
                      className="border-[var(--fg-success)]/20 rounded-container border bg-[var(--bg-surface-nested)] p-4"
                    >
                      {e.post !== null && (
                        <Link
                          href={`/${locale}/post/${e.post.id}`}
                          className="block transition-opacity hover:opacity-80"
                        >
                          <p className="mb-2 line-clamp-2 text-sm text-[var(--fg-primary)]">
                            {e.post.content.text}
                          </p>
                          <p className="text-xs text-[var(--fg-tertiary)]">
                            By {e.post.author.pseudonym}
                          </p>
                        </Link>
                      )}
                      {e.note !== undefined && (
                        <p className="mt-2 text-xs italic text-[var(--fg-secondary)]">
                          Note: {e.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Contradicting evidence */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-medium text-[var(--fg-primary)]">
                <span className="text-[var(--fg-error)]">-</span>
                {tClaims('contradictingEvidence')} ({contradictingEvidence.length})
              </h2>
              {contradictingEvidence.length === 0 ? (
                <p className="text-sm italic text-[var(--fg-tertiary)]">
                  {tClaims('noContradictingEvidence')}
                </p>
              ) : (
                <div className="space-y-3">
                  {contradictingEvidence.map((e) => (
                    <div
                      key={e.postId}
                      className="border-[var(--fg-error)]/20 rounded-container border bg-[var(--bg-surface-nested)] p-4"
                    >
                      {e.post !== null && (
                        <Link
                          href={`/${locale}/post/${e.post.id}`}
                          className="block transition-opacity hover:opacity-80"
                        >
                          <p className="mb-2 line-clamp-2 text-sm text-[var(--fg-primary)]">
                            {e.post.content.text}
                          </p>
                          <p className="text-xs text-[var(--fg-tertiary)]">
                            By {e.post.author.pseudonym}
                          </p>
                        </Link>
                      )}
                      {e.note !== undefined && (
                        <p className="mt-2 text-xs italic text-[var(--fg-secondary)]">
                          Note: {e.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </article>
    </main>
  );
}
