'use client';

/**
 * CreateBountySheet — Bottom sheet for funding claim fact-checking bounties.
 *
 * Opens from the Trust Drawer when user wants to fund a bounty for
 * fact-checking a specific claim.
 */

import { useEffect, useRef, useCallback, useState, type ReactElement } from 'react';
import { useCreateBounty } from './CreateBountyProvider';
import { useAppState } from '@/components/AppStateProvider';
import { usePersonhood } from '@/hooks/usePersonhood';
import { useSigner } from '@/lib/context/SignerContext';
import { isOnChainPaymentActive } from '@/lib/services/payment-router-service';
import { fundBounty, toBountyId } from '@/lib/chain/bounty-escrow';
import { deterministicBountyId } from '@/lib/chain/bounty-id';
import { getContractAddress } from '@/lib/chain/evm/config';
import { nativeToEvmBalance } from '@/lib/chain/asset-hub-provider';
import { createLogger } from '@/lib/logging';

const log = createLogger('CreateBountySheet');

/** Duration in days → an absolute Unix expiry (seconds) for the on-chain bounty. */
function expiryTimestamp(durationDays: number): number {
  const SECONDS_PER_DAY = 24 * 60 * 60;
  return Math.floor(Date.now() / 1000) + durationDays * SECONDS_PER_DAY;
}

/**
 * Convert a USD dollar amount to native-token EVM units (18 decimals). The demo
 * convention pays the same numeric amount in PAS as in USD (not an FX rate):
 * dollars → 10-decimal PAS planck → 18-decimal EVM value. String parsing avoids
 * float drift.
 */
function dollarsToEvmAmount(dollars: number): bigint {
  const PAS_DECIMALS = 10;
  const [whole = '0', decimal = ''] = dollars.toFixed(PAS_DECIMALS).split('.');
  const planck = BigInt(whole + decimal.padEnd(PAS_DECIMALS, '0').slice(0, PAS_DECIMALS));
  return nativeToEvmBalance(planck);
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const DURATION_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
];

