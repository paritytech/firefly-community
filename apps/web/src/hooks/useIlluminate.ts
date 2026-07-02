'use client';

/**
 * useIlluminate — Hook for accessing the Illuminate modal context.
 *
 * Provides access to openModal() and closeModal() functions,
 * as well as current modal state.
 *
 * @example
 * const { openModal } = useIlluminate();
 * openModal(); // Open from navbar
 * openModal({ chainId: 'chain-001' }); // Open from chain page
 * openModal({ campaignId: 'campaign-001' }); // Open from campaign page
 */

import { useContext } from 'react';
import { IlluminateContext, type IlluminateContextValue } from '@/components/IlluminateProvider';

export function useIlluminate(): IlluminateContextValue {
  const context = useContext(IlluminateContext);

  if (context === null) {
    throw new Error('useIlluminate must be used within an IlluminateProvider');
  }

  return context;
}
