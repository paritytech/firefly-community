/**
 * Tests for time utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hoursAgo, daysAgo, daysFromNow } from './time';

describe('time utilities', () => {
  const NOW = 1700000000000; // Fixed timestamp for testing

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('hoursAgo', () => {
    it('should return timestamp for 1 hour ago', () => {
      const result = hoursAgo(1);
      const expected = Math.floor((NOW - 1 * 60 * 60 * 1000) / 1000);
      expect(result).toBe(expected);
    });

    it('should return timestamp for 24 hours ago', () => {
      const result = hoursAgo(24);
      const expected = Math.floor((NOW - 24 * 60 * 60 * 1000) / 1000);
      expect(result).toBe(expected);
    });

    it('should return current timestamp for 0 hours', () => {
      const result = hoursAgo(0);
      const expected = Math.floor(NOW / 1000);
      expect(result).toBe(expected);
    });
  });

  describe('daysAgo', () => {
    it('should return timestamp for 1 day ago', () => {
      const result = daysAgo(1);
      const expected = Math.floor((NOW - 1 * 24 * 60 * 60 * 1000) / 1000);
      expect(result).toBe(expected);
    });

    it('should return timestamp for 7 days ago', () => {
      const result = daysAgo(7);
      const expected = Math.floor((NOW - 7 * 24 * 60 * 60 * 1000) / 1000);
      expect(result).toBe(expected);
    });

    it('should return timestamp for 30 days ago', () => {
      const result = daysAgo(30);
      const expected = Math.floor((NOW - 30 * 24 * 60 * 60 * 1000) / 1000);
      expect(result).toBe(expected);
    });
  });

  describe('daysFromNow', () => {
    it('should return timestamp for 1 day from now', () => {
      const result = daysFromNow(1);
      const expected = Math.floor((NOW + 1 * 24 * 60 * 60 * 1000) / 1000);
      expect(result).toBe(expected);
    });

    it('should return timestamp for 30 days from now', () => {
      const result = daysFromNow(30);
      const expected = Math.floor((NOW + 30 * 24 * 60 * 60 * 1000) / 1000);
      expect(result).toBe(expected);
    });

    it('should return timestamp for 365 days from now', () => {
      const result = daysFromNow(365);
      const expected = Math.floor((NOW + 365 * 24 * 60 * 60 * 1000) / 1000);
      expect(result).toBe(expected);
    });
  });
});
