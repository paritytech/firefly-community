/**
 * Personhood types — DIM verification levels and capability gates.
 *
 * Personhood verification through DIM (Decentralized Identity Mechanism)
 * gates access to network capabilities. Higher verification levels
 * unlock more actions and higher limits.
 */

import type { PUSDAmount } from './currency';
import { createPUSDAmount } from './currency';

/**
 * DIM personhood verification level.
 *
 * - none: No verification (cannot participate)
 * - lite: Basic proof-of-personhood (phone/email verification)
 * - full: Full identity verification (government ID, biometrics)
 */
export type PersonhoodLevel = 'none' | 'lite' | 'full';

/**
 * Capabilities gated by personhood level.
 *
 * Each capability is a boolean flag indicating whether the action
 * is allowed at the corresponding personhood level.
 */
export interface PersonhoodCapabilities {
  /** Can illuminate (create) signals */
  readonly canIlluminate: boolean;
  /** Can corroborate other signals */
  readonly canCorroborate: boolean;
  /** Can challenge signals */
  readonly canChallenge: boolean;
  /** Can fund bounties */
  readonly canFundBounty: boolean;
  /** Can claim bounty payouts */
  readonly canClaimPayout: boolean;
  /** Can receive private (Coinage) payments */
  readonly canReceiveCoinage: boolean;
  /** Maximum bounty funding amount (null = unlimited) */
  readonly maxBountyFunding: PUSDAmount | null;
  /** Maximum single signal bounty claim (null = unlimited) */
  readonly maxBountyClaim: PUSDAmount | null;
}

/**
 * Capability definitions for each personhood level.
 *
 * These gates enforce that only verified humans can participate,
 * with higher verification unlocking greater capabilities.
 */
export const PERSONHOOD_CAPABILITIES: Readonly<Record<PersonhoodLevel, PersonhoodCapabilities>> = {
  none: {
    canIlluminate: false,
    canCorroborate: false,
    canChallenge: false,
    canFundBounty: false,
    canClaimPayout: false,
    canReceiveCoinage: false,
    maxBountyFunding: null,
    maxBountyClaim: null,
  },
  lite: {
    canIlluminate: true,
    canCorroborate: true,
    canChallenge: true,
    canFundBounty: true,
    canClaimPayout: true,
    canReceiveCoinage: true,
    // Lite users limited to $1,000 bounty funding
    maxBountyFunding: createPUSDAmount(1_000_000_000n),
    // Lite users limited to $500 per signal claim
    maxBountyClaim: createPUSDAmount(500_000_000n),
  },
  full: {
    canIlluminate: true,
    canCorroborate: true,
    canChallenge: true,
    canFundBounty: true,
    canClaimPayout: true,
    canReceiveCoinage: true,
    // Full users have no funding limit
    maxBountyFunding: null,
    // Full users have no claim limit
    maxBountyClaim: null,
  },
} as const;

/**
 * Get capabilities for a personhood level.
 */
export function getCapabilities(level: PersonhoodLevel): PersonhoodCapabilities {
  return PERSONHOOD_CAPABILITIES[level];
}

/**
 * Check if a specific capability is allowed at a personhood level.
 */
export function canPerform(
  level: PersonhoodLevel,
  capability: keyof Omit<PersonhoodCapabilities, 'maxBountyFunding' | 'maxBountyClaim'>
): boolean {
  return PERSONHOOD_CAPABILITIES[level][capability];
}

/**
 * Check if a bounty funding amount is within limits for a personhood level.
 */
export function canFundAmount(level: PersonhoodLevel, amount: PUSDAmount): boolean {
  const capabilities = PERSONHOOD_CAPABILITIES[level];
  if (!capabilities.canFundBounty) return false;
  if (capabilities.maxBountyFunding === null) return true;
  return amount <= capabilities.maxBountyFunding;
}

/**
 * Check if a bounty claim amount is within limits for a personhood level.
 */
export function canClaimAmount(level: PersonhoodLevel, amount: PUSDAmount): boolean {
  const capabilities = PERSONHOOD_CAPABILITIES[level];
  if (!capabilities.canClaimPayout) return false;
  if (capabilities.maxBountyClaim === null) return true;
  return amount <= capabilities.maxBountyClaim;
}
