/**
 * Tests for ClaimSection component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ClaimSection } from './ClaimSection';
import { ToastProvider } from '@cocuyo/ui';
import { AppStateProvider } from '@/components/AppStateProvider';
import { CreateBountyProvider } from '@/components/CreateBountySheet';
import { FactCheckConfirmProvider } from '@/components/FactCheckConfirmModal';
import type { Claim, ClaimEvidence, Campaign } from '@cocuyo/types';
import {
  createClaimId,
  createPostId,
  createDIMCredential,
  createCampaignId,
  createCollectiveId,
  createPUSDAmount,
  createEscrowId,
  createTransactionHash,
  createCommunityId,
} from '@cocuyo/types';

// Mock campaign data for bounty status tests
const mockGetClaimCampaigns = vi.fn();

vi.mock('@/components/AppStateProvider', async () => {
  const actual = await vi.importActual('@/components/AppStateProvider');
  return {
    ...actual,
    useAppState: () => ({
      getClaimCampaigns: mockGetClaimCampaigns,
      extractClaim: vi.fn(),
      getPost: vi.fn(),
    }),
  };
});

// Create test campaign with all required fields
const createTestCampaign = (overrides: Partial<Campaign> = {}): Campaign => ({
  id: createCampaignId('campaign-1'),
  title: 'Test Campaign',
  description: 'Test campaign description',
  topics: ['test'],
  sponsor: {
    type: 'community',
    id: createCommunityId('community-sponsor'),
    name: 'Test Sponsor',
  },
  status: 'active',
  fundingAmount: createPUSDAmount(100n),
  escrowId: createEscrowId('escrow-1'),
  fundingTxHash: createTransactionHash('0x' + '1'.repeat(64)),
  payoutMode: 'public',
  deliverables: [],
  contributingPostIds: [],
  createdAt: Date.now(),
  expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  ...overrides,
});

// Create test data
const createTestClaim = (overrides: Partial<Claim> = {}): Claim => ({
  id: createClaimId('test-claim-1'),
  statement: 'Test claim statement for fact-checking',
  sourcePostId: createPostId('test-post-1'),
  status: 'pending',
  extractedBy: createDIMCredential('dim-test-user'),
  createdAt: Date.now(),
  updatedAt: Date.now(),
  evidence: [],
  topics: [],
  ...overrides,
});

const createTestEvidence = (overrides: Partial<ClaimEvidence> = {}): ClaimEvidence => ({
  postId: createPostId('evidence-post-1'),
  supports: true,
  submittedBy: createDIMCredential('dim-evidence-user'),
  submittedAt: Date.now(),
  ...overrides,
});

// Wrapper with all required providers
function TestWrapper({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <ToastProvider>
      <AppStateProvider>
        <CreateBountyProvider>
          <FactCheckConfirmProvider>{children}</FactCheckConfirmProvider>
        </CreateBountyProvider>
      </AppStateProvider>
    </ToastProvider>
  );
}

describe('ClaimSection', () => {
  const testPostId = createPostId('test-post');

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no campaigns
    mockGetClaimCampaigns.mockReturnValue([]);
  });

  describe('rendering', () => {
    it('renders claims count', () => {
      const claims = [createTestClaim(), createTestClaim({ id: createClaimId('claim-2') })];

      render(
        <TestWrapper>
          <ClaimSection claims={claims} postId={testPostId} />
        </TestWrapper>
      );

      expect(screen.getByText('Claims (2)')).toBeInTheDocument();
    });

    it('renders claim statement', () => {
      const claims = [createTestClaim({ statement: 'The sky is blue' })];

      render(
        <TestWrapper>
          <ClaimSection claims={claims} postId={testPostId} />
        </TestWrapper>
      );

      expect(screen.getByText('The sky is blue')).toBeInTheDocument();
    });

    it('renders status badge', () => {
      const claims = [createTestClaim({ status: 'pending' })];

      render(
        <TestWrapper>
          <ClaimSection claims={claims} postId={testPostId} />
        </TestWrapper>
      );

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('renders evidence count when present', () => {
      const claims = [
        createTestClaim({
          evidence: [
            createTestEvidence({ postId: createPostId('evidence-1') }),
            createTestEvidence({ postId: createPostId('evidence-2') }),
          ],
        }),
      ];

      render(
        <TestWrapper>
          <ClaimSection claims={claims} postId={testPostId} />
        </TestWrapper>
      );

      expect(screen.getByText('2 evidence')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('renders empty state when no claims', () => {
      render(
        <TestWrapper>
          <ClaimSection claims={[]} postId={testPostId} />
        </TestWrapper>
      );

      expect(screen.getByText('No claims extracted yet')).toBeInTheDocument();
      expect(screen.getByText(/Extract specific, verifiable statements/)).toBeInTheDocument();
    });
  });

  describe('Fact Check button', () => {
    it('shows Fact Check button for pending claims', () => {
      const claims = [createTestClaim({ status: 'pending' })];

      render(
        <TestWrapper>
          <ClaimSection claims={claims} postId={testPostId} />
        </TestWrapper>
      );

      // Button has aria-label like "Submit for fact-checking: [statement]"
      expect(screen.getByRole('button', { name: /Submit for fact-checking/i })).toBeInTheDocument();
    });

    it('hides Fact Check button for non-pending claims', () => {
      const claims = [createTestClaim({ status: 'under_review' })];

      render(
        <TestWrapper>
          <ClaimSection claims={claims} postId={testPostId} />
        </TestWrapper>
      );

      expect(
        screen.queryByRole('button', { name: /Submit for fact-checking/i })
      ).not.toBeInTheDocument();
    });

    it('has accessible aria-label with truncated statement', () => {
      const longStatement =
        'This is a very long claim statement that exceeds the fifty character limit for aria labels';
      const claims = [createTestClaim({ statement: longStatement })];

      render(
        <TestWrapper>
          <ClaimSection claims={claims} postId={testPostId} />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /Submit for fact-checking/i });
      expect(button).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Submit for fact-checking:')
      );
      // Should be truncated with ellipsis
      expect(button).toHaveAttribute('aria-label', expect.stringContaining('...'));
    });

    it('does not truncate short statements in aria-label', () => {
      const shortStatement = 'Short claim';
      const claims = [createTestClaim({ statement: shortStatement })];

      render(
        <TestWrapper>
          <ClaimSection claims={claims} postId={testPostId} />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /Submit for fact-checking/i });
      expect(button).toHaveAttribute('aria-label', `Submit for fact-checking: ${shortStatement}`);
    });
  });

  describe('Fund Bounty button', () => {
    it('shows Fund Bounty button for all claims', () => {
      const claims = [createTestClaim()];

      render(
        <TestWrapper>
          <ClaimSection claims={claims} postId={testPostId} />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /Fund Bounty/i })).toBeInTheDocument();
    });

    it('has accessible aria-label', () => {
      const claims = [createTestClaim({ statement: 'Test statement' })];

      render(
        <TestWrapper>
          <ClaimSection claims={claims} postId={testPostId} />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /Fund bounty for/i });
      expect(button).toHaveAttribute('aria-label', 'Fund bounty for: Test statement');
    });
  });

  describe('Extract claim button', () => {
    it('shows extract claim button in header', () => {
      render(
        <TestWrapper>
          <ClaimSection claims={[]} postId={testPostId} />
        </TestWrapper>
      );

      expect(screen.getByText('+ Extract claim')).toBeInTheDocument();
    });
  });

  describe('status display', () => {
    const statusCases: Array<{ status: Claim['status']; label: string }> = [
      { status: 'pending', label: 'Pending' },
      { status: 'under_review', label: 'Under Review' },
      { status: 'verified', label: 'Verified' },
      { status: 'disputed', label: 'Disputed' },
      { status: 'false', label: 'False' },
      { status: 'unverifiable', label: 'Unverifiable' },
    ];

    statusCases.forEach(({ status, label }) => {
      it(`renders ${status} status as "${label}"`, () => {
        const claims = [createTestClaim({ status })];

        render(
          <TestWrapper>
            <ClaimSection claims={claims} postId={testPostId} />
          </TestWrapper>
        );

        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });
  });

  describe('verdict display', () => {
    it('renders verdict reasoning when present', () => {
      const claims = [
        createTestClaim({
          status: 'verified',
          verdict: {
            status: 'verified',
            collectiveId: createCollectiveId('collective-1'),
            reasoning: 'This claim was verified by multiple sources.',
            issuedAt: Date.now(),
          },
        }),
      ];

      render(
        <TestWrapper>
          <ClaimSection claims={claims} postId={testPostId} />
        </TestWrapper>
      );

      expect(screen.getByText('Verdict reasoning:')).toBeInTheDocument();
      expect(screen.getByText('This claim was verified by multiple sources.')).toBeInTheDocument();
    });

    it('does not render verdict section when no verdict', () => {
      const claims = [createTestClaim()];

      render(
        <TestWrapper>
          <ClaimSection claims={claims} postId={testPostId} />
        </TestWrapper>
      );

      expect(screen.queryByText('Verdict reasoning:')).not.toBeInTheDocument();
    });
  });

  describe('bounty status', () => {
    it('shows awaiting message when no campaigns', () => {
      mockGetClaimCampaigns.mockReturnValue([]);
      const claims = [createTestClaim()];

      render(
        <TestWrapper>
          <ClaimSection claims={claims} postId={testPostId} />
        </TestWrapper>
      );

      expect(
        screen.getByText(/Awaiting fact-check — fund a bounty to prioritize/)
      ).toBeInTheDocument();
    });

    it('shows "Bounty funded" with amount when campaign is active', () => {
      const campaign = createTestCampaign({
        status: 'active',
        fundingAmount: createPUSDAmount(500n),
      });
      mockGetClaimCampaigns.mockReturnValue([campaign]);

      const claims = [createTestClaim()];

      render(
        <TestWrapper>
          <ClaimSection claims={claims} postId={testPostId} />
        </TestWrapper>
      );

      expect(screen.getByText('Bounty funded')).toBeInTheDocument();
    });

    it('shows "Under collective review" when campaign is assigned to collective', () => {
      const campaign = createTestCampaign({
        status: 'active',
        fundingAmount: createPUSDAmount(1000n),
        assignedCollectiveId: createCollectiveId('collective-1'),
      });
      mockGetClaimCampaigns.mockReturnValue([campaign]);

      const claims = [createTestClaim()];

      render(
        <TestWrapper>
          <ClaimSection claims={claims} postId={testPostId} />
        </TestWrapper>
      );

      expect(screen.getByText('Under collective review')).toBeInTheDocument();
    });

    it('shows awaiting message when all campaigns are inactive', () => {
      const campaign = createTestCampaign({
        status: 'completed',
      });
      mockGetClaimCampaigns.mockReturnValue([campaign]);

      const claims = [createTestClaim()];

      render(
        <TestWrapper>
          <ClaimSection claims={claims} postId={testPostId} />
        </TestWrapper>
      );

      expect(
        screen.getByText(/Awaiting fact-check — fund a bounty to prioritize/)
      ).toBeInTheDocument();
    });
  });
});
