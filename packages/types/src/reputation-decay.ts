/**
 * Reputation decay logic — time-based decay for inactive fireflies.
 *
 * Reputation decays over time to ensure that:
 * - Active contributors maintain their standing
 * - Inactive accounts don't retain unearned authority
 * - The network reflects current, engaged participation
 *
 * Decay is applied as a percentage reduction per day after a grace period
 * of inactivity. Activity resets the decay timer.
 */

/**
 * Actions that reset the decay timer.
 *
 * These are meaningful contributions that demonstrate ongoing engagement.
 */
export type ReputationAction =
  | 'illuminate' // Creating a post
  | 'corroborate' // Corroborating another's post
  | 'challenge' // Challenging a post
  | 'vote' // Voting on a governance proposal
  | 'fund' // Funding a campaign
  | 'claim'; // Claiming a bounty

/**
 * All reputation actions as an array.
 */
export const REPUTATION_ACTIONS: readonly ReputationAction[] = [
  'illuminate',
  'corroborate',
  'challenge',
  'vote',
  'fund',
  'claim',
] as const;

/**
 * Configuration for reputation decay.
 */
export interface ReputationDecayConfig {
  /** Days of inactivity before decay starts */
  readonly gracePeriodDays: number;
  /** Daily decay rate after grace period (0-1, e.g., 0.01 = 1% per day) */
  readonly dailyDecayRate: number;
  /** Minimum reputation floor (never decay below this) */
  readonly minimumFloor: number;
  /** Actions that reset the decay timer */
  readonly resetActions: readonly ReputationAction[];
}

/**
 * Default decay configuration.
 *
 * - 30 days grace period: Allows for vacations, breaks
 * - 1% daily decay: Gradual, not punitive
 * - Floor of 100: Never lose all reputation, can always recover
 * - All actions reset: Any meaningful participation resets the timer
 */
export const DEFAULT_DECAY_CONFIG: ReputationDecayConfig = {
  gracePeriodDays: 30,
  dailyDecayRate: 0.01,
  minimumFloor: 100,
  resetActions: REPUTATION_ACTIONS,
} as const;

/**
 * Aggressive decay configuration for high-stakes contexts.
 *
 * Used where reputation must stay current (e.g., fact-checking collectives).
 */
export const AGGRESSIVE_DECAY_CONFIG: ReputationDecayConfig = {
  gracePeriodDays: 14,
  dailyDecayRate: 0.02,
  minimumFloor: 50,
  resetActions: REPUTATION_ACTIONS,
} as const;

/**
 * Lenient decay configuration for casual participants.
 *
 * Used where occasional participation is acceptable.
 */
export const LENIENT_DECAY_CONFIG: ReputationDecayConfig = {
  gracePeriodDays: 60,
  dailyDecayRate: 0.005,
  minimumFloor: 200,
  resetActions: REPUTATION_ACTIONS,
} as const;

/**
 * Calculate decayed reputation based on inactivity.
 *
 * Uses exponential decay: reputation = base * (1 - rate)^days
 *
 * @param baseReputation - The undecayed reputation score
 * @param lastActivityAt - Timestamp of last activity (ms since epoch)
 * @param config - Decay configuration (defaults to DEFAULT_DECAY_CONFIG)
 * @param now - Current timestamp (defaults to Date.now(), useful for testing)
 * @returns Decayed reputation score, never below minimum floor
 *
 * @example
 * ```ts
 * // User with 1000 reputation, inactive for 40 days
 * const lastActivity = Date.now() - (40 * 24 * 60 * 60 * 1000);
 * const decayed = calculateDecayedReputation(1000, lastActivity);
 * // 10 days of decay at 1% = 1000 * (0.99)^10 ≈ 904
 * ```
 */
