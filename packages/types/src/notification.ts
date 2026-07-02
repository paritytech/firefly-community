/**
 * Notification types for RFC 0019 scheduled notifications.
 *
 * Provides push notification support with scheduling capabilities.
 * Host queue limit: 64 scheduled notifications.
 *
 * Permission: Requires DevicePermission::Notifications from host.
 */

// ============================================================================
// Branded Types
// ============================================================================

/** Notification identifier */
export type NotificationId = number & { readonly __brand: 'NotificationId' };

/**
 * Create a validated NotificationId.
 * @param id - The notification ID (non-negative integer)
 * @throws Error if ID is invalid
 */
export function createNotificationId(id: number): NotificationId {
  if (!Number.isInteger(id) || id < 0) {
    throw new Error(`Invalid notification ID: ${id}. Must be non-negative integer`);
  }
  return id as NotificationId;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum number of scheduled notifications allowed in host queue */
export const SCHEDULED_NOTIFICATION_LIMIT = 64;

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Push notification request.
 *
 * BREAKING CHANGE from v0.7.x: Now includes optional scheduledAt field.
 */
export interface PushNotificationRequest {
  /** Notification title (shown prominently) */
  readonly title: string;
  /** Notification body text */
  readonly body: string;
  /** Deep link URL to open when notification is tapped */
  readonly deeplink?: string;
  /**
   * Unix milliseconds UTC for scheduled delivery.
   * Omit for immediate delivery.
   * Must be in the future.
   */
  readonly scheduledAt?: number;
}

/**
 * Notification delivery status.
 */
export type NotificationDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'cancelled';

/**
 * Information about a scheduled notification.
 */
export interface ScheduledNotificationInfo {
  /** Notification ID */
  readonly id: NotificationId;
  /** Original request */
  readonly request: PushNotificationRequest;
  /** When the notification was scheduled */
  readonly createdAt: number;
  /** Current delivery status */
  readonly status: NotificationDeliveryStatus;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error types for notification operations.
 *
 * BREAKING CHANGE from v0.7.x: Added ScheduleLimitReached.
 */
export type PushNotificationError =
  | { readonly type: 'ScheduleLimitReached'; readonly limit: 64 }
  | { readonly type: 'PermissionDenied' }
  | { readonly type: 'InvalidScheduleTime'; readonly reason: string }
  | { readonly type: 'NotificationNotFound'; readonly id: NotificationId }
  | { readonly type: 'Unknown'; readonly reason: string };

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a notification request is scheduled (vs immediate).
 */
export function isScheduledNotification(request: PushNotificationRequest): boolean {
  return request.scheduledAt !== undefined;
}

/**
 * Validate a scheduled time is in the future.
 * @param scheduledAt - Unix milliseconds UTC
 * @returns Error message if invalid, undefined if valid
 */
export function validateScheduledTime(scheduledAt: number): string | undefined {
  const now = Date.now();
  if (scheduledAt <= now) {
    return 'Scheduled time must be in the future';
  }
  // Max schedule time: 30 days in the future
  const maxFuture = now + 30 * 24 * 60 * 60 * 1000;
  if (scheduledAt > maxFuture) {
    return 'Scheduled time cannot be more than 30 days in the future';
  }
  return undefined;
}
