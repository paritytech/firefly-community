/**
 * Behavioural tests for useIlluminate.
 *
 * Rendered against the real IlluminateProvider (no mocks of the unit) so the
 * hook + provider state transitions are exercised together: opening with
 * options threads the pre-selected chain/campaign/claim through, closing flips
 * isOpen back, and using the hook with no provider throws.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import type { ReactNode } from 'react';
import { createChainId, createCampaignId, createClaimId } from '@cocuyo/types';
import { IlluminateProvider } from '@/components/IlluminateProvider';
import { useIlluminate } from './useIlluminate';

function wrapper({ children }: { children: ReactNode }): ReactNode {
  return <IlluminateProvider>{children}</IlluminateProvider>;
}

describe('useIlluminate', () => {
  it('throws a descriptive error when used outside an IlluminateProvider', () => {
    expect(() => renderHook(() => useIlluminate())).toThrow(/within an IlluminateProvider/);
  });

  it('starts closed with no pre-selections', () => {
    const { result } = renderHook(() => useIlluminate(), { wrapper });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.preSelectedChainId).toBeNull();
    expect(result.current.preSelectedCampaignId).toBeNull();
    expect(result.current.evidenceClaimId).toBeNull();
  });

  it('openModal() with no options opens with cleared pre-selections', () => {
    const { result } = renderHook(() => useIlluminate(), { wrapper });
    act(() => result.current.openModal());
    expect(result.current.isOpen).toBe(true);
    expect(result.current.preSelectedChainId).toBeNull();
    expect(result.current.preSelectedCampaignId).toBeNull();
  });

  it('threads chain/campaign/claim/evidence options through when opening', () => {
    const { result } = renderHook(() => useIlluminate(), { wrapper });
    const chainId = createChainId('chain-1');
    const campaignId = createCampaignId('campaign-1');
    const claimId = createClaimId('claim-1');

    act(() => result.current.openModal({ chainId, campaignId, claimId, evidenceType: 'support' }));

    expect(result.current.isOpen).toBe(true);
    expect(result.current.preSelectedChainId).toBe(chainId);
    expect(result.current.preSelectedCampaignId).toBe(campaignId);
    expect(result.current.evidenceClaimId).toBe(claimId);
    expect(result.current.evidenceType).toBe('support');
  });

  it('closeModal() flips isOpen back to false', () => {
    const { result } = renderHook(() => useIlluminate(), { wrapper });
    act(() => result.current.openModal({ chainId: createChainId('c') }));
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.closeModal());
    expect(result.current.isOpen).toBe(false);
  });
});
