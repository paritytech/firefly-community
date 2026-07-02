'use client';

/**
 * IlluminateCTA — Button to open the Illuminate modal from a campaign page.
 */

import type { ReactElement } from 'react';
import type { CampaignId } from '@cocuyo/types';
import { useIlluminate } from '@/hooks/useIlluminate';

interface IlluminateCTAProps {
  campaignId: CampaignId;
  label: string;
}

export function IlluminateCTA({ campaignId, label }: IlluminateCTAProps): ReactElement {
  const { openModal } = useIlluminate();

  const handleClick = (): void => {
    openModal({ campaignId });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full rounded-lg bg-[var(--color-firefly-gold)] px-4 py-3 font-medium text-[var(--bg-default)] transition-opacity hover:opacity-90"
    >
      {label}
    </button>
  );
}
