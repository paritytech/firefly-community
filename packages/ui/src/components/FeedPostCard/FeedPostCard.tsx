'use client';

/**
 * FeedPostCard — Full display component for a post in feeds.
 *
 * The card is the primary content element. It must feel substantial
 * without being heavy. Key features:
 * - Author with pseudonym (privacy-controlled)
 * - Verification badge (if verified)
 * - Context tags (topic, location, time)
 * - Post content
 * - Corroboration summary
 * - Chain link (if part of a story chain)
 */

import type { ReactElement } from 'react';
import type { Post, ChainId, CampaignId, PUSDAmount } from '@cocuyo/types';
import { formatPUSDCompact } from '@cocuyo/types';
import { VerificationBadge } from '../VerificationBadge';

/** Campaign info for display on cards */
export interface PostCampaignInfo {
  readonly id: CampaignId;
  readonly title: string;
  readonly fundingAmount: PUSDAmount;
}

/** Translations for FeedPostCard action buttons */
export interface FeedPostCardTranslations {
  corroborate: string;
  dispute: string;
  extractClaim: string;
  extracting: string;
  viewDetails: string;
}

/** Default English translations */
const defaultTranslations: FeedPostCardTranslations = {
  corroborate: 'Corroborate',
  dispute: 'Dispute',
  extractClaim: 'Extract Claim',
  extracting: 'Extracting...',
  viewDetails: 'View details',
};

export interface FeedPostCardProps {
  /** The post to display */
  post: Post;
  /** Optional: Title of the linked chain for display */
  chainTitle?: string;
  /** Optional: Campaign this post contributes to */
  campaign?: PostCampaignInfo | undefined;
  /** Callback when the chain link is clicked */
  onChainClick?: (chainId: ChainId) => void;
  /** Callback when the campaign badge is clicked */
  onCampaignClick?: (campaignId: CampaignId) => void;
  /** Callback when the card itself is clicked */
  onClick?: () => void;
  /** Callback when the author is clicked */
  onAuthorClick?: (credentialHash: string) => void;
  /** Callback when corroborate button is clicked */
  onCorroborate?: () => void;
  /** Callback when dispute button is clicked */
  onDispute?: () => void;
  /** Callback when trust details link is clicked */
  onViewTrust?: () => void;
  /** Callback when extract claim button is clicked */
  onExtractClaim?: () => void;
  /** Whether extract claim is in progress */
  isExtracting?: boolean;
  /** Whether to show action buttons (corroborate/dispute) */
  showActions?: boolean;
  /** Translations for button labels (defaults to English) */
  translations?: Partial<FeedPostCardTranslations>;
}

/**
 * Calculate contention level from corroboration summary.
 * Returns a value from 0-1 where higher means more contested.
 */
function calculateContention(corroborations: {
  witnessCount: number;
  evidenceCount: number;
  expertiseCount: number;
  challengeCount: number;
}): number {
  const { witnessCount, evidenceCount, expertiseCount, challengeCount } = corroborations;
  const supportCount = witnessCount + evidenceCount + expertiseCount;
  const total = supportCount + challengeCount;
  if (total === 0) return 0;
  return challengeCount / total;
}

/**
 * Get contention display info based on level.
 */
function getContentionDisplay(level: number): {
  label: string;
  color: string;
  icon: string;
} | null {
  // Only show indicator if there's meaningful contention
  if (level < 0.15) return null;

  if (level >= 0.5) {
    return {
      label: 'Highly contested',
      color: 'var(--fg-error)',
      icon: '\u26A0', // Warning sign
    };
  }
  if (level >= 0.3) {
    return {
      label: 'Contested',
      color: 'var(--fg-warning)',
      icon: '\u25B2', // Triangle up
    };
  }
  return {
    label: 'Some dispute',
    color: 'var(--fg-tertiary)',
    icon: '\u2022', // Bullet
  };
}

