'use client';

/**
 * TrustDrawer — Detailed verification information for a post.
 *
 * Responsive: bottom sheet on mobile, side drawer on desktop.
 * Shows claims, evidence, verdicts, and campaign information.
 */

import { useEffect, useRef, useCallback, type ReactElement } from 'react';
import { formatPUSDCompact } from '@cocuyo/types';
import { useTrustDrawer } from './TrustDrawerProvider';
import { useAppState } from '@/components/AppStateProvider';
import { ClaimSection } from './ClaimSection';
import { EvidenceSection } from './EvidenceSection';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function TrustDrawer(): ReactElement | null {
  const { isOpen, postId, closeDrawer } = useTrustDrawer();
  const { getPost, getPostClaims, getPostCorroborations, getPostCampaigns } = useAppState();
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Get data for the post
  const post = postId !== null ? getPost(postId) : undefined;
  const claims = postId !== null ? getPostClaims(postId) : [];
  const corroborations = postId !== null ? getPostCorroborations(postId) : [];
  const campaigns = postId !== null ? getPostCampaigns(postId) : [];

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeDrawer();
        return;
      }

      // Focus trap
      if (event.key === 'Tab' && drawerRef.current !== null) {
        const focusableElements =
          drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (focusableElements.length === 0) return;

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement?.focus();
          }
        }
      }
    },
    [closeDrawer]
  );

  // Handle click outside
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>): void => {
      if (event.target === event.currentTarget) {
        closeDrawer();
      }
    },
    [closeDrawer]
  );

  // Setup event listeners
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      const firstFocusable = drawerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (firstFocusable !== null && firstFocusable !== undefined) {
        firstFocusable.focus();
      } else {
        drawerRef.current?.focus();
      }

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';

        if (previousActiveElement.current instanceof HTMLElement) {
          previousActiveElement.current.focus();
        }
      };
    }
    return undefined;
  }, [isOpen, handleKeyDown]);

  if (!isOpen || post === undefined) {
    return null;
  }

  // Split corroborations into supporting and challenging
  const supporting = corroborations.filter((c) => c.type !== 'challenge');
  const challenging = corroborations.filter((c) => c.type === 'challenge');

  return (
    <div
      className="fixed inset-0 z-[100] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trust-drawer-title"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className="animate-backdrop-in absolute inset-0 bg-overlay backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Drawer - full screen bottom sheet on mobile, side drawer on desktop */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        className="animate-slide-in-right relative h-full w-full overflow-y-auto border-DEFAULT border-l bg-surface-nested shadow-3 sm:max-w-md"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-DEFAULT border-b bg-surface-nested p-4 sm:p-6">
          <h2 id="trust-drawer-title" className="text-xl font-bold text-primary">
            Trust & Verification
          </h2>
          <button
            type="button"
            onClick={closeDrawer}
            className="rounded-nested p-2 text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
            aria-label="Close drawer"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 p-4 sm:p-6">
          {/* Post summary */}
          <div className="rounded-nested border border-subtle bg-surface-container p-4">
            {post.content.title !== undefined && (
              <h3 className="mb-2 font-medium text-primary">{post.content.title}</h3>
            )}
            <p className="line-clamp-3 text-sm text-secondary">{post.content.text}</p>
            <p className="mt-2 text-xs text-tertiary">by {post.author.pseudonym}</p>
          </div>

          {/* Campaigns */}
          {campaigns.length > 0 && (
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
                Active Campaigns
              </h3>
              <div className="space-y-3">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="bg-[var(--color-firefly-gold)]/10 border-[var(--color-firefly-gold)]/30 rounded-nested border p-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--color-firefly-gold)]">
                        {campaign.title}
                      </span>
                      <span className="text-sm font-bold text-[var(--color-firefly-gold)]">
                        {formatPUSDCompact(campaign.fundingAmount)}
                      </span>
                    </div>
                    <p className="text-xs text-secondary">{campaign.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Claims */}
          <ClaimSection claims={claims} postId={post.id} />

          {/* Evidence - Supporting */}
          {supporting.length > 0 && (
            <EvidenceSection
              title="Corroborating Evidence"
              type="supporting"
              corroborations={supporting}
            />
          )}

          {/* Evidence - Challenging */}
          {challenging.length > 0 && (
            <EvidenceSection
              title="Challenging Evidence"
              type="challenging"
              corroborations={challenging}
            />
          )}

          {/* Empty state */}
          {claims.length === 0 && corroborations.length === 0 && campaigns.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-secondary">No verification activity yet</p>
              <p className="mt-1 text-xs text-tertiary">
                Be the first to corroborate or dispute this post
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
