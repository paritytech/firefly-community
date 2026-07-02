'use client';

/**
 * useFormatters — Locale-aware date, time, and number formatting.
 *
 * Uses the Intl API for proper localization of:
 * - Dates (full, short, medium)
 * - Relative time ("hace 5 minutos" / "5 minutes ago")
 * - Numbers and currency
 */

import { useMemo } from 'react';
import { useLocale } from 'next-intl';

interface Formatters {
  /** Format a timestamp as a full date (e.g., "April 4, 2026" / "4 de abril de 2026") */
  formatDate: (timestamp: number) => string;
  /** Format a timestamp as a short date (e.g., "Apr 4" / "4 abr") */
  formatDateShort: (timestamp: number) => string;
  /** Format a timestamp as date and time */
  formatDateTime: (timestamp: number) => string;
  /** Format relative time (e.g., "5 minutes ago" / "hace 5 minutos") */
  formatRelativeTime: (timestamp: number) => string;
  /** Format time until expiry (e.g., "in 3 days" / "en 3 días") */
  formatExpiry: (timestamp: number) => string;
  /** Format a number with locale-appropriate separators */
  formatNumber: (value: number) => string;
  /** The current locale */
  locale: string;
}

/**
 * Normalize timestamp to milliseconds.
 * Handles both Unix seconds and milliseconds.
 *
 * Heuristic: timestamps < 1e12 are in seconds (covers dates through ~2001 in ms,
 * but ~2286 in seconds). Current Date.now() returns ~1.7e12, so this correctly
 * identifies millisecond timestamps from modern systems while converting
 * second-based timestamps (common in seed data and APIs) to milliseconds.
 *
 * @example
 * normalizeTimestamp(1700000000)     // 1700000000000 (seconds -> ms)
 * normalizeTimestamp(1700000000000)  // 1700000000000 (already ms)
 * normalizeTimestamp(Date.now())     // unchanged (already ms)
 */
export function normalizeTimestamp(timestamp: number): number {
  // Timestamps < 1 trillion are in seconds; multiply to get milliseconds
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
}

/**
 * Hook providing locale-aware formatting functions.
 */
export function useFormatters(): Formatters {
  const locale = useLocale();

  return useMemo(() => {
    // Date formatters
    const fullDateFormatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const shortDateFormatter = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
    });

    const dateTimeFormatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    // Relative time formatter
    const relativeFormatter = new Intl.RelativeTimeFormat(locale, {
      numeric: 'auto',
      style: 'long',
    });

    // Number formatter
    const numberFormatter = new Intl.NumberFormat(locale);

    const formatDate = (timestamp: number): string => {
      const ms = normalizeTimestamp(timestamp);
      return fullDateFormatter.format(new Date(ms));
    };

    const formatDateShort = (timestamp: number): string => {
      const ms = normalizeTimestamp(timestamp);
      return shortDateFormatter.format(new Date(ms));
    };

    const formatDateTime = (timestamp: number): string => {
      const ms = normalizeTimestamp(timestamp);
      return dateTimeFormatter.format(new Date(ms));
    };

    const formatRelativeTime = (timestamp: number): string => {
      const ms = normalizeTimestamp(timestamp);
      const now = Date.now();
      const diff = now - ms;

      // Convert to appropriate unit
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      const weeks = Math.floor(days / 7);
      const months = Math.floor(days / 30);

      if (seconds < 60) {
        return relativeFormatter.format(-seconds, 'second');
      }
      if (minutes < 60) {
        return relativeFormatter.format(-minutes, 'minute');
      }
      if (hours < 24) {
        return relativeFormatter.format(-hours, 'hour');
      }
      if (days < 7) {
        return relativeFormatter.format(-days, 'day');
      }
      if (weeks < 4) {
        return relativeFormatter.format(-weeks, 'week');
      }
      if (months < 12) {
        return relativeFormatter.format(-months, 'month');
      }

      // Fall back to formatted date for very old timestamps
      return formatDate(timestamp);
    };

    const formatExpiry = (timestamp: number): string => {
      const ms = normalizeTimestamp(timestamp);
      const now = Date.now();
      const diff = ms - now;

      // If already expired, return the date
      if (diff <= 0) {
        return formatDate(timestamp);
      }

      // Convert to appropriate unit
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      const weeks = Math.floor(days / 7);

      if (hours < 24) {
        return relativeFormatter.format(hours, 'hour');
      }
      if (days < 7) {
        return relativeFormatter.format(days, 'day');
      }
      if (weeks < 4) {
        return relativeFormatter.format(weeks, 'week');
      }

      // Fall back to formatted date for far future
      return formatDate(timestamp);
    };

    const formatNumber = (value: number): string => {
      return numberFormatter.format(value);
    };

    return {
      formatDate,
      formatDateShort,
      formatDateTime,
      formatRelativeTime,
      formatExpiry,
      formatNumber,
      locale,
    };
  }, [locale]);
}
