/**
 * Tests for corroboration helpers.
 */

import { describe, it, expect } from 'vitest';
import { emptyCorroborationSummary } from './corroboration';

describe('emptyCorroborationSummary', () => {
  it('returns a summary with all counts at zero', () => {
    const summary = emptyCorroborationSummary();
    expect(summary.witnessCount).toBe(0);
    expect(summary.evidenceCount).toBe(0);
    expect(summary.expertiseCount).toBe(0);
    expect(summary.challengeCount).toBe(0);
  });

  it('returns a fresh object on each call (no shared mutable state)', () => {
    const a = emptyCorroborationSummary();
    const b = emptyCorroborationSummary();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
