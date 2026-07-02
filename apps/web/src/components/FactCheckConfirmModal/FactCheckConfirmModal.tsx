'use client';

/**
 * FactCheckConfirmModal — Modal to confirm submitting a claim for fact-checking.
 *
 * Shows the claim statement and asks user to confirm before submitting
 * to fact-checker collectives.
 */

import { useEffect, useRef, useCallback, useState, type ReactElement } from 'react';
import { useFactCheckConfirm } from './FactCheckConfirmProvider';
import { useAppState } from '@/components/AppStateProvider';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Auto-close delay after successful submission */
const AUTO_CLOSE_DELAY_MS = 1500;

export function FactCheckConfirmModal(): ReactElement | null {
  const { isOpen, claimId, closeModal } = useFactCheckConfirm();
  const { getClaim, submitClaimForFactCheck } = useAppState();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);
  const autoCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claim = claimId !== null ? getClaim(claimId) : undefined;

  // Cleanup auto-close timeout on unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimeoutRef.current !== null) {
        clearTimeout(autoCloseTimeoutRef.current);
      }
    };
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      // Clear any pending auto-close from previous open
      if (autoCloseTimeoutRef.current !== null) {
        clearTimeout(autoCloseTimeoutRef.current);
        autoCloseTimeoutRef.current = null;
      }
      setIsSubmitting(false);
      setSubmitted(false);
      setError(null);
    }
  }, [isOpen]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent): void => {
      // Don't allow Escape during success state (auto-closing)
      if (event.key === 'Escape' && !submitted) {
        closeModal();
        return;
      }

      // Focus trap
      if (event.key === 'Tab' && modalRef.current !== null) {
        const focusableElements =
          modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
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
    },
    [closeModal, submitted]
  );

  // Focus management and keyboard listeners
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      document.addEventListener('keydown', handleKeyDown);

      // Focus first focusable element
      requestAnimationFrame(() => {
        const firstFocusable = modalRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        firstFocusable?.focus();
      });

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
    // Restore focus when closing
    if (previousActiveElement.current instanceof HTMLElement) {
      previousActiveElement.current.focus();
    }
    return undefined;
  }, [isOpen, handleKeyDown]);

  const handleSubmit = (): void => {
    if (claimId === null) return;

    setIsSubmitting(true);
    setError(null);

    const result = submitClaimForFactCheck(claimId);

    if (result) {
      setSubmitted(true);
      // Focus the modal container for accessibility during success state
      modalRef.current?.focus();
      // Auto-close after showing success
      autoCloseTimeoutRef.current = setTimeout(() => {
        autoCloseTimeoutRef.current = null;
        closeModal();
      }, AUTO_CLOSE_DELAY_MS);
    } else {
      setError('Failed to submit claim for fact-checking. Please try again.');
    }

    setIsSubmitting(false);
  };

  const handleBackdropClick = (e: React.MouseEvent): void => {
    // Don't allow backdrop close during success state (auto-closing)
    if (e.target === e.currentTarget && !submitted) {
      closeModal();
    }
  };

  if (!isOpen || claimId === null) {
    return null;
  }

  return (
    <div
      className="animate-in fade-in fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 duration-200"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fact-check-confirm-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="animate-in zoom-in-95 w-full max-w-md rounded-xl bg-[var(--bg-surface-main)] duration-200 focus:outline-none"
      >
        {/* Header */}
        <div className="border-b border-[var(--border-default)] px-6 py-4">
          <h2 id="fact-check-confirm-title" className="text-lg font-semibold text-primary">
            Submit for Fact-Checking
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {submitted ? (
            <div className="text-center">
              <div className="bg-[var(--fg-success)]/15 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                <svg
                  className="h-6 w-6 text-[var(--fg-success)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-sm text-secondary" role="status" aria-live="polite">
                Claim submitted for fact-checking!
              </p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-secondary">
                This claim will be submitted to fact-checker collectives for verification. Fund a
                bounty to prioritize the review.
              </p>

              {/* Claim preview */}
              {claim !== undefined && (
                <div className="mb-4 rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-nested)] p-4">
                  <p className="mb-1 text-xs text-tertiary">Claim:</p>
                  <p className="line-clamp-4 text-sm text-primary">{claim.statement}</p>
                </div>
              )}

              {/* Error message */}
              {error !== null && (
                <p className="mb-4 text-sm text-[var(--fg-error)]" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        {!submitted && (
          <div className="flex gap-3 border-t border-[var(--border-default)] px-6 py-4">
            <button
              type="button"
              onClick={closeModal}
              className="flex-1 rounded-nested border border-[var(--border-default)] px-4 py-2.5 text-sm font-medium text-secondary transition-colors hover:bg-[var(--bg-surface-nested)]"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 rounded-nested bg-[var(--color-firefly-gold)] px-4 py-2.5 text-sm font-medium text-[var(--bg-primary)] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit for Fact-Check'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
