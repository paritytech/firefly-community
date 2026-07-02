'use client';

/**
 * IlluminateModal — The universal signal creation modal.
 *
 * Features:
 * - Dark overlay with blur
 * - ESC key and click-outside to close
 * - Focus trap for accessibility
 * - Responsive design
 */

import { useEffect, useRef, useCallback, type ReactElement } from 'react';
import { useIlluminate } from '@/hooks/useIlluminate';
import { IlluminateForm } from './IlluminateForm';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function IlluminateModal(): ReactElement | null {
  const { isOpen, closeModal } = useIlluminate();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Handle keyboard events (ESC and Tab for focus trap)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeModal();
        return;
      }

      // Focus trap: handle Tab key
      if (event.key === 'Tab' && modalRef.current !== null) {
        const focusableElements =
          modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (focusableElements.length === 0) return;

        if (event.shiftKey) {
          // Shift+Tab: if on first element, move to last
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement?.focus();
          }
        } else {
          // Tab: if on last element, move to first
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement?.focus();
          }
        }
      }
    },
    [closeModal]
  );

  // Handle click outside
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>): void => {
      if (event.target === event.currentTarget) {
        closeModal();
      }
    },
    [closeModal]
  );

  // Setup event listeners and focus management
  useEffect(() => {
    if (isOpen) {
      // Store current active element for restoration
      previousActiveElement.current = document.activeElement;

      // Add key listener
      document.addEventListener('keydown', handleKeyDown);

      // Prevent body scroll
      document.body.style.overflow = 'hidden';

      // Focus first focusable element in modal
      const firstFocusable = modalRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (firstFocusable !== null && firstFocusable !== undefined) {
        firstFocusable.focus();
      } else {
        modalRef.current?.focus();
      }

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';

        // Restore focus
        if (previousActiveElement.current instanceof HTMLElement) {
          previousActiveElement.current.focus();
        }
      };
    }
    return undefined;
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="illuminate-title"
      onClick={handleBackdropClick}
    >
      {/* Backdrop with blur */}
      <div
        className="animate-backdrop-in absolute inset-0 bg-overlay backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Modal container */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="animate-scale-in relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-container border border-DEFAULT bg-surface-nested shadow-3"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-DEFAULT border-b bg-surface-nested p-4 sm:p-6">
          <h2 id="illuminate-title" className="text-xl font-bold text-primary">
            Illuminate
          </h2>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-nested p-2 text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
            aria-label="Close modal"
          >
            <svg
              className="h-5 w-5"
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

        {/* Form content */}
        <div className="p-4 sm:p-6">
          <IlluminateForm />
        </div>
      </div>
    </div>
  );
}
