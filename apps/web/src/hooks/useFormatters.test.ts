/**
 * Tests for timestamp normalization in useFormatters.
 */

import { describe, it, expect } from 'vitest';
import { normalizeTimestamp } from './useFormatters';

describe('normalizeTimestamp', () => {
  describe('second-based timestamps (seed data format)', () => {
    it('should convert Unix seconds to milliseconds', () => {
      // Nov 14, 2023 in seconds
      const secondsTimestamp = 1700000000;
      const result = normalizeTimestamp(secondsTimestamp);
      expect(result).toBe(1700000000000);
    });

    it('should convert a recent timestamp in seconds', () => {
      // April 2026 in seconds (within seed data range)
      const secondsTimestamp = 1775000000;
      const result = normalizeTimestamp(secondsTimestamp);
      expect(result).toBe(1775000000000);
    });

    it('should convert timestamps from year 2001 in seconds', () => {
      // Early 2001 in seconds
      const secondsTimestamp = 1000000000;
      const result = normalizeTimestamp(secondsTimestamp);
      expect(result).toBe(1000000000000);
    });
  });

  describe('millisecond-based timestamps (Date.now() format)', () => {
    it('should not modify millisecond timestamps from Date.now()', () => {
      // Current-ish timestamp in milliseconds (Nov 2023)
      const msTimestamp = 1700000000000;
      const result = normalizeTimestamp(msTimestamp);
      expect(result).toBe(1700000000000);
    });

    it('should not modify a recent Date.now() value', () => {
      // April 2026 in milliseconds
      const msTimestamp = 1775000000000;
      const result = normalizeTimestamp(msTimestamp);
      expect(result).toBe(1775000000000);
    });

    it('should not modify a typical Date.now() result', () => {
      // Simulate Date.now() returning a millisecond timestamp
      const msTimestamp = 1712345678901;
      const result = normalizeTimestamp(msTimestamp);
      expect(result).toBe(1712345678901);
    });
  });

  describe('edge cases', () => {
    it('should handle the boundary value (1e12) as milliseconds', () => {
      // Exactly 1 trillion - should be treated as milliseconds (already ms)
      const boundaryTimestamp = 1_000_000_000_000;
      const result = normalizeTimestamp(boundaryTimestamp);
      expect(result).toBe(1_000_000_000_000);
    });

    it('should handle value just below boundary as seconds', () => {
      // Just below 1 trillion - should be treated as seconds
      const justBelowBoundary = 999_999_999_999;
      const result = normalizeTimestamp(justBelowBoundary);
      expect(result).toBe(999_999_999_999_000);
    });

    it('should convert zero to zero', () => {
      expect(normalizeTimestamp(0)).toBe(0);
    });
  });

  describe('real-world scenarios', () => {
    it('should correctly format a seed data timestamp', () => {
      // Typical seed data timestamp (seconds since epoch)
      const seedTimestamp = 1735689600; // Jan 1, 2025 00:00:00 UTC
      const result = normalizeTimestamp(seedTimestamp);
      const date = new Date(result);
      expect(date.getUTCFullYear()).toBe(2025);
      expect(date.getUTCMonth()).toBe(0); // January
      expect(date.getUTCDate()).toBe(1);
    });

    it('should correctly format a Date.now() timestamp', () => {
      // Typical Date.now() result (milliseconds since epoch)
      const nowTimestamp = 1735689600000; // Jan 1, 2025 00:00:00 UTC in ms
      const result = normalizeTimestamp(nowTimestamp);
      const date = new Date(result);
      expect(date.getUTCFullYear()).toBe(2025);
      expect(date.getUTCMonth()).toBe(0);
      expect(date.getUTCDate()).toBe(1);
    });

    it('should not cause dates to jump into the future', () => {
      // This was the original bug: Date.now() values were being multiplied by 1000
      const currentMs = Date.now();
      const result = normalizeTimestamp(currentMs);
      const resultDate = new Date(result);
      const now = new Date();

      // Result should be within a few seconds of now, not years in the future
      const diffMs = Math.abs(resultDate.getTime() - now.getTime());
      expect(diffMs).toBeLessThan(60000); // Within 1 minute
    });
  });
});
