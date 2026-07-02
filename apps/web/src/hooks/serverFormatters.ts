/**
 * Server-side formatting functions.
 * Use these in Server Components where hooks aren't available.
 */

/**
 * Normalize timestamp to milliseconds.
 * Timestamps under 1 trillion are assumed to be seconds.
 */
function normalizeTimestamp(timestamp: number): number {
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
}

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

export function createServerFormatters(locale: string): Formatters {
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

  const relativeFormatter = new Intl.RelativeTimeFormat(locale, {
    numeric: 'auto',
    style: 'long',
  });

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

    return formatDate(timestamp);
  };

  const formatExpiry = (timestamp: number): string => {
    const ms = normalizeTimestamp(timestamp);
    const now = Date.now();
    const diff = ms - now;

    if (diff <= 0) {
      return formatDate(timestamp);
    }

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
}