/**
 * Format a Unix timestamp as a relative time string.
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  // Handle both millisecond and second timestamps
  const ts = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const diff = now - ts;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${String(minutes)}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${String(days)}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${String(weeks)}w ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${String(months)}mo ago`;

  const years = Math.floor(days / 365);
  return `${String(years)}y ago`;
}

export function FeedPostCard({
  post,
  chainTitle,
  campaign,
  onChainClick,
  onCampaignClick,
  onClick,
  onAuthorClick,
  onCorroborate,
  onDispute,
  onViewTrust,
  onExtractClaim,
  isExtracting = false,
  showActions = false,
  translations: translationsProp,
}: FeedPostCardProps): ReactElement {
  const { author, content, context, corroborations, verification, chainLinks, createdAt } = post;
  const t = { ...defaultTranslations, ...translationsProp };

  const handleChainClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (onChainClick !== undefined && chainLinks.length > 0 && chainLinks[0] !== undefined) {
      onChainClick(chainLinks[0]);
    }
  };

  const handleAuthorClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (onAuthorClick !== undefined) {
      onAuthorClick(author.credentialHash);
    }
  };

  const handleCampaignClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (onCampaignClick !== undefined && campaign !== undefined) {
      onCampaignClick(campaign.id);
    }
  };

  const handleCorroborate = (e: React.MouseEvent): void => {
    e.stopPropagation();
    onCorroborate?.();
  };

  const handleDispute = (e: React.MouseEvent): void => {
    e.stopPropagation();
    onDispute?.();
  };

  const handleViewTrust = (e: React.MouseEvent): void => {
    e.stopPropagation();
    onViewTrust?.();
  };

  const handleExtractClaim = (e: React.MouseEvent): void => {
    e.stopPropagation();
    onExtractClaim?.();
  };

  return (
    <article
      className={`rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6 transition-all duration-200 ease-out ${onClick !== undefined ? 'hover:-translate-y-0.5 hover:border-[var(--color-firefly-gold)]/40 hover:shadow-[0_4px_20px_rgba(232,185,49,0.08)]' : ''} `}
    >
      {/* Author row */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Author avatar/initial — decorative. The author name button below is the keyboard-
              accessible control; the avatar only adds a mouse-clickable convenience. */}
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-surface-container)] text-sm font-medium text-[var(--fg-primary)] transition-all duration-150 ${onAuthorClick !== undefined ? 'cursor-pointer hover:scale-105 hover:border-[var(--color-firefly-gold)]' : ''} `}
            onClick={onAuthorClick !== undefined ? handleAuthorClick : undefined}
            aria-hidden="true"
          >
            {author.pseudonym.charAt(0).toUpperCase()}
          </div>
          {/* Author name */}
          <div className="flex flex-col">
            <button
              type="button"
              className={`text-left text-sm font-medium text-[var(--fg-primary)] ${onAuthorClick !== undefined ? 'transition-colors hover:text-[var(--color-firefly-gold)]' : ''} `}
              onClick={onAuthorClick !== undefined ? handleAuthorClick : undefined}
              disabled={onAuthorClick === undefined}
            >
              {author.pseudonym}
            </button>
            {/* Show location if partial/public disclosure */}
            {author.location !== undefined && (
              <span className="text-xs text-[var(--fg-tertiary)]">{author.location}</span>
            )}
          </div>
        </div>
        {/* Verification badge */}
        <VerificationBadge
          status={verification.status}
          showLabel={verification.status !== 'unverified'}
        />
      </div>

      {/* Context tags */}
      <div className="mb-3 flex items-center gap-2 text-xs text-[var(--fg-tertiary)]">
        {context.topics.length > 0 && <span className="capitalize">{context.topics[0]}</span>}
        {context.locationName !== undefined && (
          <>
            <span aria-hidden="true">&middot;</span>
            <span>{context.locationName}</span>
          </>
        )}
        <span aria-hidden="true">&middot;</span>
        <time dateTime={new Date(createdAt > 1e12 ? createdAt : createdAt * 1000).toISOString()}>
          {formatRelativeTime(createdAt)}
        </time>
      </div>

      {/* Content — the keyboard-accessible navigation target. The whole card is no longer a
          button, so it can't nest the author/action buttons inside an interactive element. */}
      {onClick !== undefined ? (
        <button
          type="button"
          onClick={onClick}
          className="mb-4 block w-full cursor-pointer text-left text-base leading-relaxed text-[var(--fg-primary)] transition-colors hover:text-[var(--color-firefly-gold)]"
        >
          {content.text}
        </button>
      ) : (
        <p className="mb-4 text-base leading-relaxed text-[var(--fg-primary)]">{content.text}</p>
      )}

      {/* Media preview */}
      {content.media !== undefined && content.media.length > 0 && (
        <div className="mb-4">
          {content.media.length === 1 && content.media[0] !== undefined && (
            <div className="rounded-nested overflow-hidden">
              <div
                className="flex h-48 w-full items-center justify-center bg-[var(--bg-surface-container)] text-[var(--fg-tertiary)]"
                aria-label={content.media[0].altText ?? 'Attached image'}
              >
                <svg
                  className="h-12 w-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>
          )}
          {content.media.length > 1 && (
            <div className="flex items-center gap-2">
              <div className="rounded-nested flex h-24 w-24 items-center justify-center bg-[var(--bg-surface-container)] text-[var(--fg-tertiary)]">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              {content.media.length > 1 && (
                <span className="text-sm text-[var(--fg-tertiary)]">
                  +{content.media.length - 1} more
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Corroboration summary */}
      {(() => {
        const contentionLevel = calculateContention(corroborations);
        const contentionDisplay = getContentionDisplay(contentionLevel);

        return (
          <div className="mb-4">
            {/* Contention indicator - shown when there's meaningful disagreement */}
            {contentionDisplay !== null && (
              <div
                className="mb-2 flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium"
                style={{
                  backgroundColor: `color-mix(in srgb, ${contentionDisplay.color} 12%, transparent)`,
                  color: contentionDisplay.color,
                }}
              >
                <span aria-hidden="true">{contentionDisplay.icon}</span>
                <span>{contentionDisplay.label}</span>
                <span className="text-[var(--fg-tertiary)]">— needs fact-checking</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-[var(--fg-secondary)]">
                <span className="flex items-center gap-1">
                  <span className="text-[var(--fg-success)]" aria-hidden="true">
                    &#9673;
                  </span>
                  <span>
                    <span className="text-[var(--fg-success)]">
                      {corroborations.witnessCount + corroborations.expertiseCount}
                    </span>{' '}
                    corroborations
                  </span>
                </span>
                {corroborations.evidenceCount > 0 && (
                  <span className="flex items-center gap-1">
                    <span aria-hidden="true">&#9889;</span>
                    <span>{corroborations.evidenceCount} evidence</span>
                  </span>
                )}
                {corroborations.challengeCount > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="text-[var(--fg-error)]" aria-hidden="true">
                      &#9651;
                    </span>
                    <span>
                      <span className="text-[var(--fg-error)]">
                        {corroborations.challengeCount}
                      </span>{' '}
                      challenge{corroborations.challengeCount !== 1 ? 's' : ''}
                    </span>
                  </span>
                )}
              </div>
              {/* View trust details link */}
              {onViewTrust !== undefined && (
                <button
                  type="button"
                  onClick={handleViewTrust}
                  className="text-xs text-[var(--fg-tertiary)] transition-colors hover:text-[var(--fg-accent)]"
                >
                  {t.viewDetails}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Action buttons */}
      {showActions && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleCorroborate}
            className="rounded-nested flex items-center gap-1.5 border border-[var(--fg-success)]/30 px-3 py-1.5 text-sm font-medium text-[var(--fg-success)] transition-colors hover:bg-[var(--fg-success)]/10"
          >
            <span aria-hidden="true">&#9673;</span>
            {t.corroborate}
          </button>
          <button
            type="button"
            onClick={handleDispute}
            className="rounded-nested flex items-center gap-1.5 border border-[var(--fg-error)]/30 px-3 py-1.5 text-sm font-medium text-[var(--fg-error)] transition-colors hover:bg-[var(--fg-error)]/10"
          >
            <span aria-hidden="true">&#9651;</span>
            {t.dispute}
          </button>
          {onExtractClaim !== undefined && (
            <button
              type="button"
              onClick={handleExtractClaim}
              disabled={isExtracting}
              className={`rounded-nested flex items-center gap-1.5 border border-[var(--color-firefly-gold)]/30 px-3 py-1.5 text-sm font-medium text-[var(--color-firefly-gold)] transition-colors hover:bg-[var(--color-firefly-gold)]/10 ${isExtracting ? 'cursor-wait opacity-70' : ''}`}
            >
              {isExtracting ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  <span>{t.extracting}</span>
                </>
              ) : (
                <>
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                  <span>{t.extractClaim}</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Chain link */}
      {chainLinks.length > 0 && chainTitle !== undefined && (
        <div className="border-t border-[var(--border-subtle)] pt-4">
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg-accent)]"
            onClick={handleChainClick}
          >
            <span>Part of:</span>
            <span className="text-[var(--fg-primary)]">{chainTitle}</span>
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      )}

      {/* Campaign badge */}
      {campaign !== undefined && (
        <div
          className={`mt-3 pt-3 ${chainLinks.length > 0 && chainTitle !== undefined ? '' : 'border-t border-[var(--border-subtle)]'}`}
        >
          <button
            type="button"
            onClick={handleCampaignClick}
            className="inline-flex items-center gap-2 text-sm text-[var(--fg-secondary)] transition-colors hover:text-[var(--color-firefly-gold)]"
          >
            <span className="rounded border border-[var(--color-firefly-gold)]/30 bg-[var(--color-firefly-gold)]/15 px-1.5 py-0.5 text-xs font-medium text-[var(--color-firefly-gold)]">
              Earn {formatPUSDCompact(campaign.fundingAmount)}
            </span>
            <span className="max-w-[200px] truncate">{campaign.title}</span>
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      )}
    </article>
  );
}
