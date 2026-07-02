/**
 * Campaign detail page — View a sponsored fact-checking campaign.
 *
 * Shows:
 * - Campaign title, description, and status
 * - Funding amount and payout mode
 * - Deliverables with progress
 * - Contributing posts
 * - Illuminate CTA
 */

import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { campaignService } from '@/lib/services/campaign-service';
import { signalService } from '@/lib/services/service-instances';
import { formatPUSD, createCampaignId, type Post } from '@cocuyo/types';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { SEED_CAMPAIGN_IDS } from '@/lib/seed-data';
import { IlluminateCTA } from './IlluminateCTA';

interface CampaignPageProps {
  params: Promise<{ locale: string; id: string }>;
}

/**
 * Generate static params for build.
 * With output: export, we must generate all locale+id combinations.
 */
export function generateStaticParams(): { locale: string; id: string }[] {
  const locales = ['en', 'es'];
  const ids = ['_', ...SEED_CAMPAIGN_IDS];
  return locales.flatMap((locale) => ids.map((id) => ({ locale, id })));
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'var(--fg-success)';
    case 'completed':
      return 'var(--color-firefly-gold)';
    case 'expired':
    case 'cancelled':
      return 'var(--fg-tertiary)';
    default:
      return 'var(--fg-secondary)';
  }
}

function getPayoutModeLabel(mode: string, t: { public: string; private: string }): string {
  return mode === 'public' ? t.public : t.private;
}

/**
 * Not found state.
 */
function CampaignNotFound({ locale, t }: { locale: string; t: { campaigns: string } }): ReactNode {
  return (
    <main className="min-h-screen">
      <div className="border-b border-[var(--border-default)]">
        <div className="container mx-auto max-w-3xl px-4 py-4">
          <Link
            href={`/${locale}/bounties`}
            className="inline-flex items-center gap-2 text-sm text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg-primary)]"
          >
            <span aria-hidden="true">&larr;</span>
            <span>{t.campaigns}</span>
          </Link>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="mb-4 font-display text-2xl text-[var(--fg-primary)]">Campaign Not Found</h1>
        <p className="mb-8 text-[var(--fg-secondary)]">
          This campaign doesn&apos;t exist or has been removed.
        </p>
        <Link
          href={`/${locale}/bounties`}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--color-firefly-gold)] px-4 py-2 font-medium text-[var(--bg-default)] transition-opacity hover:opacity-90"
        >
          Browse Campaigns
        </Link>
      </div>
    </main>
  );
}

