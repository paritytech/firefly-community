'use client';

/**
 * External Link component - hidden when running in Triangle host.
 *
 * External links should not be shown in the host environment as they
 * would navigate away from the contained app experience.
 *
 * Security: Only allows http:// and https:// URLs to prevent XSS via
 * javascript: or data: URL schemes.
 */

import type { ReactElement, ReactNode } from 'react';
import { useSigner } from '@/hooks';

/**
 * Validates that a URL uses a safe scheme (http or https).
 * Prevents XSS attacks via javascript:, data:, or other dangerous schemes.
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    // Invalid URL - not safe
    return false;
  }
}

/**
 * Filters an array of URLs, returning only those with safe schemes.
 */
export function filterSafeUrls(urls: string[]): string[] {
  return urls.filter(isSafeUrl);
}

interface ExternalLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}

/**
 * Renders an external link only when NOT in host mode and URL is safe.
 * Returns null when running inside Triangle container or URL is unsafe.
 */
export function ExternalLink({
  href,
  children,
  className,
}: ExternalLinkProps): ReactElement | null {
  const { isInHost } = useSigner();

  // Don't render external links in host environment
  if (isInHost) {
    return null;
  }

  // Security: Only render links with safe URL schemes
  if (!isSafeUrl(href)) {
    return null;
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

interface ExternalLinkSectionProps {
  children: ReactNode;
}

/**
 * Wrapper for sections containing external links.
 * Hides the entire section when in host mode.
 */
export function ExternalLinkSection({ children }: ExternalLinkSectionProps): ReactElement | null {
  const { isInHost } = useSigner();

  if (isInHost) {
    return null;
  }

  return <>{children}</>;
}
