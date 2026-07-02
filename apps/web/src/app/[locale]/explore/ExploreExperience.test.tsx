/**
 * Component tests for ExploreExperience — client claims loading (success +
 * failure), tab switching, empty state, and the localized clear-search control.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { Post, ClaimPreview, ChainPreview, PaginatedResult } from '@cocuyo/types';
import { createPostId, createClaimId, createDIMCredential } from '@cocuyo/types';
import messages from '../../../../i18n/messages/en.json';
import { ExploreExperience } from './ExploreExperience';

// ── mocks: isolate the component from services, host providers, and routing ──
const { getClaimsByStatus } = vi.hoisted(() => ({ getClaimsByStatus: vi.fn() }));
vi.mock('@/lib/services/claim-service', () => ({ claimService: { getClaimsByStatus } }));
vi.mock('@/lib/logging', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    swallowed: vi.fn(),
  }),
}));
vi.mock('@/hooks/useIlluminate', () => ({ useIlluminate: () => ({ openModal: vi.fn() }) }));
vi.mock('@/components/CorroborateDisputeSheet', () => ({
  useCorroborateDispute: () => ({ openSheet: vi.fn() }),
}));
vi.mock('@/components/TrustDrawer', () => ({ useTrustDrawer: () => ({ openDrawer: vi.fn() }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const e = messages.explore;

function claimsResult(items: ClaimPreview[]): PaginatedResult<ClaimPreview> {
  return { items, total: items.length, hasMore: false };
}

function makeSignal(id: string, topics: string[] = ['environmental']): Post {
  return {
    id: createPostId(id),
    author: {
      id,
      credentialHash: createDIMCredential(`dim-${id}`),
      pseudonym: 'RiverWatch',
      disclosureLevel: 'anonymous',
      reputation: 0,
    },
    content: { text: `Signal ${id}` },
    context: { topics },
    dimSignature: createDIMCredential(`dim-${id}`),
    status: 'published',
    chainLinks: [],
    corroborations: { witnessCount: 1, evidenceCount: 0, expertiseCount: 0, challengeCount: 0 },
    verification: { status: 'unverified' },
    createdAt: 1000,
  };
}

function makeClaim(id: string, statement: string): ClaimPreview {
  return {
    id: createClaimId(id),
    statement,
    sourcePostId: createPostId(`src-${id}`),
    status: 'verified',
    topics: ['environmental'],
    evidenceCount: 0,
    supportingCount: 3,
    contradictingCount: 0,
    createdAt: 1000,
  };
}

function renderExplore(props: Partial<{ signals: Post[]; chains: ChainPreview[] }> = {}): void {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ExploreExperience
        signals={props.signals ?? []}
        chains={props.chains ?? []}
        collectives={[]}
      />
    </NextIntlClientProvider>
  );
}

describe('ExploreExperience', () => {
  beforeEach(() => {
    getClaimsByStatus.mockReset();
    getClaimsByStatus.mockResolvedValue(claimsResult([]));
  });

  it('renders the heading and the three content-type filters', async () => {
    renderExplore({ signals: [makeSignal('s1')] });
    expect(screen.getByRole('heading', { name: e.heading })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(e.tabSignals) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(e.tabClaims) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(e.tabChains) })).toBeInTheDocument();
    await waitFor(() => expect(getClaimsByStatus).toHaveBeenCalledTimes(1));
  });

  it('shows the empty state when the active tab has no results', async () => {
    renderExplore({ signals: [] });
    expect(await screen.findByText(e.emptyTopicTitle)).toBeInTheDocument();
  });

  it('loads claims on the client and renders them in the Claims tab', async () => {
    getClaimsByStatus.mockResolvedValue(
      claimsResult([makeClaim('c1', 'Water ran orange in the river')])
    );
    renderExplore({ signals: [makeSignal('s1')] });

    // The Claims filter reflects the loaded count once the effect resolves.
    const claimsTab = await screen.findByRole('button', {
      name: new RegExp(`${e.tabClaims}\\s*1`),
    });
    fireEvent.click(claimsTab);
    expect(await screen.findByText(/Water ran orange in the river/)).toBeInTheDocument();
  });

  it('surfaces a localized error state when claims fail to load', async () => {
    getClaimsByStatus.mockRejectedValue(new Error('storage down'));
    renderExplore({ signals: [makeSignal('s1')] });

    fireEvent.click(screen.getByRole('button', { name: new RegExp(e.tabClaims) }));
    expect(await screen.findByText(e.claimsErrorTitle)).toBeInTheDocument();
  });

  it('reveals a localized clear-search control while searching', async () => {
    renderExplore({ signals: [makeSignal('s1')] });
    expect(screen.queryByRole('button', { name: e.clearSearch })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'orange' } });
    expect(screen.getByRole('button', { name: e.clearSearch })).toBeInTheDocument();
    await waitFor(() => expect(getClaimsByStatus).toHaveBeenCalled());
  });
});
