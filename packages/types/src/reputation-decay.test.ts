/**
 * Tests for reputation decay logic.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDecayedReputation,
  getDaysUntilDecay,
  isDecaying,
  getDecayPercentage,
  projectReputation,
  isDecayResetAction,
  DEFAULT_DECAY_CONFIG,
  AGGRESSIVE_DECAY_CONFIG,
  LENIENT_DECAY_CONFIG,
  REPUTATION_ACTIONS,
} from './reputation-decay';

// Helper to create timestamps
const daysAgo = (days: number, now: number = Date.now()): number =>
  now - days * 24 * 60 * 60 * 1000;

describe('calculateDecayedReputation', () => {
  const now = Date.now();

  it('returns base reputation within grace period', () => {
    const lastActivity = daysAgo(15, now); // 15 days ago, within 30 day grace
    const result = calculateDecayedReputation(1000, lastActivity, DEFAULT_DECAY_CONFIG, now);
    expect(result).toBe(1000);
  });

  it('returns base reputation at exactly grace period boundary', () => {
    const lastActivity = daysAgo(30, now); // Exactly 30 days
    const result = calculateDecayedReputation(1000, lastActivity, DEFAULT_DECAY_CONFIG, now);
    expect(result).toBe(1000);
  });

  it('applies decay after grace period', () => {
    const lastActivity = daysAgo(40, now); // 40 days = 10 days of decay
    const result = calculateDecayedReputation(1000, lastActivity, DEFAULT_DECAY_CONFIG, now);
    // Expected: 1000 * (0.99)^10 ≈ 904.38
    expect(result).toBeCloseTo(904.38, 1);
  });

  it('respects minimum floor', () => {
    const lastActivity = daysAgo(500, now); // Very long inactivity
    const result = calculateDecayedReputation(1000, lastActivity, DEFAULT_DECAY_CONFIG, now);
    expect(result).toBe(DEFAULT_DECAY_CONFIG.minimumFloor);
  });

  it('uses aggressive config correctly', () => {
    const lastActivity = daysAgo(24, now); // 24 days = 10 days of decay with aggressive (14 day grace)
    const result = calculateDecayedReputation(1000, lastActivity, AGGRESSIVE_DECAY_CONFIG, now);
    // Expected: 1000 * (0.98)^10 ≈ 817.07
    expect(result).toBeCloseTo(817.07, 1);
  });

  it('uses lenient config correctly', () => {
    const lastActivity = daysAgo(70, now); // 70 days = 10 days of decay with lenient (60 day grace)
    const result = calculateDecayedReputation(1000, lastActivity, LENIENT_DECAY_CONFIG, now);
    // Expected: 1000 * (0.995)^10 ≈ 951.11
    expect(result).toBeCloseTo(951.11, 1);
  });

  it('handles zero base reputation', () => {
    const lastActivity = daysAgo(100, now);
    const result = calculateDecayedReputation(0, lastActivity, DEFAULT_DECAY_CONFIG, now);
    expect(result).toBe(DEFAULT_DECAY_CONFIG.minimumFloor);
  });

  it('handles very recent activity', () => {
    const lastActivity = now - 1000; // 1 second ago
    const result = calculateDecayedReputation(1000, lastActivity, DEFAULT_DECAY_CONFIG, now);
    expect(result).toBe(1000);
  });
});

describe('getDaysUntilDecay', () => {
  const now = Date.now();

  it('returns remaining grace days for recent activity', () => {
    const lastActivity = daysAgo(10, now);
    const result = getDaysUntilDecay(lastActivity, DEFAULT_DECAY_CONFIG, now);
    expect(result).toBe(20); // 30 - 10 = 20
  });

  it('returns 0 when past grace period', () => {
    const lastActivity = daysAgo(40, now);
    const result = getDaysUntilDecay(lastActivity, DEFAULT_DECAY_CONFIG, now);
    expect(result).toBe(0);
  });

  it('returns full grace period for just-now activity', () => {
    const lastActivity = now;
    const result = getDaysUntilDecay(lastActivity, DEFAULT_DECAY_CONFIG, now);
    expect(result).toBe(30);
  });

  it('respects different config grace periods', () => {
    const lastActivity = daysAgo(10, now);
    expect(getDaysUntilDecay(lastActivity, AGGRESSIVE_DECAY_CONFIG, now)).toBe(4); // 14 - 10
    expect(getDaysUntilDecay(lastActivity, LENIENT_DECAY_CONFIG, now)).toBe(50); // 60 - 10
  });
});

describe('isDecaying', () => {
  const now = Date.now();

  it('returns false within grace period', () => {
    const lastActivity = daysAgo(15, now);
    expect(isDecaying(lastActivity, DEFAULT_DECAY_CONFIG, now)).toBe(false);
  });

  it('returns true past grace period', () => {
    const lastActivity = daysAgo(35, now);
    expect(isDecaying(lastActivity, DEFAULT_DECAY_CONFIG, now)).toBe(true);
  });

  it('returns true at exactly grace period boundary', () => {
    // At exactly 30 days, grace period is exhausted and decay begins
    const lastActivity = daysAgo(30, now);
    expect(isDecaying(lastActivity, DEFAULT_DECAY_CONFIG, now)).toBe(true);
  });

  it('returns false when more than 1 day of grace remains', () => {
    // At 28 days, 2 days of grace remain, not decaying
    const lastActivity = daysAgo(28, now);
    expect(isDecaying(lastActivity, DEFAULT_DECAY_CONFIG, now)).toBe(false);
  });
});

describe('getDecayPercentage', () => {
  const now = Date.now();

  it('returns 0 within grace period', () => {
    const lastActivity = daysAgo(15, now);
    const result = getDecayPercentage(1000, lastActivity, DEFAULT_DECAY_CONFIG, now);
    expect(result).toBe(0);
  });

  it('returns correct percentage after decay', () => {
    const lastActivity = daysAgo(40, now); // 10 days of decay
    const result = getDecayPercentage(1000, lastActivity, DEFAULT_DECAY_CONFIG, now);
    // Lost: 1000 - 904.38 = 95.62, percentage = 9.56%
    expect(result).toBeCloseTo(9.56, 1);
  });

  it('caps at floor-based maximum', () => {
    const lastActivity = daysAgo(500, now);
    const result = getDecayPercentage(1000, lastActivity, DEFAULT_DECAY_CONFIG, now);
    // Maximum loss: 1000 - 100 = 900, percentage = 90%
    expect(result).toBe(90);
  });
});

describe('projectReputation', () => {
  it('projects future decay correctly', () => {
    const now = Date.now();
    const lastActivity = daysAgo(25, now); // Currently in grace period

    // 10 days from now = 35 days since activity = 5 days of decay
    const projected = projectReputation(1000, lastActivity, 10, DEFAULT_DECAY_CONFIG);
    // Expected: 1000 * (0.99)^5 ≈ 950.99
    expect(projected).toBeCloseTo(950.99, 1);
  });

  it('shows no decay if still in grace period', () => {
    const now = Date.now();
    const lastActivity = daysAgo(10, now);

    // 10 days from now = 20 days since activity = still in grace
    const projected = projectReputation(1000, lastActivity, 10, DEFAULT_DECAY_CONFIG);
    expect(projected).toBe(1000);
  });
});

describe('isDecayResetAction', () => {
  it('returns true for all default actions', () => {
    for (const action of REPUTATION_ACTIONS) {
      expect(isDecayResetAction(action)).toBe(true);
    }
  });

  it('respects custom config', () => {
    const customConfig = {
      ...DEFAULT_DECAY_CONFIG,
      resetActions: ['illuminate', 'corroborate'] as const,
    };

    expect(isDecayResetAction('illuminate', customConfig)).toBe(true);
    expect(isDecayResetAction('corroborate', customConfig)).toBe(true);
    expect(isDecayResetAction('challenge', customConfig)).toBe(false);
    expect(isDecayResetAction('vote', customConfig)).toBe(false);
  });
});

describe('decay config presets', () => {
  it('DEFAULT_DECAY_CONFIG has expected values', () => {
    expect(DEFAULT_DECAY_CONFIG.gracePeriodDays).toBe(30);
    expect(DEFAULT_DECAY_CONFIG.dailyDecayRate).toBe(0.01);
    expect(DEFAULT_DECAY_CONFIG.minimumFloor).toBe(100);
    expect(DEFAULT_DECAY_CONFIG.resetActions).toEqual(REPUTATION_ACTIONS);
  });

  it('AGGRESSIVE_DECAY_CONFIG is stricter', () => {
    expect(AGGRESSIVE_DECAY_CONFIG.gracePeriodDays).toBeLessThan(
      DEFAULT_DECAY_CONFIG.gracePeriodDays
    );
    expect(AGGRESSIVE_DECAY_CONFIG.dailyDecayRate).toBeGreaterThan(
      DEFAULT_DECAY_CONFIG.dailyDecayRate
    );
    expect(AGGRESSIVE_DECAY_CONFIG.minimumFloor).toBeLessThan(DEFAULT_DECAY_CONFIG.minimumFloor);
  });

  it('LENIENT_DECAY_CONFIG is more forgiving', () => {
    expect(LENIENT_DECAY_CONFIG.gracePeriodDays).toBeGreaterThan(
      DEFAULT_DECAY_CONFIG.gracePeriodDays
    );
    expect(LENIENT_DECAY_CONFIG.dailyDecayRate).toBeLessThan(DEFAULT_DECAY_CONFIG.dailyDecayRate);
    expect(LENIENT_DECAY_CONFIG.minimumFloor).toBeGreaterThan(DEFAULT_DECAY_CONFIG.minimumFloor);
  });
});
