'use client';

/**
 * TierPreview — Shows current and potential tier based on contribution amount.
 *
 * Displays the tier progression ladder and highlights the user's
 * current position based on their selected contribution amount.
 */

import type { ReactElement } from 'react';
import { useMemo } from 'react';
import type { ContributorTier } from '@cocuyo/types';
import { TIER_THRESHOLDS } from '@cocuyo/types';
import { TierBadge } from './TierBadge';

interface TierPreviewTranslations {
  tierNone: string;
  tierSpark: string;
  tierFlame: string;
  tierBeacon: string;
  tierLighthouse: string;
}

export interface TierPreviewProps {
  currentTier: ContributorTier;
  amountCents: number;
  translations: TierPreviewTranslations;
  getTierDescription: (tier: ContributorTier) => string;
}

const TIER_ORDER: ContributorTier[] = ['spark', 'flame', 'beacon', 'lighthouse'];

export function TierPreview({
  currentTier,
  amountCents,
  translations: t,
  getTierDescription,
}: TierPreviewProps): ReactElement {
  const tierNames: Record<ContributorTier, string> = useMemo(
    () => ({
      none: t.tierNone,
      spark: t.tierSpark,
      flame: t.tierFlame,
      beacon: t.tierBeacon,
      lighthouse: t.tierLighthouse,
    }),
    [t]
  );

  // Calculate progress to next tier
  const nextTierInfo = useMemo(() => {
    if (currentTier === 'lighthouse') return null;

    const currentIndex = TIER_ORDER.indexOf(currentTier);
    const nextTier = currentIndex === -1 ? TIER_ORDER[0] : TIER_ORDER[currentIndex + 1];
    if (nextTier === undefined) return null;
    const threshold = TIER_THRESHOLDS[nextTier].min;
    const remaining = threshold - amountCents;

    return {
      tier: nextTier,
      threshold,
      remaining: remaining > 0 ? remaining : 0,
    };
  }, [currentTier, amountCents]);

  return (
    <div className="rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-6">
      {/* Current tier */}
      <div className="mb-6 text-center">
        <p className="mb-2 text-sm text-[var(--fg-tertiary)]">Your Tier</p>
        <TierBadge tier={currentTier} name={tierNames[currentTier]} size="lg" />
        {currentTier !== 'none' && (
          <p className="mt-3 text-xs text-[var(--fg-secondary)]">
            {getTierDescription(currentTier)}
          </p>
        )}
      </div>

      {/* Progress to next tier */}
      {nextTierInfo && nextTierInfo.remaining > 0 && (
        <div className="mb-6 rounded-nested bg-[var(--bg-surface-container)] p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-[var(--fg-tertiary)]">Next tier</span>
            <TierBadge tier={nextTierInfo.tier} name={tierNames[nextTierInfo.tier]} size="sm" />
          </div>
          <p className="text-xs text-[var(--fg-secondary)]">
            ${(nextTierInfo.remaining / 100).toFixed(0)} more to reach{' '}
            {tierNames[nextTierInfo.tier]}
          </p>
        </div>
      )}

      {/* Tier ladder */}
      <div className="space-y-2">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--fg-tertiary)]">
          Tier Ladder
        </p>
        {TIER_ORDER.map((tier) => {
          const threshold = TIER_THRESHOLDS[tier].min;
          const isActive = amountCents >= threshold;
          const isCurrent = tier === currentTier;

          return (
            <div
              key={tier}
              className={`flex items-center justify-between rounded-nested border px-3 py-2 ${
                isCurrent
                  ? 'border-[var(--color-firefly-gold)]/50 bg-[var(--color-firefly-gold)]/10'
                  : isActive
                    ? 'border-[var(--border-emphasis)] bg-[var(--bg-surface-container)]'
                    : 'border-transparent bg-transparent'
              }`}
            >
              <span
                className={`text-sm ${
                  isActive ? 'text-[var(--fg-primary)]' : 'text-[var(--fg-tertiary)]'
                }`}
              >
                {tierNames[tier]}
              </span>
              <span className="text-xs text-[var(--fg-tertiary)]">
                ${(threshold / 100).toFixed(0)}+
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
