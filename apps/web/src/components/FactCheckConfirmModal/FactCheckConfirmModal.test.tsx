/**
 * Tests for FactCheckConfirmModal component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FactCheckConfirmModal } from './FactCheckConfirmModal';
import { FactCheckConfirmProvider, useFactCheckConfirm } from './FactCheckConfirmProvider';
import type { Claim } from '@cocuyo/types';
import { createClaimId, createPostId, createDIMCredential } from '@cocuyo/types';

// Mock AppStateProvider context
const mockGetClaim = vi.fn();
const mockSubmitClaimForFactCheck = vi.fn();

vi.mock('@/components/AppStateProvider', () => ({
  useAppState: () => ({
    getClaim: mockGetClaim,
    submitClaimForFactCheck: mockSubmitClaimForFactCheck,
  }),
}));

// Test helper to open modal with a claim
function TestOpener({ claimId }: { claimId: string }): React.ReactElement {
  const { openModal } = useFactCheckConfirm();
  return (
    <button onClick={() => openModal(createClaimId(claimId))} data-testid="open-modal">
      Open Modal
    </button>
  );
}

// Wrapper with FactCheckConfirmProvider only (AppStateProvider is mocked)
function TestWrapper({ children }: { children: ReactNode }): React.ReactElement {
  return <FactCheckConfirmProvider>{children}</FactCheckConfirmProvider>;
}

// Create a test claim
const testClaim: Claim = {
  id: createClaimId('test-claim-1'),
  sourcePostId: createPostId('test-post'),
  statement: 'This is a test claim statement',
  status: 'pending',
  extractedBy: createDIMCredential('dim-test-user'),
  createdAt: Date.now(),
  updatedAt: Date.now(),
  evidence: [],
  topics: [],
};

describe('FactCheckConfirmModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClaim.mockReturnValue(testClaim);
    mockSubmitClaimForFactCheck.mockReturnValue(true);
  });

  describe('rendering', () => {
    it('does not render when closed', () => {
      render(
        <TestWrapper>
          <FactCheckConfirmModal />
        </TestWrapper>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders when opened', async () => {
      render(
        <TestWrapper>
          <TestOpener claimId="test-claim-1" />
          <FactCheckConfirmModal />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('open-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('displays modal title', async () => {
      render(
        <TestWrapper>
          <TestOpener claimId="test-claim-1" />
          <FactCheckConfirmModal />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('open-modal'));

      await waitFor(() => {
        expect(screen.getByText('Submit for Fact-Checking')).toBeInTheDocument();
      });
    });

    it('displays claim statement in preview', async () => {
      render(
        <TestWrapper>
          <TestOpener claimId="test-claim-1" />
          <FactCheckConfirmModal />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('open-modal'));

      await waitFor(() => {
        expect(screen.getByText('This is a test claim statement')).toBeInTheDocument();
      });
    });

    it('displays cancel and submit buttons', async () => {
      render(
        <TestWrapper>
          <TestOpener claimId="test-claim-1" />
          <FactCheckConfirmModal />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('open-modal'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Submit for Fact-Check' })).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA attributes', async () => {
      render(
        <TestWrapper>
          <TestOpener claimId="test-claim-1" />
          <FactCheckConfirmModal />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('open-modal'));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-labelledby', 'fact-check-confirm-title');
      });
    });

    it('closes on Escape key', async () => {
      render(
        <TestWrapper>
          <TestOpener claimId="test-claim-1" />
          <FactCheckConfirmModal />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('open-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('cancel button', () => {
    it('closes modal when clicked', async () => {
      render(
        <TestWrapper>
          <TestOpener claimId="test-claim-1" />
          <FactCheckConfirmModal />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('open-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('modal content click', () => {
    it('does not close when clicking modal content', async () => {
      render(
        <TestWrapper>
          <TestOpener claimId="test-claim-1" />
          <FactCheckConfirmModal />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('open-modal'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click inside the modal content (the title)
      fireEvent.click(screen.getByText('Submit for Fact-Checking'));

      // Modal should still be open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('submit flow', () => {
    it('calls submitClaimForFactCheck on submit', async () => {
      render(
        <TestWrapper>
          <TestOpener claimId="test-claim-1" />
          <FactCheckConfirmModal />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('open-modal'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Submit for Fact-Check' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Submit for Fact-Check' }));

      expect(mockSubmitClaimForFactCheck).toHaveBeenCalledWith(createClaimId('test-claim-1'));
    });

    it('shows success message after submit', async () => {
      render(
        <TestWrapper>
          <TestOpener claimId="test-claim-1" />
          <FactCheckConfirmModal />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('open-modal'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Submit for Fact-Check' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Submit for Fact-Check' }));

      await waitFor(() => {
        expect(screen.getByText('Claim submitted for fact-checking!')).toBeInTheDocument();
      });
    });

    it('hides action buttons after success', async () => {
      render(
        <TestWrapper>
          <TestOpener claimId="test-claim-1" />
          <FactCheckConfirmModal />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('open-modal'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Submit for Fact-Check' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Submit for Fact-Check' }));

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: 'Submit for Fact-Check' })
        ).not.toBeInTheDocument();
      });
    });

    it('has accessible success message with role=status', async () => {
      render(
        <TestWrapper>
          <TestOpener claimId="test-claim-1" />
          <FactCheckConfirmModal />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('open-modal'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Submit for Fact-Check' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Submit for Fact-Check' }));

      await waitFor(() => {
        const successMessage = screen.getByRole('status');
        expect(successMessage).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('blocks Escape key during success state', async () => {
      render(
        <TestWrapper>
          <TestOpener claimId="test-claim-1" />
          <FactCheckConfirmModal />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('open-modal'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Submit for Fact-Check' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Submit for Fact-Check' }));

      await waitFor(() => {
        expect(screen.getByText('Claim submitted for fact-checking!')).toBeInTheDocument();
      });

      // Try to close with Escape during success
      fireEvent.keyDown(document, { key: 'Escape' });

      // Modal should still be showing success (not closed)
      expect(screen.getByText('Claim submitted for fact-checking!')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('shows error message when submit fails', async () => {
      mockSubmitClaimForFactCheck.mockReturnValue(false);

      render(
        <TestWrapper>
          <TestOpener claimId="test-claim-1" />
          <FactCheckConfirmModal />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('open-modal'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Submit for Fact-Check' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Submit for Fact-Check' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/Failed to submit claim/)).toBeInTheDocument();
      });
    });

    it('keeps modal open on error', async () => {
      mockSubmitClaimForFactCheck.mockReturnValue(false);

      render(
        <TestWrapper>
          <TestOpener claimId="test-claim-1" />
          <FactCheckConfirmModal />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('open-modal'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Submit for Fact-Check' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Submit for Fact-Check' }));

      // Modal should still be open with buttons visible
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit for Fact-Check' })).toBeInTheDocument();
    });
  });

  describe('timeout cleanup', () => {
    it('cleans up auto-close timeout on unmount', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { unmount } = render(
        <TestWrapper>
          <TestOpener claimId="test-claim-1" />
          <FactCheckConfirmModal />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('open-modal'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Submit for Fact-Check' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Submit for Fact-Check' }));

      await waitFor(() => {
        expect(screen.getByText('Claim submitted for fact-checking!')).toBeInTheDocument();
      });

      // Unmount before auto-close completes
      unmount();

      // Should have cleared timeout on unmount
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });
});
