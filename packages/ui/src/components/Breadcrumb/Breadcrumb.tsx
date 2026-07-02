/**
 * Breadcrumb — Navigation hierarchy indicator.
 *
 * Shows the current location within the site structure.
 * Supports links and current page indicator.
 */

import type { ReactElement, ReactNode } from 'react';

export interface BreadcrumbItem {
  /** Display label */
  label: string;
  /** Navigation href (omit for current page) */
  href?: string;
}

export interface BreadcrumbProps {
  /** Navigation items in order */
  items: BreadcrumbItem[];
  /** Custom separator element */
  separator?: ReactNode;
  /** Custom link renderer (for Next.js Link, etc.) */
  renderLink?: (item: BreadcrumbItem, children: ReactNode) => ReactElement;
  /** Additional className */
  className?: string;
}

function DefaultSeparator(): ReactElement {
  return (
    <svg
      className="h-4 w-4 text-[var(--fg-tertiary)]"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function Breadcrumb({
  items,
  separator,
  renderLink,
  className = '',
}: BreadcrumbProps): ReactElement {
  const separatorElement = separator ?? <DefaultSeparator />;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-2 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const hasHref = item.href !== undefined;

          return (
            <li key={index} className="flex items-center gap-2">
              {index > 0 && (
                <span className="flex-shrink-0" aria-hidden="true">
                  {separatorElement}
                </span>
              )}
              {hasHref && !isLast ? (
                renderLink !== undefined ? (
                  renderLink(
                    item,
                    <span className="text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg-primary)]">
                      {item.label}
                    </span>
                  )
                ) : (
                  <a
                    href={item.href}
                    className="text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg-primary)]"
                  >
                    {item.label}
                  </a>
                )
              ) : (
                <span
                  className={
                    isLast ? 'font-medium text-[var(--fg-primary)]' : 'text-[var(--fg-secondary)]'
                  }
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
