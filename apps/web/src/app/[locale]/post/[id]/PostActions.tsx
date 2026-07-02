'use client';

/**
 * PostActions — Action buttons for post detail page.
 *
 * Provides Extract Claim and Illuminate FAB buttons.
 * Shows different states based on wallet connection.
 */

import { useState, type ReactElement } from 'react';
import type { Post } from '@cocuyo/types';
import { useToast } from '@cocuyo/ui';
import { IlluminateFAB } from '@/components/IlluminateFAB';
import { useCorroborateDispute } from '@/components/CorroborateDisputeSheet';
import { useTrustDrawer } from '@/components/TrustDrawer';
import { useAddToStory } from '@/components/AddToStorySheet';
import { useAppState } from '@/components/AppStateProvider';
import { extractBestClaim } from '@/lib/ai';
import { createLogger } from '@/lib/logging';

const log = createLogger('PostActions');

export interface PostActionsProps {
  post: Post;
  translations: {
    extractClaim: string;
    extracting: string;
    claimExtracted: string;
    noClaimFound: string;
    extractionFailed: string;
    extractionUnavailable: string;
    claimSaveFailed: string;
    extractedClaimTitle: string;
    extractedClaimSaved: string;
    close: string;
    corroborate: string;
    dispute: string;
    viewTrust: string;
    addToStory: string;
  };
}

export function PostActions({ post, translations: t }: PostActionsProps): ReactElement {
  const { extractClaim } = useAppState();
  const { addToast } = useToast();
  const [isExtracting, setIsExtracting] = useState(false);
  // The AI-extracted claim text, shown on screen once the worker returns. The on-chain save is
  // attempted best-effort; the extracted claim is surfaced regardless so the feature is usable even
  // while the host wallet account is unavailable (the save persists automatically once it resolves).
  const [extractedClaim, setExtractedClaim] = useState<string | null>(null);
  const [extractedClaimSaved, setExtractedClaimSaved] = useState(false);
  const { openSheet: openCorroborateSheet } = useCorroborateDispute();
  const { openDrawer: openTrustDrawer } = useTrustDrawer();
  const { openSheet: openAddToStorySheet } = useAddToStory();

  // Open the corroborate/dispute sheet directly — the same behavior as the explore feed
  // (ExploreExperience). The sheet drives the host-signed submission; gating these on a React
  // `isConnected`/personhood check here (but not on explore) is what produced the inconsistent
  // "Sign in to continue" toast on the post-detail page while the feed worked.
  const handleCorroborate = (): void => {
    openCorroborateSheet({ post, mode: 'corroborate' });
  };

  const handleDispute = (): void => {
    openCorroborateSheet({ post, mode: 'dispute' });
  };

  const handleViewTrust = (): void => {
    openTrustDrawer(post.id);
  };

  const handleAddToStory = (): void => {
    openAddToStorySheet(post);
  };

  const handleExtractClaim = async (): Promise<void> => {
    setIsExtracting(true);

    try {
      // Use AI to extract the best verifiable claim from the post
      const result = await extractBestClaim(post.content.text);

      // Handle different result types with specific messages
      if (!result.ok) {
        if (result.reason === 'not_configured') {
          addToast(t.extractionUnavailable, 'warning');
        } else {
          addToast(t.extractionFailed, 'error');
        }
        return;
      }

      if (result.claim === null) {
        addToast(t.noClaimFound, 'warning');
        return;
      }

      // Surface the extracted claim on screen immediately — this is the deliverable the user sees.
      setExtractedClaim(result.claim);

      // Best-effort on-chain save (pass the post's topics; the post is in hand here). Returns null
      // when the host wallet account isn't available; we still show the claim above either way.
      const claim = await extractClaim(post.id, result.claim, [...post.context.topics]);

      if (claim !== null) {
        setExtractedClaimSaved(true);
        addToast(t.claimExtracted, 'success');
      } else {
        // AI succeeded; the on-chain write didn't (real reason logged at the upload layer). The
        // claim text is already shown above, so the feature still works for the user.
        setExtractedClaimSaved(false);
        log.error('Claim save returned null after AI extraction', 'handleExtractClaim');
      }
    } catch (error) {
      log.error('Extract claim failed', 'handleExtractClaim', error);
      addToast(t.extractionFailed, 'error');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <>
      {/* Primary action buttons */}
      <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
        {/* Corroborate */}
        <button
          type="button"
          onClick={handleCorroborate}
          className="border-[var(--fg-success)]/30 hover:bg-[var(--fg-success)]/10 inline-flex items-center gap-2 rounded-nested border px-4 py-2.5 text-sm font-medium text-[var(--fg-success)] transition-colors"
        >
          <span aria-hidden="true">&#9673;</span>
          <span>{t.corroborate}</span>
        </button>

        {/* Dispute */}
        <button
          type="button"
          onClick={handleDispute}
          className="border-[var(--fg-error)]/30 hover:bg-[var(--fg-error)]/10 inline-flex items-center gap-2 rounded-nested border px-4 py-2.5 text-sm font-medium text-[var(--fg-error)] transition-colors"
        >
          <span aria-hidden="true">&#9651;</span>
          <span>{t.dispute}</span>
        </button>

        {/* View Trust */}
        <button
          type="button"
          onClick={handleViewTrust}
          className="inline-flex items-center gap-2 rounded-nested border border-[var(--border-default)] px-4 py-2.5 text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--fg-accent)] hover:text-[var(--fg-accent)]"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <span>{t.viewTrust}</span>
        </button>

        {/* Add to Story */}
        <button
          type="button"
          onClick={handleAddToStory}
          className="inline-flex items-center gap-2 rounded-nested border border-[var(--border-default)] px-4 py-2.5 text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--fg-accent)] hover:text-[var(--fg-accent)]"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <span>{t.addToStory}</span>
        </button>

        {/* Extract Claim */}
        <button
          type="button"
          onClick={() => {
            void handleExtractClaim();
          }}
          disabled={isExtracting}
          className={`border-[var(--color-firefly-gold)]/30 hover:bg-[var(--color-firefly-gold)]/10 inline-flex items-center gap-2 rounded-nested border px-4 py-2.5 text-sm font-medium text-[var(--color-firefly-gold)] transition-all duration-200 ${isExtracting ? 'cursor-wait opacity-70' : ''} `}
        >
          {isExtracting ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
                className="h-4 w-4"
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
      </div>

      {/* Extracted-claim display — shows the AI-extracted claim text. Surfaced regardless of whether
          the on-chain save succeeded, so the feature is usable while the host wallet is unavailable. */}
      {extractedClaim !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="extracted-claim-title"
          onClick={() => setExtractedClaim(null)}
        >
          <div
            className="w-full max-w-lg rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2
                id="extracted-claim-title"
                className="font-display text-lg font-medium text-[var(--fg-primary)]"
              >
                {t.extractedClaimTitle}
              </h2>
              <button
                type="button"
                onClick={() => setExtractedClaim(null)}
                aria-label={t.close}
                className="text-[var(--fg-tertiary)] transition-colors hover:text-[var(--fg-primary)]"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mb-4 text-base leading-relaxed text-[var(--fg-primary)]">
              {extractedClaim}
            </p>
            {extractedClaimSaved && (
              <p className="text-sm text-[var(--fg-tertiary)]">{t.extractedClaimSaved}</p>
            )}
          </div>
        </div>
      )}

      {/* Floating action button */}
      <IlluminateFAB />
    </>
  );
}