export default async function CampaignPage({ params }: CampaignPageProps): Promise<ReactElement> {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('campaign');

  const campaignId = createCampaignId(id);
  const campaign = await campaignService.getCampaign(campaignId, locale);

  if (campaign === null) {
    return <CampaignNotFound locale={locale} t={{ campaigns: t('breadcrumb.campaigns') }} />;
  }

  // Get contributing posts
  const contributingPosts = await Promise.all(
    campaign.contributingPostIds.map((postId) => signalService.getPost(postId, locale))
  );
  const posts = contributingPosts.filter((p): p is Post => p !== null);

  const statusColor = getStatusColor(campaign.status);
  const now = Date.now();
  const isExpired = campaign.expiresAt < now;
  const daysLeft = Math.ceil((campaign.expiresAt - now) / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.ceil((campaign.expiresAt - now) / (1000 * 60 * 60));

  // Calculate overall progress
  const totalTarget = campaign.deliverables.reduce((sum, d) => sum + d.target, 0);
  const totalCurrent = campaign.deliverables.reduce((sum, d) => sum + d.current, 0);
  const overallProgress = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;

  const isActive = campaign.status === 'active';

  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="border-b border-[var(--border-default)] py-12">
        <div className="container-wide">
          {/* Breadcrumb */}
          <nav className="mb-6 text-sm">
            <Link
              href={`/${locale}/bounties`}
              className="text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg-primary)]"
            >
              {t('breadcrumb.campaigns')}
            </Link>
            <span className="mx-2 text-[var(--fg-tertiary)]">/</span>
            <span className="text-[var(--fg-primary)]">{t('breadcrumb.detail')}</span>
          </nav>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1">
              {/* Status badge and location */}
              <div className="mb-4 flex items-center gap-3">
                <span
                  className="rounded-full px-3 py-1 text-sm capitalize"
                  style={{
                    color: statusColor,
                    border: `1px solid ${statusColor}`,
                  }}
                >
                  {campaign.status}
                </span>
                {campaign.location !== undefined && (
                  <span className="text-sm text-[var(--fg-tertiary)]">{campaign.location}</span>
                )}
              </div>

              {/* Title */}
              <h1 className="mb-4 text-3xl font-bold">{campaign.title}</h1>

              {/* Sponsor */}
              <p className="mb-4 text-[var(--fg-secondary)]">
                {t('sponsor')}:{' '}
                {campaign.sponsor.type === 'firefly'
                  ? campaign.sponsor.pseudonym
                  : campaign.sponsor.name}
              </p>

              {/* Topics */}
              {campaign.topics.length > 0 && (
                <div className="mb-6 flex flex-wrap gap-2">
                  {campaign.topics.map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full bg-[var(--bg-surface-nested)] px-3 py-1 text-sm text-[var(--fg-secondary)]"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}

              {/* Description */}
              <div className="mt-6">
                <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-[var(--fg-tertiary)]">
                  {t('description')}
                </h2>
                <p className="whitespace-pre-wrap leading-relaxed text-[var(--fg-primary)]">
                  {campaign.description}
                </p>
              </div>
            </div>

            {/* Stats card */}
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6 lg:w-80">
              {/* Funding amount - prominent */}
              <div className="mb-6 border-b border-[var(--border-subtle)] pb-6 text-center">
                <p className="mb-1 text-sm text-[var(--fg-tertiary)]">{t('funding')}</p>
                <p className="text-3xl font-bold text-[var(--color-firefly-gold)]">
                  {formatPUSD(campaign.fundingAmount)}
                </p>
                <p className="mt-2 text-sm text-[var(--fg-secondary)]">
                  {getPayoutModeLabel(campaign.payoutMode, {
                    public: t('paymentPublic'),
                    private: t('paymentPrivate'),
                  })}
                </p>
              </div>

              {/* Progress */}
              <div className="mb-6">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-[var(--fg-tertiary)]">{t('progress')}</span>
                  <span className="font-medium text-[var(--fg-primary)]">{overallProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface-raised)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-firefly-gold)] transition-all"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
              </div>

              {/* Deliverables */}
              {campaign.deliverables.length > 0 && (
                <div className="mb-6">
                  <h3 className="mb-3 text-sm font-medium text-[var(--fg-tertiary)]">
                    {t('deliverables')}
                  </h3>
                  <ul className="space-y-2">
                    {campaign.deliverables.map((d, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span className="text-[var(--fg-secondary)]">
                          {t(`deliverableTypes.${d.type}`)}
                        </span>
                        <span className="text-[var(--fg-primary)]">
                          {d.current}/{d.target}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Expiry */}
              <div className="border-t border-[var(--border-subtle)] pt-4">
                <p className="mb-1 text-sm text-[var(--fg-tertiary)]">{t('expires')}</p>
                <p
                  className={`text-sm font-medium ${isExpired ? 'text-[var(--fg-error)]' : 'text-[var(--fg-primary)]'}`}
                >
                  {isExpired
                    ? t('expired')
                    : daysLeft < 1
                      ? `${hoursLeft}${t('hoursLeftSuffix')}`
                      : daysLeft === 1
                        ? t('dayLeft')
                        : `${daysLeft} ${t('daysLeftSuffix')}`}
                </p>
              </div>

              {/* CTA */}
              {isActive && (
                <div className="mt-6">
                  <IlluminateCTA campaignId={campaign.id} label={t('illuminate')} />
                </div>
              )}

              {/* Completed/Cancelled message */}
              {campaign.status === 'completed' && (
                <p className="mt-4 text-center text-sm text-[var(--fg-success)]">
                  {t('completed')}
                </p>
              )}
              {campaign.status === 'cancelled' && (
                <p className="mt-4 text-center text-sm text-[var(--fg-error)]">{t('cancelled')}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Contributing Posts */}
      <section className="py-8">
        <div className="container-wide">
          <h2 className="mb-6 font-display text-xl font-semibold text-[var(--fg-primary)]">
            {t('contributingPosts')} ({posts.length})
          </h2>

          {posts.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/${locale}/post/${post.id}`}
                  className="block rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-raised)] p-4 transition-colors hover:border-[var(--border-emphasis)]"
                >
                  {post.content.title !== undefined && (
                    <h3 className="mb-2 line-clamp-1 font-medium text-[var(--fg-primary)]">
                      {post.content.title}
                    </h3>
                  )}
                  <p className="line-clamp-3 text-sm text-[var(--fg-secondary)]">
                    {post.content.text}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-[var(--fg-tertiary)]">
                    <span>{post.author.pseudonym}</span>
                    <span>
                      {post.corroborations.witnessCount +
                        post.corroborations.evidenceCount +
                        post.corroborations.expertiseCount}{' '}
                      corroborations
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-nested)] py-12 text-center">
              <p className="mb-4 text-[var(--fg-secondary)]">{t('noPostsYet')}</p>
              {isActive && <IlluminateCTA campaignId={campaign.id} label={t('illuminate')} />}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
