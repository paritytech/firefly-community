'use client';

/**
 * FeatureCard — Navigation card for dashboard feature grid.
 *
 * A clickable card that links to major features of the application.
 * Used on the dashboard to provide quick access to different areas.
 */

import type { ReactElement, ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

/** Props for the link component - compatible with Next.js Link */
interface CardLinkProps {
  href: string;
  className?: string;
  children: React.ReactNode;
}

/** Default link component using plain anchor tags */
function DefaultLink({ href, className, children }: CardLinkProps): ReactElement {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export interface FeatureCardProps {
  /** Card title */
  title: string;
  /** Card description */
  description: string;
  /** Link destination */
  href: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Custom Link component (e.g., Next.js Link) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  LinkComponent?: ComponentType<any>;
}

export function FeatureCard({
  title,
  description,
  href,
  icon: Icon,
  LinkComponent = DefaultLink,
}: FeatureCardProps): ReactElement {
  const Link = LinkComponent;

  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-container)] p-5 transition-colors hover:border-[var(--border-emphasis)] hover:bg-[var(--bg-surface-elevated)]"
    >
      {/* Icon */}
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-surface-main)] text-[var(--fg-secondary)] transition-colors group-hover:text-[var(--fg-accent)]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-medium text-[var(--fg-primary)]">{title}</h3>
        <p className="text-sm text-[var(--fg-tertiary)]">{description}</p>
      </div>
    </Link>
  );
}
