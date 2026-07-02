/**
 * InfoPopover — Click-triggered educational popover.
 *
 * Shows contextual information when clicking on an info icon.
 * Designed for explaining concepts like "What are Stories?" or "What are Signals?"
 */

'use client';

import { useState, useRef, useEffect, useCallback, type ReactElement, type ReactNode } from 'react';

export interface InfoPopoverProps {
  /** Title of the popover */
  title: string;
  /** Body content - can be string or ReactNode */
  children: ReactNode;
  /** Position of popover relative to trigger */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Additional className for the trigger button */
  triggerClassName?: string;
  /** Label for the trigger button (default: "What's this?") */
  triggerLabel?: string;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const positionClasses = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-0 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export function InfoPopover({
  title,
  children,
  position = 'bottom',
  triggerClassName = '',
  triggerLabel = "What's this?",
}: InfoPopoverProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((): void => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  const toggle = useCallback((): void => {
    setIsOpen((prev) => !prev);
  }, []);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event: MouseEvent): void => {
      if (containerRef.current !== null && !containerRef.current.contains(event.target as Node)) {
        close();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, close]);

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        close();
        return;
      }

      // Focus trap
      if (event.key === 'Tab' && popoverRef.current !== null) {
        const focusableElements =
          popoverRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (focusableElements.length === 0) return;

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, close]);

  // Focus first element when opened
  useEffect(() => {
    if (isOpen && popoverRef.current !== null) {
      const firstFocusable = popoverRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      firstFocusable?.focus();
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className={`text-secondary hover:text-primary inline-flex items-center justify-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface-nested)] px-2 py-0.5 text-xs transition-colors hover:border-[var(--border-emphasis)] hover:bg-[var(--bg-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--fg-accent)] ${triggerClassName} `}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`Learn about ${title}`}
      >
        <svg
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{triggerLabel}</span>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="info-popover-title"
          className={`rounded-nested shadow-3 absolute z-50 w-80 max-w-[calc(100vw-2rem)] border border-[var(--border-default)] bg-[var(--bg-surface-container)] text-[var(--fg-primary)] ${positionClasses[position]} `}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
            <h3 id="info-popover-title" className="text-primary text-sm font-semibold">
              {title}
            </h3>
            <button
              type="button"
              onClick={close}
              className="text-tertiary hover:text-secondary rounded-small hover:bg-surface-hover p-1 transition-colors"
              aria-label="Close"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="text-secondary px-4 py-3 text-sm leading-relaxed">{children}</div>
        </div>
      )}
    </div>
  );
}
