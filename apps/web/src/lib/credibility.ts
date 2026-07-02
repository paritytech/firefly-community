/**
 * Credibility utilities.
 *
 * Calculates weighted credibility scores based on corroborations
 * and the personhood level of corroborators.
 */

import type { Corroboration, PersonhoodLevel, EvidenceQuality } from '@cocuyo/types';
import { personhoodService } from './services/personhood-service';

/** Personhood weight multipliers */
const PERSONHOOD_WEIGHTS: Readonly<Record<PersonhoodLevel, number>> = {
  none: 0,
  lite: 0.5,
  full: 1.0,
};

/** Evidence quality weights */
const QUALITY_WEIGHTS: Readonly<Record<EvidenceQuality, number>> = {
  peer_reviewed: 2.0,
  source_verified: 1.5,
  documented: 1.2,
  observation: 1.0,
  unverified: 0.5,
};

/**
 * Get personhood weight for a level (synchronous, no lookups).
 */
export function getPersonhoodWeight(level: PersonhoodLevel): number {
  return PERSONHOOD_WEIGHTS[level];
}

/**
 * Get quality weight for evidence quality.
 */
export function getQualityWeight(quality: EvidenceQuality): number {
  return QUALITY_WEIGHTS[quality];
}

/**
 * Calculate weighted corroboration score for a set of corroborations.
 *
 * Each corroboration's weight is:
 *   personhoodWeight * qualityWeight * sign
 *
 * Where sign is +1 for supporting corroborations and -1 for challenges.
 */
export async function calculateWeightedScore(
  corroborations: readonly Corroboration[]
): Promise<number> {
  let totalWeight = 0;

  for (const corroboration of corroborations) {
    // Get corroborator's personhood level
    const level = await personhoodService.getLevel(corroboration.dimSignature);
    const personhoodWeight = PERSONHOOD_WEIGHTS[level];

    // Get quality weight
    const qualityWeight = QUALITY_WEIGHTS[corroboration.quality];

    // Challenge corroborations subtract from score
    const sign = corroboration.type === 'challenge' ? -1 : 1;

    totalWeight += sign * personhoodWeight * qualityWeight;
  }

  return totalWeight;
}

/**
 * Calculate a normalized credibility score (0-100) from corroborations.
 *
 * Uses a sigmoid-like function to cap the score at reasonable bounds.
 */
export async function calculateCredibilityScore(
  corroborations: readonly Corroboration[]
): Promise<number> {
  if (corroborations.length === 0) {
    return 0;
  }

  const rawScore = await calculateWeightedScore(corroborations);

  // Normalize using sigmoid-like scaling
  // At rawScore=0, returns 50; positive scores approach 100, negative approach 0
  const k = 0.5; // Scaling factor - adjust for desired sensitivity
  const normalized = 100 / (1 + Math.exp(-k * rawScore));

  return Math.round(normalized);
}

/**
 * Summarize corroboration weights by personhood level.
 */
export async function summarizeByPersonhood(corroborations: readonly Corroboration[]): Promise<{
  full: { count: number; weight: number };
  lite: { count: number; weight: number };
  none: { count: number; weight: number };
}> {
  const summary = {
    full: { count: 0, weight: 0 },
    lite: { count: 0, weight: 0 },
    none: { count: 0, weight: 0 },
  };

  for (const corroboration of corroborations) {
    const level = await personhoodService.getLevel(corroboration.dimSignature);
    const qualityWeight = QUALITY_WEIGHTS[corroboration.quality];
    const sign = corroboration.type === 'challenge' ? -1 : 1;

    summary[level].count += 1;
    summary[level].weight += sign * PERSONHOOD_WEIGHTS[level] * qualityWeight;
  }

  return summary;
}
