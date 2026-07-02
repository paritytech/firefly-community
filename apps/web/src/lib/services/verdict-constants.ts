/**
 * Verdict System Constants — MobRule-style dispute resolution timing.
 *
 * These constants define the timing and thresholds for the Stewardship Court
 * dispute resolution system.
 */

// ============================================================================
// Timing Constants
// ============================================================================

/**
 * Counter-evidence window duration: 2 days.
 * Respondents have this much time to submit their defense.
 */
export const COUNTER_EVIDENCE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Voting period after counter-evidence window: 5 days.
 * This is added to the counter-evidence deadline to get the proposal expiry.
 */
export const VOTING_PERIOD_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Total proposal duration: 7 days (2 days counter-evidence + 5 days voting).
 */
export const DEFAULT_PROPOSAL_DURATION_MS = COUNTER_EVIDENCE_WINDOW_MS + VOTING_PERIOD_MS;

/**
 * Vote weight decay half-life: 24 hours.
 * Early votes have more weight; after 24 hours, weight is 50%.
 * After 48 hours, weight is 25%, etc.
 */
export const VOTE_DECAY_HALF_LIFE_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// Turnout Requirements
// ============================================================================

/**
 * Minimum absolute number of votes for a valid verdict.
 * Even if percentage is met, we need at least this many votes.
 */
export const MIN_TURNOUT_NOMINAL = 5;

/**
 * Minimum percentage of eligible voters required (0-100).
 * This ensures community engagement for legitimacy.
 */
export const MIN_TURNOUT_PERCENT = 10;

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default turnout requirements.
 */
export const DEFAULT_TURNOUT = {
  minNominal: MIN_TURNOUT_NOMINAL,
  minPercentage: MIN_TURNOUT_PERCENT,
} as const;

/**
 * Default proposal parameters for V2 proposals.
 */
export const DEFAULT_V2_PARAMS = {
  counterEvidenceWindowMs: COUNTER_EVIDENCE_WINDOW_MS,
  votingPeriodMs: VOTING_PERIOD_MS,
  voteDecayHalfLifeMs: VOTE_DECAY_HALF_LIFE_MS,
  turnout: DEFAULT_TURNOUT,
} as const;