export function calculateDecayedReputation(
  baseReputation: number,
  lastActivityAt: number,
  config: ReputationDecayConfig = DEFAULT_DECAY_CONFIG,
  now: number = Date.now()
): number {
  // Calculate days since last activity
  const msSinceActivity = now - lastActivityAt;
  const daysSinceActivity = msSinceActivity / (1000 * 60 * 60 * 24);

  // No decay within grace period
  if (daysSinceActivity <= config.gracePeriodDays) {
    return baseReputation;
  }

  // Calculate decay days (days past grace period)
  const decayDays = daysSinceActivity - config.gracePeriodDays;

  // Apply exponential decay
  const decayFactor = Math.pow(1 - config.dailyDecayRate, decayDays);
  const decayedReputation = baseReputation * decayFactor;

  // Never go below the minimum floor
  return Math.max(decayedReputation, config.minimumFloor);
}

/**
 * Calculate how many days until reputation starts decaying.
 *
 * @param lastActivityAt - Timestamp of last activity
 * @param config - Decay configuration
 * @param now - Current timestamp
 * @returns Days remaining in grace period (0 if already decaying)
 */
export function getDaysUntilDecay(
  lastActivityAt: number,
  config: ReputationDecayConfig = DEFAULT_DECAY_CONFIG,
  now: number = Date.now()
): number {
  const msSinceActivity = now - lastActivityAt;
  const daysSinceActivity = msSinceActivity / (1000 * 60 * 60 * 24);

  const daysRemaining = config.gracePeriodDays - daysSinceActivity;
  return Math.max(0, Math.floor(daysRemaining));
}

/**
 * Check if reputation is currently decaying.
 *
 * @param lastActivityAt - Timestamp of last activity
 * @param config - Decay configuration
 * @param now - Current timestamp
 * @returns true if past grace period and actively decaying
 */
export function isDecaying(
  lastActivityAt: number,
  config: ReputationDecayConfig = DEFAULT_DECAY_CONFIG,
  now: number = Date.now()
): boolean {
  return getDaysUntilDecay(lastActivityAt, config, now) === 0;
}

/**
 * Calculate the percentage of reputation lost to decay.
 *
 * @param baseReputation - The undecayed reputation score
 * @param lastActivityAt - Timestamp of last activity
 * @param config - Decay configuration
 * @param now - Current timestamp
 * @returns Percentage lost (0-100)
 */
export function getDecayPercentage(
  baseReputation: number,
  lastActivityAt: number,
  config: ReputationDecayConfig = DEFAULT_DECAY_CONFIG,
  now: number = Date.now()
): number {
  const decayed = calculateDecayedReputation(baseReputation, lastActivityAt, config, now);
  const lost = baseReputation - decayed;
  return (lost / baseReputation) * 100;
}

/**
 * Project future reputation given continued inactivity.
 *
 * @param baseReputation - Current undecayed reputation
 * @param lastActivityAt - Timestamp of last activity
 * @param daysFromNow - Days into the future to project
 * @param config - Decay configuration
 * @returns Projected reputation score
 */
export function projectReputation(
  baseReputation: number,
  lastActivityAt: number,
  daysFromNow: number,
  config: ReputationDecayConfig = DEFAULT_DECAY_CONFIG
): number {
  const futureTimestamp = Date.now() + daysFromNow * 24 * 60 * 60 * 1000;
  return calculateDecayedReputation(baseReputation, lastActivityAt, config, futureTimestamp);
}

/**
 * Activity record for tracking last action.
 */
export interface ActivityRecord {
  /** DIM credential of the firefly */
  readonly credential: string;
  /** Timestamp of last activity */
  readonly lastActivityAt: number;
  /** Type of last activity */
  readonly lastAction: ReputationAction;
  /** Total activities recorded */
  readonly totalActivities: number;
}

/**
 * Check if an action resets the decay timer.
 *
 * @param action - The action to check
 * @param config - Decay configuration
 * @returns true if the action resets decay
 */
export function isDecayResetAction(
  action: ReputationAction,
  config: ReputationDecayConfig = DEFAULT_DECAY_CONFIG
): boolean {
  return config.resetActions.includes(action);
}
