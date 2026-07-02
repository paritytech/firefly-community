/**
 * Time utilities for mock data generation.
 *
 * These helpers create Unix timestamps relative to the current time,
 * useful for generating realistic mock data.
 */

/**
 * Create a Unix timestamp for a time in the past.
 * @param hours - Number of hours ago
 * @returns Unix timestamp in seconds
 */
export const hoursAgo = (hours: number): number =>
  Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);

/**
 * Create a Unix timestamp for a time in the past.
 * @param days - Number of days ago
 * @returns Unix timestamp in seconds
 */
export const daysAgo = (days: number): number =>
  Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);

/**
 * Create a Unix timestamp for a time in the future.
 * @param days - Number of days from now
 * @returns Unix timestamp in seconds
 */
export const daysFromNow = (days: number): number =>
  Math.floor((Date.now() + days * 24 * 60 * 60 * 1000) / 1000);
