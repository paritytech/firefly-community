'use client';

/**
 * IlluminateFAB — Floating action button for illuminating signals.
 *
 * A glowing firefly-gold button fixed at the bottom-right of the screen. Pulses gently to draw
 * attention without being distracting.
 *
 * Variants:
 * - `global` (default): visible on all breakpoints.
 * - `mobile`: hidden on `md`+ where a header button is used instead.
 *
 * Set `requireConnected` to hide the button until a wallet is connected.
 */

import type { ReactElement } from 'react';
import { FireflySymbol } from '@cocuyo/ui';
import { useIlluminate } from '@/hooks/useIlluminate';
import { useSigner } from '@/hooks';

export interface IlluminateFABProps {
  /** Accessible label. */
  label?: string;
  /** `global` shows on all breakpoints; `mobile` hides on `md`+ (desktop uses the header button). */
  variant?: 'global' | 'mobile';
  /** When true, the button is hidden unless a wallet is connected. */
  requireConnected?: boolean;
}

export function IlluminateFAB({
  label = 'Illuminate a signal',
  variant = 'global',
  requireConnected = true,
}: IlluminateFABProps): ReactElement | null {
  const { openModal } = useIlluminate();
  const { isConnected } = useSigner();

  if (requireConnected && !isConnected) {
    return null;
  }

  const handleClick = (): void => {
    openModal();
  };

  const className = [
    'animate-pulse-glow group fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center',
    'rounded-full bg-[var(--color-firefly-gold)] text-[var(--bg-primary)]',
    'shadow-[0_4px_20px_rgba(232,185,49,0.4)] transition-all duration-200 ease-out',
    'hover:scale-110 hover:shadow-[0_4px_30px_rgba(232,185,49,0.6)]',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fg-accent)]',
    'active:scale-100 active:shadow-[0_2px_10px_rgba(232,185,49,0.3)]',
    variant === 'mobile' ? 'md:hidden' : '',
  ].join(' ');

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      aria-label={label}
      title={label}
    >
      <span className="leading-none transition-transform group-hover:scale-110" aria-hidden="true">
        <FireflySymbol size={24} color="inherit" aria-hidden="true" />
      </span>
    </button>
  );
}
