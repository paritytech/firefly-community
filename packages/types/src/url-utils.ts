/**
 * URL safety utilities.
 *
 * Provides URL validation and sanitization for user-provided URLs.
 * Critical for preventing XSS and other URL-based attacks.
 */

/**
 * Allowed URL protocols for safe URLs.
 * Only https is allowed by default for security.
 */
const SAFE_PROTOCOLS = ['https:'] as const;

/**
 * Check if a URL is safe for external navigation.
 *
 * A URL is considered safe if:
 * - It's a valid URL
 * - It uses an allowed protocol (https only by default)
 * - It's not a javascript: or data: URL
 *
 * @param url - URL string to validate
 * @returns true if the URL is safe for external navigation
 *
 * @example
 * ```typescript
 * isSafeUrl('https://example.com'); // true
 * isSafeUrl('http://example.com'); // false (not https)
 * isSafeUrl('javascript:alert(1)'); // false (dangerous protocol)
 * isSafeUrl('data:text/html,...'); // false (dangerous protocol)
 * ```
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return SAFE_PROTOCOLS.includes(parsed.protocol as (typeof SAFE_PROTOCOLS)[number]);
  } catch {
    // Invalid URL
    return false;
  }
}

/**
 * Check if a URL is safe, allowing http for local development.
 *
 * @param url - URL string to validate
 * @returns true if the URL is safe
 */
export function isSafeUrlWithHttp(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Sanitize a URL for safe use.
 *
 * Returns the URL if safe, or null if unsafe.
 *
 * @param url - URL string to sanitize
 * @returns The URL if safe, null otherwise
 */
export function sanitizeUrl(url: string): string | null {
  return isSafeUrl(url) ? url : null;
}

/**
 * Extract domain from a URL.
 *
 * @param url - URL string to extract domain from
 * @returns The domain (hostname) or null if invalid URL
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Validate that a URL is from an allowed domain.
 *
 * @param url - URL string to validate
 * @param allowedDomains - List of allowed domains (exact match or suffix match with leading dot)
 * @returns true if URL is from an allowed domain
 *
 * @example
 * ```typescript
 * isFromAllowedDomain('https://docs.example.com/page', ['example.com']); // true
 * isFromAllowedDomain('https://evil.com', ['example.com']); // false
 * isFromAllowedDomain('https://docs.example.com', ['.example.com']); // true (suffix match)
 * ```
 */
export function isFromAllowedDomain(url: string, allowedDomains: readonly string[]): boolean {
  const domain = extractDomain(url);
  if (domain === null) return false;

  return allowedDomains.some((allowed) => {
    if (allowed.startsWith('.')) {
      // Suffix match - domain must end with allowed (subdomain support)
      return domain === allowed.slice(1) || domain.endsWith(allowed);
    }
    // Exact match or subdomain
    return domain === allowed || domain.endsWith(`.${allowed}`);
  });
}