export function CreateBountySheet(): ReactElement | null {
  const { isOpen, claimId, closeSheet } = useCreateBounty();
  const { createCampaign, getClaim } = useAppState();
  const { canPerform } = usePersonhood();
  const { selectedAccount, getSigner } = useSigner();
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // Comma-separated topics, used only for general (claim-less) campaigns; claim-funded bounties
  // inherit their topics from the claim.
  const [topicsInput, setTopicsInput] = useState('');
  const [fundingAmount, setFundingAmount] = useState('100');
  const [duration, setDuration] = useState(14);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against a second real payment being submitted (e.g. close/reopen)
  // while an earlier one is still in flight. Persists across close since the
  // sheet component stays mounted (it just renders null when closed).
  const inFlightRef = useRef(false);

  const claim = claimId !== null ? getClaim(claimId) : undefined;

  // Reset form when the sheet opens. A claim-funded bounty auto-fills the title from the claim; a
  // general campaign starts with an empty title and a topics field.
  useEffect(() => {
    if (!isOpen) return;
    if (claim !== undefined) {
      // Auto-fill title from claim statement (truncated at word boundary)
      // Max title length ~100 chars, prefix is 12 chars, so truncate statement at ~88
      const MAX_STATEMENT_LENGTH = 88;
      let truncatedStatement = claim.statement;
      if (claim.statement.length > MAX_STATEMENT_LENGTH) {
        // Find last space before limit to avoid splitting words
        const lastSpace = claim.statement.lastIndexOf(' ', MAX_STATEMENT_LENGTH);
        const cutoff = lastSpace > MAX_STATEMENT_LENGTH / 2 ? lastSpace : MAX_STATEMENT_LENGTH;
        truncatedStatement = `${claim.statement.slice(0, cutoff)}...`;
      }
      setTitle(`Fact-check: ${truncatedStatement}`);
    } else {
      setTitle('');
    }
    setDescription('');
    setTopicsInput('');
    setFundingAmount('100');
    setDuration(14);
    setIsSubmitting(false);
    setError(null);
  }, [isOpen, claim]);

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

  // Focus management and keyboard listeners
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      document.addEventListener('keydown', handleKeyDown);

      // Focus first focusable element
      requestAnimationFrame(() => {
        const firstFocusable = sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
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

  const handleSubmit = async (): Promise<void> => {
    // Ignore duplicate/concurrent submits while a payment is still in flight.
    if (inFlightRef.current) return;
    if (title.trim().length === 0) return;

    // Check personhood capability
    if (!canPerform('canFundBounty')) {
      setError('You need to verify your personhood to fund bounties.');
      return;
    }

    const amount = parseFloat(fundingAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid funding amount.');
      return;
    }

    inFlightRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      // When on-chain funding is active, fund the BountyEscrow contract via the
      // real Revive.call extrinsic first and fail closed: no campaign is created
      // unless the funding transaction confirms on chain.
      let fundingTxHash: string | undefined;
      // Deterministic bytes32 id of the on-chain bounty, recorded with the
      // campaign so the persisted record references the exact on-chain bounty.
      let onChainBountyId: string | undefined;
      if (isOnChainPaymentActive()) {
        const signer = getSigner();
        const origin = selectedAccount?.address;
        // Fail closed when the wallet isn't connected — never silently create an
        // unfunded campaign while on-chain funding is active.
        if (signer === null || origin === undefined) {
          setError('Connect your wallet to fund this bounty on chain.');
          return;
        }
        // Fail closed when the escrow contract isn't deployed on this network.
        if (getContractAddress('bountyEscrow') === null) {
          setError('Bounty funding is unavailable on this network.');
          return;
        }
        // Compute the DETERMINISTIC id + its on-chain bytes32 form BEFORE
        // submitting, so the id used on-chain is exactly the id recorded with the
        // campaign (no non-deterministic Date.now()). Knowing it up front means
        // the intended bounty id is recoverable even if the local write fails.
        const expiresAt = expiryTimestamp(duration);
        const evmAmount = dollarsToEvmAmount(amount);
        const bountyId = deterministicBountyId(claimId, origin, evmAmount, expiresAt);
        onChainBountyId = toBountyId(bountyId);
        try {
          const result = await fundBounty({
            origin,
            signer,
            bountyId,
            amount: evmAmount,
            expiresAt,
          });
          if (!result.success) {
            setError('On-chain funding failed. Please try again.');
            return;
          }
          fundingTxHash = result.txHash;
        } catch (err) {
          log.error('On-chain bounty funding failed', 'handleSubmit', err);
          setError('On-chain funding failed. Please try again.');
          return;
        }
      }

      const topics =
        claim !== undefined
          ? [...claim.topics]
          : topicsInput
              .split(',')
              .map((topic) => topic.trim())
              .filter((topic) => topic.length > 0);

      const result = createCampaign({
        title: title.trim(),
        description: description.trim(),
        topics,
        fundingAmount: amount,
        expiresInDays: duration,
        // Only link a claim when funding a specific one; general campaigns have no target claim.
        ...(claimId !== null && { targetClaimIds: [claimId] }),
        ...(fundingTxHash !== undefined && { fundingTxHash }),
        // Record the exact on-chain bounty id so the campaign references it.
        ...(onChainBountyId !== undefined && { onChainBountyId }),
      });

      if (result !== null) {
        closeSheet();
      } else {
        setError('Failed to create campaign. Please try again.');
      }
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      closeSheet();
    }
  };

  if (!isOpen) {
    return null;
  }

  const isGeneral = claim === undefined;

  return (
    <div
      className="animate-in fade-in fixed inset-0 z-[110] flex items-end justify-center bg-black/60 duration-200"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-bounty-title"
    >
      <div
        ref={sheetRef}
        className="animate-in slide-in-from-bottom w-full max-w-lg rounded-t-2xl bg-[var(--bg-surface-main)] duration-300"
      >
        {/* Handle */}
        <div className="flex justify-center pb-2 pt-3">
          <div className="h-1 w-12 rounded-full bg-[var(--border-default)]" />
        </div>

        {/* Header */}
        <div className="border-b border-[var(--border-default)] px-6 pb-4">
          <h2 id="create-bounty-title" className="text-lg font-semibold text-primary">
            {isGeneral ? 'Create a Campaign' : 'Fund a Bounty'}
          </h2>
          <p className="mt-1 text-sm text-secondary">
            {isGeneral
              ? 'Sponsor a fact-checking campaign and reward contributors'
              : 'Fund fact-checking for this claim'}
          </p>
        </div>

        {/* Claim context */}
        {claim !== undefined && (
          <div className="border-b border-[var(--border-default)] bg-[var(--bg-surface-nested)] px-6 py-4">
            <p className="mb-1 text-xs text-tertiary">Claim to fact-check:</p>
            <p className="line-clamp-3 text-sm text-secondary">{claim.statement}</p>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4 px-6 py-6">
          {/* Title */}
          <div>
            <label htmlFor="bounty-title" className="mb-2 block text-sm font-medium text-primary">
              Bounty title
            </label>
            <input
              id="bounty-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for this bounty"
              className="placeholder-tertiary w-full rounded-nested border border-DEFAULT bg-surface-muted px-4 py-3 text-primary transition-colors focus:border-accent focus:outline-none"
              disabled={isSubmitting}
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="bounty-description"
              className="mb-2 block text-sm font-medium text-primary"
            >
              Description (optional)
            </label>
            <textarea
              id="bounty-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any additional context for fact-checkers"
              rows={2}
              className="placeholder-tertiary w-full resize-none rounded-nested border border-DEFAULT bg-surface-muted px-4 py-3 text-primary transition-colors focus:border-accent focus:outline-none"
              disabled={isSubmitting}
            />
          </div>

          {/* Topics — general campaigns only (claim-funded bounties inherit the claim's topics) */}
          {isGeneral && (
            <div>
              <label
                htmlFor="bounty-topics"
                className="mb-2 block text-sm font-medium text-primary"
              >
                Topics (optional)
              </label>
              <input
                id="bounty-topics"
                type="text"
                value={topicsInput}
                onChange={(e) => setTopicsInput(e.target.value)}
                placeholder="Comma-separated, e.g. media, disinformation"
                className="placeholder-tertiary w-full rounded-nested border border-DEFAULT bg-surface-muted px-4 py-3 text-primary transition-colors focus:border-accent focus:outline-none"
                disabled={isSubmitting}
              />
            </div>
          )}

          {/* Funding Amount */}
          <div>
            <label htmlFor="bounty-amount" className="mb-2 block text-sm font-medium text-primary">
              Funding amount (USD)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary">$</span>
              <input
                id="bounty-amount"
                type="number"
                min="1"
                step="1"
                value={fundingAmount}
                onChange={(e) => setFundingAmount(e.target.value)}
                className="placeholder-tertiary w-full rounded-nested border border-DEFAULT bg-surface-muted py-3 pl-8 pr-4 text-primary transition-colors focus:border-accent focus:outline-none"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label
              htmlFor="bounty-duration"
              className="mb-2 block text-sm font-medium text-primary"
            >
              Duration
            </label>
            <select
              id="bounty-duration"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10))}
              className="w-full rounded-nested border border-DEFAULT bg-surface-muted px-4 py-3 text-primary transition-colors focus:border-accent focus:outline-none"
              disabled={isSubmitting}
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Error message */}
          {error !== null && <p className="text-sm text-[var(--fg-error)]">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-8">
          <button
            type="button"
            onClick={closeSheet}
            className="flex-1 rounded-nested border border-[var(--border-default)] px-4 py-3 text-sm font-medium text-secondary transition-colors hover:bg-[var(--bg-surface-nested)]"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={title.trim().length === 0 || isSubmitting}
            className="flex-1 rounded-nested bg-[var(--fg-accent)] px-4 py-3 text-sm font-medium text-[var(--bg-primary)] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : isGeneral ? 'Create Campaign' : 'Fund Bounty'}
          </button>
        </div>
      </div>
    </div>
  );
}
