/**
 * Campaigns page — Browse sponsored fact-checking campaigns.
 *
 * Shows active verification campaigns where users can contribute evidence.
 * URL kept as /bounties for backwards compatibility.
 */

import type { ReactElement } from 'react';
import Link from 'next/link';
import { campaignService } from '@/lib/services/campaign-service';
import type { CampaignPreview } from '@cocuyo/types';
import { formatPUSD } from '@cocuyo/types';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EmptyState } from '@cocuyo/ui';
import { CampaignsHeader } from './CampaignsHeader';

interface BountiesPageProps {
  params: Promise<{ locale: string }>;
}

function CampaignCard({
  campaign,
  locale,
  t,
}: {
  campaign: CampaignPreview;
  locale: string;
  t: {
    funding: string;
    progress: string;
    contributions: string;
    contributionSingular: string;
    expires: string;
    expired: string;
    viewDetails: string;
  };
}): ReactElement {
  const now = Date.now();
  const isExpired = campaign.expiresAt < now;
  const daysLeft = Math.ceil((campaign.expiresAt - now) / (1000 * 60 * 60 * 24));

  return (
    <Link
      href={`/${locale}/campaign/${campaign.id}`}
      className="block rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-raised)] p-5 transition-colors hover:border-[var(--border-emphasis)]"
    >
      {/* Status badge */}
      <div className="mb-3 flex items-center justify-between">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            campaign.status === 'active'
              ? 'bg-[var(--fg-success)]/10 text-[var(--fg-success)]'
              : campaign.status === 'completed'
                ? 'bg-[var(--color-firefly-gold)]/10 text-[var(--color-firefly-gold)]'
                : 'bg-[var(--fg-tertiary)]/10 text-[var(--fg-tertiary)]'
          }`}
        >
          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
        </span>
        <span className="text-sm font-medium text-[var(--color-firefly-gold)]">
          {formatPUSD(campaign.fundingAmount)}
        </span>
      </div>

      {/* Title */}
      <h3 className="mb-2 line-clamp-2 text-lg font-medium text-[var(--fg-primary)]">
        {campaign.title}
      </h3>

      {/* Sponsor */}
      <p className="mb-3 text-sm text-[var(--fg-secondary)]">
        {campaign.sponsor.type === 'firefly' ? campaign.sponsor.pseudonym : campaign.sponsor.name}
      </p>

      {/* Topics */}
      {campaign.topics.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {campaign.topics.slice(0, 3).map((topic) => (
            <span
              key={topic}
              className="rounded bg-[var(--bg-surface-nested)] px-2 py-0.5 text-xs text-[var(--fg-tertiary)]"
            >
              {topic}
            </span>
          ))}
          {campaign.topics.length > 3 && (
            <span className="text-xs text-[var(--fg-tertiary)]">+{campaign.topics.length - 3}</span>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-xs text-[var(--fg-tertiary)]">
          <span>{t.progress}</span>
          <span>{campaign.deliverableProgress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface-nested)]">
          <div
            className="h-full rounded-full bg-[var(--color-firefly-gold)] transition-all"
            style={{ width: `${campaign.deliverableProgress}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[var(--fg-tertiary)]">
        <span>
          {campaign.contributionCount}{' '}
          {campaign.contributionCount === 1 ? t.contributionSingular : t.contributions}
        </span>
        <span className={isExpired ? 'text-[var(--fg-error)]' : ''}>
          {isExpired ? t.expired : `${daysLeft}d left`}
        </span>
      </div>
    </Link>
  );
}

export default async function BountiesPage({ params }: BountiesPageProps): Promise<ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('campaigns');
  const tDetail = await getTranslations('campaign');

  // Get all campaigns
  const campaignsResult = await campaignService.getCampaigns({
    locale,
    pagination: { limit: 50, offset: 0 },
  });

  const campaigns = campaignsResult.items;
  const activeCampaigns = campaigns.filter((c) => c.status === 'active');
  const otherCampaigns = campaigns.filter((c) => c.status !== 'active');

  // Parse info popover content - split by double newlines for paragraphs
  const infoBody = t('info.body')
    .split('\n\n')
    .map((paragraph: string, index: number) => (
      <p key={index} className={index > 0 ? 'mt-3' : ''}>
        {paragraph}
      </p>
    ));

  return (
    <main className="min-h-screen">
      {/* Header */}
      <CampaignsHeader
        title={t('title')}
        description={t('description')}
        createLabel={t('createButton')}
        infoTitle={t('info.title')}
        infoBody={infoBody}
      />

      {/* Campaigns grid */}
      <section className="py-6">
        <div className="container-wide">
          {campaigns.length === 0 ? (
            <EmptyState
              title={t('empty.campaigns.title')}
              description={t('empty.campaigns.description')}
            />
          ) : (
            <div className="space-y-8">
              {/* Active campaigns */}
              {activeCampaigns.length > 0 && (
                <div>
                  <h2 className="mb-4 font-display text-xl font-semibold text-[var(--fg-primary)]">
                    {t('statusActive')} ({activeCampaigns.length})
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {activeCampaigns.map((campaign) => (
                      <CampaignCard
                        key={campaign.id}
                        campaign={campaign}
                        locale={locale}
                        t={{
                          funding: tDetail('funding'),
                          progress: tDetail('progress'),
                          contributions: tDetail('postsWord'),
                          contributionSingular: tDetail('postWord'),
                          expires: tDetail('expires'),
                          expired: tDetail('expired'),
                          viewDetails: tDetail('breadcrumb.detail'),
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Other campaigns */}
              {otherCampaigns.length > 0 && (
                <div>
                  <h2 className="mb-4 font-display text-xl font-semibold text-[var(--fg-tertiary)]">
                    Past Campaigns ({otherCampaigns.length})
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {otherCampaigns.map((campaign) => (
                      <CampaignCard
                        key={campaign.id}
                        campaign={campaign}
                        locale={locale}
                        t={{
                          funding: tDetail('funding'),
                          progress: tDetail('progress'),
                          contributions: tDetail('postsWord'),
                          contributionSingular: tDetail('postWord'),
                          expires: tDetail('expires'),
                          expired: tDetail('expired'),
                          viewDetails: tDetail('breadcrumb.detail'),
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
