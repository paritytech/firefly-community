/**
 * Tooltip — Hover-triggered information display.
 *
 * Shows contextual information when hovering over elements.
 * Uses CSS-only implementation for performance.
 */

import type { ReactElement, ReactNode } from 'react';

export interface TooltipProps {
  /** Content to show in tooltip */
  content: string;
  /** Element to attach tooltip to */
  children: ReactNode;
  /** Position of tooltip relative to trigger */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay before showing tooltip (ms) */
  delay?: number;
  /** Additional className */
  className?: string;
}

const positionClasses = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

const arrowClasses = {
  top: 'bottom-[-4px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent',
  bottom:
    'top-[-4px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent',
  left: 'right-[-4px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent',
  right:
    'left-[-4px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent',
};

export function Tooltip({
  content,
  children,
  position = 'top',
  className = '',
}: TooltipProps): ReactElement {
  return (
    <div className={`group relative inline-block ${className}`}>
      {children}
      <div
        className={`rounded-nested shadow-2 invisible absolute z-50 border border-[var(--border-default)] bg-[var(--bg-surface-container)] px-2 py-1 text-xs font-medium whitespace-nowrap text-[var(--fg-primary)] opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 ${positionClasses[position]} `}
        role="tooltip"
      >
        {content}
        <span
          className={`absolute h-0 w-0 border-4 border-[var(--bg-surface-container)] ${arrowClasses[position]} `}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
