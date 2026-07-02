/**
 * Tests for notification helpers (RFC 0019).
 */

import { describe, it, expect } from 'vitest';
import {
  createNotificationId,
  SCHEDULED_NOTIFICATION_LIMIT,
  isScheduledNotification,
  validateScheduledTime,
  type PushNotificationRequest,
} from './notification';

describe('createNotificationId', () => {
  it('accepts a non-negative integer', () => {
    expect(createNotificationId(0)).toBe(0);
    expect(createNotificationId(42)).toBe(42);
  });

  it('rejects negative values', () => {
    expect(() => createNotificationId(-1)).toThrow(/Invalid notification ID/);
  });

  it('rejects non-integers', () => {
    expect(() => createNotificationId(2.5)).toThrow(/Invalid notification ID/);
  });
});

describe('SCHEDULED_NOTIFICATION_LIMIT', () => {
  it('matches the host queue limit of 64', () => {
    expect(SCHEDULED_NOTIFICATION_LIMIT).toBe(64);
  });
});

describe('isScheduledNotification', () => {
  it('is false when scheduledAt is omitted', () => {
    const request: PushNotificationRequest = { title: 'Hi', body: 'There' };
    expect(isScheduledNotification(request)).toBe(false);
  });

  it('is true when scheduledAt is present', () => {
    const request: PushNotificationRequest = {
      title: 'Hi',
      body: 'There',
      scheduledAt: Date.now() + 1000,
    };
    expect(isScheduledNotification(request)).toBe(true);
  });
});

describe('validateScheduledTime', () => {
  it('returns undefined for a valid future time', () => {
    const future = Date.now() + 60_000;
    expect(validateScheduledTime(future)).toBeUndefined();
  });

  it('rejects a time in the past', () => {
    const past = Date.now() - 1000;
    expect(validateScheduledTime(past)).toBe('Scheduled time must be in the future');
  });

  it('rejects the current instant (not strictly future)', () => {
    const now = Date.now();
    expect(validateScheduledTime(now)).toBe('Scheduled time must be in the future');
  });

  it('rejects a time more than 30 days out', () => {
    const tooFar = Date.now() + 31 * 24 * 60 * 60 * 1000;
    expect(validateScheduledTime(tooFar)).toBe(
      'Scheduled time cannot be more than 30 days in the future'
    );
  });
});
