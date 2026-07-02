'use client';

/**
 * CorroborateDisputeSheet — Bottom sheet for evidence submission.
 *
 * Opens when user taps Corroborate or Dispute on a post.
 * Collects evidence type and content to submit.
 */

import { useEffect, useRef, useCallback, useState, type ReactElement } from 'react';
import type { EvidenceType } from '@cocuyo/types';
import { formatPUSDCompact } from '@cocuyo/types';
import { useToast } from '@cocuyo/ui';
import { useCorroborateDispute } from './CorroborateDisputeProvider';
import { useAppState, type EvidenceInput } from '@/components/AppStateProvider';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface EvidenceTypeOption {
  type: EvidenceType;
  label: string;
  description: string;
}

const EVIDENCE_TYPES: EvidenceTypeOption[] = [
  {
    type: 'observation',
    label: 'Firsthand account',
    description: 'I witnessed this myself',
  },
  {
    type: 'source_link',
    label: 'Source link',
    description: 'Link to supporting evidence',
  },
  {
    type: 'photo',
    label: 'Photo evidence',
    description: 'Upload an image',
  },
  {
    type: 'document',
    label: 'Document',
    description: 'Upload a document',
  },
];

export function CorroborateDisputeSheet(): ReactElement | null {
  const { isOpen, post, mode, campaign, closeSheet } = useCorroborateDispute();
  const { submitCorroboration } = useAppState();
  const { addToast } = useToast();
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Form state
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('observation');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Inline submit error, shown in the sheet itself — a toast renders behind the sheet's
  // backdrop (z-[100]) and is unreadable while the modal is open.
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset form when sheet opens
  useEffect(() => {
    if (isOpen) {
      setEvidenceType('observation');
      setContent('');
      setDescription('');
      setIsSubmitting(false);
      setSubmitError(null);
    }
  }, [isOpen]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeSheet();
        return;
      }

      // Focus trap
      if (event.key === 'Tab' && sheetRef.current !== null) {
        const focusableElements =
          sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
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
    [closeSheet]
  );

  // Handle click outside
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>): void => {
      if (event.target === event.currentTarget) {
        closeSheet();
      }
    },
    [closeSheet]
  );

  // Setup event listeners and focus management
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      const firstFocusable = sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (firstFocusable !== null && firstFocusable !== undefined) {
        firstFocusable.focus();
      } else {
        sheetRef.current?.focus();
      }

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';

        if (previousActiveElement.current instanceof HTMLElement) {
          previousActiveElement.current.focus();
        }
      };
    }
    return undefined;
  }, [isOpen, handleKeyDown]);

  // Handle form submission - uploads to Bulletin Chain
  const handleSubmit = useCallback(
    async (e: React.FormEvent): Promise<void> => {
      e.preventDefault();

      if (post === null || content.trim().length === 0) {
        return;
      }

      setIsSubmitting(true);
      setSubmitError(null);

      const errorMessage =
        mode === 'corroborate'
          ? "Couldn't submit your corroboration. Please try again."
          : "Couldn't submit your dispute. Please try again.";

      try {
        const evidence: EvidenceInput = {
          type: evidenceType,
          content: content.trim(),
          ...(description.trim().length > 0 && { description: description.trim() }),
        };

        // Upload corroboration to Bulletin Chain
        const result = await submitCorroboration(post.id, mode, evidence);

        if (!result.ok) {
          // Surface the specific failure (fail-closed host error, denied allowance, upload
          // failure) both inline (readable while the sheet is open) and as a toast.
          setSubmitError(result.error);
          addToast(result.error, 'error');
          return;
        }
        closeSheet();
      } catch {
        setSubmitError(errorMessage);
        addToast(errorMessage, 'error');
      } finally {
        setIsSubmitting(false);
      }
    },
    [post, evidenceType, content, description, mode, submitCorroboration, closeSheet, addToast]
  );

  // Clear a stale submit error as soon as the user edits the form, so a fixed input isn't shown
  // alongside the previous failure.
  const handleContentChange = useCallback((value: string): void => {
    setContent(value);
    setSubmitError(null);
  }, []);
  const handleEvidenceTypeChange = useCallback((type: EvidenceType): void => {
    setEvidenceType(type);
    setSubmitError(null);
  }, []);

  if (!isOpen || post === null) {
    return null;
  }

  const isCorroborate = mode === 'corroborate';
  const actionLabel = isCorroborate ? 'Corroborate' : 'Dispute';
  const actionColor = isCorroborate ? 'var(--fg-success)' : 'var(--fg-error)';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="corroborate-dispute-title"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className="animate-backdrop-in absolute inset-0 bg-overlay backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Sheet container - slides up on mobile, centered on desktop */}
      <div
        ref={sheetRef}
        tabIndex={-1}
        className="animate-slide-up sm:animate-scale-in relative max-h-[90vh] w-full overflow-y-auto rounded-t-container border border-DEFAULT bg-surface-nested shadow-3 sm:max-w-lg sm:rounded-container"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-DEFAULT border-b bg-surface-nested p-4 sm:p-6">
          <h2 id="corroborate-dispute-title" className="text-xl font-bold text-primary">
            {actionLabel}
          </h2>
          <button
            type="button"
            onClick={closeSheet}
            className="rounded-nested p-2 text-secondary transition-colors hover:bg-surface-hover hover:text-primary"
            aria-label="Close"
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

        {/* Content */}
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-6 p-4 sm:p-6"
        >
          {/* Campaign notice */}
          {campaign !== null && (
            <div className="bg-[var(--color-firefly-gold)]/10 border-[var(--color-firefly-gold)]/30 rounded-nested border p-4">
              <p className="mb-1 text-sm font-medium text-[var(--color-firefly-gold)]">
                This post is under funded investigation
              </p>
              <p className="text-sm text-secondary">
                Contributing evidence may earn you{' '}
                <span className="font-medium text-[var(--color-firefly-gold)]">
                  {formatPUSDCompact(campaign.fundingAmount)}
                </span>
              </p>
            </div>
          )}

          {/* Post preview */}
          <div className="rounded-nested border border-subtle bg-surface-container p-4">
            <p className="line-clamp-3 text-sm text-secondary">{post.content.text}</p>
            <p className="mt-2 text-xs text-tertiary">by {post.author.pseudonym}</p>
          </div>

          {/* Evidence type selector */}
          <fieldset>
            <legend className="mb-3 text-sm font-medium text-primary">
              What type of evidence are you providing?
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {EVIDENCE_TYPES.map((option) => (
                <label
                  key={option.type}
                  className={`flex cursor-pointer flex-col rounded-nested border p-3 transition-all ${
                    evidenceType === option.type
                      ? 'bg-[var(--fg-accent)]/5 border-[var(--fg-accent)]'
                      : 'border-DEFAULT hover:border-subtle'
                  } `}
                >
                  <input
                    type="radio"
                    name="evidenceType"
                    value={option.type}
                    checked={evidenceType === option.type}
                    onChange={() => handleEvidenceTypeChange(option.type)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium text-primary">{option.label}</span>
                  <span className="text-xs text-tertiary">{option.description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Evidence input */}
          <div>
            <label className="mb-2 block text-sm font-medium text-primary">
              {evidenceType === 'source_link' && 'Link URL'}
              {evidenceType === 'observation' && 'Describe what you observed'}
              {evidenceType === 'photo' && 'Photo upload'}
              {evidenceType === 'document' && 'Document upload'}
            </label>

            {evidenceType === 'source_link' && (
              <input
                type="url"
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-nested border border-DEFAULT bg-surface-container px-4 py-3 text-primary transition-colors placeholder:text-tertiary focus:border-[var(--fg-accent)] focus:outline-none"
                required
              />
            )}

            {evidenceType === 'observation' && (
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Describe what you witnessed..."
                rows={4}
                className="w-full resize-none rounded-nested border border-DEFAULT bg-surface-container px-4 py-3 text-primary transition-colors placeholder:text-tertiary focus:border-[var(--fg-accent)] focus:outline-none"
                required
              />
            )}

            {(evidenceType === 'photo' || evidenceType === 'document') && (
              <div className="flex flex-col items-center justify-center rounded-nested border-2 border-DEFAULT border-dashed p-8 text-center">
                <p className="mb-2 text-sm text-secondary">File upload coming soon</p>
                <p className="text-xs text-tertiary">
                  For now, use a link or describe your evidence
                </p>
                <input
                  type="text"
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Or paste a link to the file..."
                  className="mt-4 w-full rounded-nested border border-DEFAULT bg-surface-container px-4 py-2 text-sm text-primary transition-colors placeholder:text-tertiary focus:border-[var(--fg-accent)] focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Optional description */}
          {evidenceType !== 'observation' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-primary">
                How does this support your {mode === 'corroborate' ? 'corroboration' : 'dispute'}?
                <span className="font-normal text-tertiary"> (optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain how this evidence relates to the post..."
                rows={2}
                className="w-full resize-none rounded-nested border border-DEFAULT bg-surface-container px-4 py-3 text-primary transition-colors placeholder:text-tertiary focus:border-[var(--fg-accent)] focus:outline-none"
              />
            </div>
          )}

          {/* Inline submit error — visible while the sheet is open (a toast sits behind it) */}
          {submitError !== null && (
            <p
              role="alert"
              className="bg-[var(--fg-error)]/10 rounded-nested border border-[var(--fg-error)] px-4 py-3 text-sm text-[var(--fg-error)]"
            >
              {submitError}
            </p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={content.trim().length === 0 || isSubmitting}
            className="w-full rounded-nested px-6 py-3 font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: actionColor,
              color: 'var(--bg-primary)',
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
}
