'use client';

/**
 * WithdrawSheet — Modal for requesting a withdrawal.
 */

import type { ReactElement } from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';

interface WithdrawSheetTranslations {
  title: string;
  description: string;
  sharesLabel: string;
  estimatedValue: string;
  cooldownNote: string;
  submit: string;
  submitting: string;
  cancel: string;
}

export interface WithdrawSheetProps {
  isOpen: boolean;
  onClose: () => void;
  availableShares: bigint;
  translations: WithdrawSheetTranslations;
  onSubmit: (shares: bigint) => Promise<void>;
}

export function WithdrawSheet({
  isOpen,
  onClose,
  availableShares,
  translations: t,
  onSubmit,
}: WithdrawSheetProps): ReactElement | null {
  const [sharesToWithdraw, setSharesToWithdraw] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Format available shares for display
  const formattedAvailable = (Number(availableShares) / 1e18).toFixed(4);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSharesToWithdraw('');
      setError(null);
      previousFocusRef.current = document.activeElement as HTMLElement;
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle click outside
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  // Handle max button
  const handleMax = useCallback(() => {
    setSharesToWithdraw(formattedAvailable);
  }, [formattedAvailable]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    const sharesNum = parseFloat(sharesToWithdraw);
    if (isNaN(sharesNum) || sharesNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const sharesBigInt = BigInt(Math.floor(sharesNum * 1e18));
    if (sharesBigInt > availableShares) {
      setError('Insufficient shares');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(sharesBigInt);
    } catch {
      setError('Failed to submit withdrawal request');
    } finally {
      setIsSubmitting(false);
    }
  }, [sharesToWithdraw, availableShares, onSubmit]);

  if (!isOpen) return null;

  // Estimate value (1:1 at initial price for demo)
  const sharesNum = parseFloat(sharesToWithdraw) || 0;
  const estimatedValue = sharesNum.toFixed(2);

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        className="w-full max-w-md rounded-container border border-[var(--border-default)] bg-[var(--bg-surface-raised)] p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-title"
      >
        <h2
          id="withdraw-title"
          className="mb-2 font-display text-xl font-medium text-[var(--fg-primary)]"
        >
          {t.title}
        </h2>
        <p className="mb-6 text-sm text-[var(--fg-secondary)]">{t.description}</p>

        {/* Shares input */}
        <div className="mb-4">
          <label
            htmlFor="withdraw-shares"
            className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]"
          >
            {t.sharesLabel}
          </label>
          <div className="relative">
            <input
              id="withdraw-shares"
              type="number"
              min="0"
              step="0.0001"
              value={sharesToWithdraw}
              onChange={(e) => setSharesToWithdraw(e.target.value)}
              placeholder="0.0000"
              className="w-full rounded-nested border border-[var(--border-default)] bg-[var(--bg-surface-container)] py-3 pl-4 pr-16 font-mono text-[var(--fg-primary)] placeholder:text-[var(--fg-tertiary)] focus:border-[var(--color-firefly-gold)] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleMax}
              className="hover:bg-[var(--color-firefly-gold)]/20 absolute right-3 top-1/2 -translate-y-1/2 rounded bg-[var(--bg-surface-nested)] px-2 py-1 text-xs font-medium text-[var(--color-firefly-gold)]"
            >
              MAX
            </button>
          </div>
          <p className="mt-1 text-xs text-[var(--fg-tertiary)]">
            Available: {formattedAvailable} shares
          </p>
        </div>

        {/* Estimated value */}
        <div className="mb-4 rounded-nested bg-[var(--bg-surface-container)] p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--fg-tertiary)]">{t.estimatedValue}</span>
            <span className="font-medium text-[var(--fg-primary)]">~${estimatedValue}</span>
          </div>
        </div>

        {/* Cooldown warning */}
        <div className="mb-6 flex items-start gap-2 text-xs text-[var(--fg-warning)]">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span>{t.cooldownNote}</span>
        </div>

        {/* Error */}
        {error != null && error !== '' && (
          <div className="bg-[var(--fg-error)]/10 mb-4 rounded-nested p-3 text-sm text-[var(--fg-error)]">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-nested border border-[var(--border-default)] px-4 py-2 text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-emphasis)] hover:text-[var(--fg-primary)] disabled:opacity-50"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || !sharesToWithdraw}
            className="flex flex-1 items-center justify-center gap-2 rounded-nested bg-[var(--color-firefly-gold)] px-4 py-2 font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {isSubmitting ? t.submitting : t.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
