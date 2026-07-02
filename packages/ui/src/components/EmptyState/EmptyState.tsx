/**
 * EmptyState — Prominent display for empty data states.
 *
 * Used when lists, feeds, or searches return no results.
 * Always provides context and a call-to-action.
 */

import type { ReactElement, ReactNode } from 'react';

export interface EmptyStateProps {
  /** Icon to display (ReactNode for flexibility) */
  icon?: ReactNode;
  /** Main heading */
  title: string;
  /** Explanatory description */
  description?: string;
  /** Call-to-action button or link */
  action?: ReactNode;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: {
    container: 'py-8 px-6',
    iconWrapper: 'w-10 h-10 mb-3',
    icon: 'w-5 h-5',
    title: 'text-base',
    description: 'text-sm mt-1',
    action: 'mt-4',
  },
  md: {
    container: 'py-12 px-8',
    iconWrapper: 'w-14 h-14 mb-4',
    icon: 'w-6 h-6',
    title: 'text-lg',
    description: 'text-sm mt-2',
    action: 'mt-6',
  },
  lg: {
    container: 'py-16 px-10',
    iconWrapper: 'w-16 h-16 mb-5',
    icon: 'w-8 h-8',
    title: 'text-xl',
    description: 'text-base mt-2',
    action: 'mt-8',
  },
};

/** Default icon when none provided */
function DefaultIcon(): ReactElement {
  return (
    <svg
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
}: EmptyStateProps): ReactElement {
  const styles = sizeClasses[size];

  return (
    <div
      className={`rounded-container animate-fade-in flex flex-col items-center bg-[var(--bg-surface-container)] text-center ${styles.container}`}
    >
      <div
        className={`animate-scale-in flex items-center justify-center rounded-full bg-[var(--bg-surface-nested)] text-[var(--fg-tertiary)] ${styles.iconWrapper}`}
      >
        {icon ?? <DefaultIcon />}
      </div>
      <h3 className={`leading-tight font-semibold text-[var(--fg-primary)] ${styles.title}`}>
        {title}
      </h3>
      {description !== undefined && (
        <p className={`max-w-sm text-[var(--fg-secondary)] ${styles.description}`}>{description}</p>
      )}
      {action !== undefined && <div className={styles.action}>{action}</div>}
    </div>
  );
}
