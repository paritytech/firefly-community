'use client';

/**
 * ClaimSection — Display claims extracted from a post in the TrustDrawer.
 *
 * Shows existing claims and provides a button to open the ExtractClaimSheet
 * for adding new claims. Also displays bounty status to show the fact-checking
 * pipeline: Awaiting → Bounty Funded → Under Review → Verdict Issued.
 */

import { useState, type ReactElement } from 'react';
import type { Claim, PostId, Campaign, ClaimId } from '@cocuyo/types';
import { formatPUSDCompact, createPUSDAmount } from '@cocuyo/types';
import { useToast } from '@cocuyo/ui';
import { useCreateBounty } from '@/components/CreateBountySheet';
import { useFactCheckConfirm } from '@/components/FactCheckConfirmModal';
import { useAppState } from '@/components/AppStateProvider';
import { extractBestClaim } from '@/lib/ai';
import { createLogger } from '@/lib/logging';

const log = createLogger('ClaimSection');

interface ClaimSectionProps {
  claims: Claim[];
  postId: PostId;
}

/** Map claim status to display info */
const STATUS_DISPLAY: Record<Claim['status'], { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'var(--fg-tertiary)' },
  under_review: { label: 'Under Review', color: 'var(--fg-secondary)' },
  verified: { label: 'Verified', color: 'var(--fg-success)' },
  disputed: { label: 'Disputed', color: 'var(--fg-warning)' },
  false: { label: 'False', color: 'var(--fg-error)' },
  unverifiable: { label: 'Unverifiable', color: 'var(--fg-tertiary)' },
};

/** Get bounty status display for a claim */
function getBountyStatus(campaigns: Campaign[]): {
  label: string;
  amount: string | null;
  hasCollective: boolean;
} | null {
  if (campaigns.length === 0) return null;

  // Find active campaigns
  const activeCampaigns = campaigns.filter((c) => c.status === 'active');
  if (activeCampaigns.length === 0) return null;

  // Sum total funding - need to convert to raw bigint for summing, then back to PUSDAmount
  const totalFundingRaw = activeCampaigns.reduce((sum, c) => sum + BigInt(c.fundingAmount), 0n);
  const totalFunding = createPUSDAmount(totalFundingRaw);

  // Check if any campaign is assigned to a collective
  const hasCollective = activeCampaigns.some((c) => c.assignedCollectiveId !== undefined);

  return {
    label: hasCollective ? 'Under collective review' : 'Bounty funded',
    amount: formatPUSDCompact(totalFunding),
    hasCollective,
  };
}

/** Truncate text for aria-labels, adding ellipsis only when content is actually truncated */
function truncateForLabel(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

export function ClaimSection({ claims, postId }: ClaimSectionProps): ReactElement {
  const { openSheet: openBountySheet } = useCreateBounty();
  const { openModal: openFactCheckModal } = useFactCheckConfirm();
  const { extractClaim, getPost, getClaimCampaigns } = useAppState();
  const { addToast } = useToast();
  const [isExtracting, setIsExtracting] = useState(false);

  // Run the AI claim-extractor worker and save the best claim on-chain — the same flow as the
  // post-detail "Extract a Claim" action, so both entry points behave identically.
  const handleExtractClaim = async (): Promise<void> => {
    const post = getPost(postId);
    if (post === undefined) {
      addToast('AI extraction failed. Please try again.', 'error');
      return;
    }
    setIsExtracting(true);
    try {
      const result = await extractBestClaim(post.content.text);
      if (!result.ok) {
        if (result.reason === 'not_configured') {
          addToast("Claim extraction isn't available in this deployment.", 'warning');
        } else {
          addToast('AI extraction failed. Please try again.', 'error');
        }
        return;
      }
      if (result.claim === null) {
        addToast('No verifiable claim found in this post', 'warning');
        return;
      }
      const claim = await extractClaim(postId, result.claim, [...post.context.topics]);
      if (claim !== null) {
        addToast('Claim extracted successfully!', 'success');
      } else {
        addToast("Couldn't save the claim on-chain. Please try again.", 'error');
      }
    } catch (error) {
      log.error('Extract claim failed', 'handleExtractClaim', error);
      addToast('AI extraction failed. Please try again.', 'error');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFactCheck = (claimId: ClaimId): void => {
    openFactCheckModal(claimId);
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-primary">
          <span>Claims ({claims.length})</span>
        </h3>
        <button
          type="button"
          onClick={() => void handleExtractClaim()}
          disabled={isExtracting}
          className="text-xs text-[var(--fg-accent)] hover:underline disabled:cursor-wait disabled:opacity-60"
        >
          {isExtracting ? 'Extracting…' : '+ Extract claim'}
        </button>
      </div>

      {/* Claims list */}
      {claims.length > 0 ? (
        <div className="space-y-3">
          {claims.map((claim) => {
            const status = STATUS_DISPLAY[claim.status];
            const verdict = claim.verdict;
            const claimCampaigns = getClaimCampaigns(claim.id);
            const bountyStatus = getBountyStatus(claimCampaigns);

            return (
              <div
                key={claim.id}
                className="rounded-nested border border-subtle bg-surface-container p-4"
              >
                <p className="mb-2 text-sm text-primary">{claim.statement}</p>

                {/* Status row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${status.color} 15%, transparent)`,
                        color: status.color,
                      }}
                    >
                      {status.label}
                    </span>
                    {claim.evidence.length > 0 && (
                      <span className="text-xs text-tertiary">
                        {claim.evidence.length} evidence
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {claim.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleFactCheck(claim.id)}
                        className="text-xs text-[var(--color-firefly-gold)] hover:underline"
                        aria-label={`Submit for fact-checking: ${truncateForLabel(claim.statement, 50)}`}
                      >
                        Fact Check
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openBountySheet(claim.id)}
                      className="text-xs text-[var(--fg-accent)] hover:underline"
                      aria-label={`Fund bounty for: ${truncateForLabel(claim.statement, 50)}`}
                    >
                      Fund Bounty
                    </button>
                  </div>
                </div>

                {/* Bounty/Fact-check status */}
                <div className="mt-3 flex items-center gap-2 border-t border-subtle pt-3">
                  {bountyStatus !== null ? (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                        bountyStatus.hasCollective
                          ? 'bg-[var(--fg-accent)]/15 text-[var(--fg-accent)]'
                          : 'bg-[var(--fg-success)]/15 text-[var(--fg-success)]'
                      }`}
                    >
                      <span aria-hidden="true">
                        {bountyStatus.hasCollective ? '\u2713' : '\u25C9'}
                      </span>
                      {bountyStatus.label}
                      {bountyStatus.amount !== null && !bountyStatus.hasCollective && (
                        <span className="font-semibold">({bountyStatus.amount})</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-tertiary">
                      Awaiting fact-check — fund a bounty to prioritize
                    </span>
                  )}
                </div>

                {/* Verdict reasoning */}
                {verdict !== undefined && (
                  <div className="mt-3 border-t border-subtle pt-3">
                    <p className="mb-1 text-xs text-tertiary">Verdict reasoning:</p>
                    <p className="text-sm text-secondary">{verdict.reasoning}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-surface-container/50 rounded-nested border border-dashed border-subtle p-4">
          <p className="mb-2 text-sm text-secondary">No claims extracted yet</p>
          <p className="text-xs text-tertiary">
            Extract specific, verifiable statements from this post to enable fact-checking by
            collectives. Fund a bounty to prioritize verification.
          </p>
        </div>
      )}
    </section>
  );
}
