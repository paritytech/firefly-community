/**
 * BackButton — Navigation back button.
 *
 * Provides consistent back navigation styling across the app.
 */

'use client';

import type { ReactElement, ReactNode } from 'react';

export interface BackButtonProps {
  /** Click handler for back navigation */
  onClick: () => void;
  /** Custom label (default: "Back") */
  label?: string;
  /** Custom icon (default: left arrow) */
  icon?: ReactNode;
  /** Additional className */
  className?: string;
}

function DefaultIcon(): ReactElement {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

export function BackButton({
  onClick,
  label = 'Back',
  icon,
  className = '',
}: BackButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg-primary)] ${className} `}
      aria-label={label}
    >
      {icon ?? <DefaultIcon />}
      <span>{label}</span>
    </button>
  );
}
