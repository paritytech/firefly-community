import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClaimCard } from './ClaimCard';
import type { ClaimPreview, PostId } from '@cocuyo/types';

const createMockClaim = (overrides: Partial<ClaimPreview> = {}): ClaimPreview => ({
  id: 'claim-123' as ClaimPreview['id'],
  statement: 'This is a test claim statement for testing purposes.',
  sourcePostId: 'post-456' as PostId,
  status: 'pending',
  topics: ['politics', 'local-news'],
  evidenceCount: 4,
  supportingCount: 3,
  contradictingCount: 1,
  createdAt: Date.now() - 3600000, // 1 hour ago
  ...overrides,
});

describe('ClaimCard', () => {
  describe('rendering', () => {
    it('renders claim statement', () => {
      const claim = createMockClaim({ statement: 'Test claim' });
      render(<ClaimCard claim={claim} />);
      // Statement is wrapped in curly quotes
      expect(screen.getByText(/Test claim/)).toBeInTheDocument();
    });

    it('renders status badge', () => {
      const claim = createMockClaim({ status: 'verified' });
      render(<ClaimCard claim={claim} />);
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('renders topics', () => {
      const claim = createMockClaim({ topics: ['climate', 'environment'] });
      render(<ClaimCard claim={claim} />);
      expect(screen.getByText('climate')).toBeInTheDocument();
      expect(screen.getByText('environment')).toBeInTheDocument();
    });

    it('renders supporting count', () => {
      const claim = createMockClaim({ supportingCount: 5 });
      render(<ClaimCard claim={claim} />);
      expect(screen.getByText('+5')).toBeInTheDocument();
      expect(screen.getByText('supporting')).toBeInTheDocument();
    });

    it('renders contradicting count', () => {
      const claim = createMockClaim({ contradictingCount: 2 });
      render(<ClaimCard claim={claim} />);
      expect(screen.getByText('-2')).toBeInTheDocument();
      expect(screen.getByText('contradicting')).toBeInTheDocument();
    });

    it('shows no evidence message when counts are 0', () => {
      const claim = createMockClaim({ supportingCount: 0, contradictingCount: 0 });
      render(<ClaimCard claim={claim} />);
      expect(screen.getByText('No evidence yet')).toBeInTheDocument();
    });

    it('does not render topics section when empty', () => {
      const claim = createMockClaim({ topics: [] });
      const { container } = render(<ClaimCard claim={claim} />);
      // No topic spans should exist (checking for topic class pattern)
      const topicSpans = container.querySelectorAll('.bg-\\[var\\(--bg-surface-container\\)\\]');
      expect(topicSpans.length).toBe(0);
    });
  });

  describe('relative time formatting', () => {
    it('shows "just now" for very recent claims', () => {
      const claim = createMockClaim({ createdAt: Date.now() - 30000 });
      render(<ClaimCard claim={claim} />);
      expect(screen.getByText('just now')).toBeInTheDocument();
    });

    it('shows minutes ago', () => {
      const claim = createMockClaim({ createdAt: Date.now() - 300000 });
      render(<ClaimCard claim={claim} />);
      expect(screen.getByText('5m ago')).toBeInTheDocument();
    });

    it('shows hours ago', () => {
      const claim = createMockClaim({ createdAt: Date.now() - 7200000 });
      render(<ClaimCard claim={claim} />);
      expect(screen.getByText('2h ago')).toBeInTheDocument();
    });

    it('shows days ago', () => {
      const claim = createMockClaim({ createdAt: Date.now() - 172800000 });
      render(<ClaimCard claim={claim} />);
      expect(screen.getByText('2d ago')).toBeInTheDocument();
    });

    it('shows date for old claims', () => {
      const oldDate = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
      const claim = createMockClaim({ createdAt: oldDate });
      render(<ClaimCard claim={claim} />);
      // Should show a date string
      const dateRegex = /\d{1,2}\/\d{1,2}\/\d{4}/;
      const timeElement = screen.getByText(dateRegex);
      expect(timeElement).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onClick when clicked', () => {
      const onClick = vi.fn();
      const claim = createMockClaim();
      render(<ClaimCard claim={claim} onClick={onClick} />);

      fireEvent.click(screen.getByRole('button'));

      expect(onClick).toHaveBeenCalledWith(claim.id);
    });

    it('has button role when clickable', () => {
      render(<ClaimCard claim={createMockClaim()} onClick={vi.fn()} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('handles Enter key press', () => {
      const onClick = vi.fn();
      const claim = createMockClaim();
      render(<ClaimCard claim={claim} onClick={onClick} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });

      expect(onClick).toHaveBeenCalledWith(claim.id);
    });

    it('handles Space key press', () => {
      const onClick = vi.fn();
      const claim = createMockClaim();
      render(<ClaimCard claim={claim} onClick={onClick} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });

      expect(onClick).toHaveBeenCalledWith(claim.id);
    });
  });

  describe('translations', () => {
    it('uses custom translation strings', () => {
      const claim = createMockClaim({ supportingCount: 1, contradictingCount: 1 });
      render(
        <ClaimCard
          claim={claim}
          translations={{
            supporting: 'Unterstützend',
            contradicting: 'Widersprechend',
            evidence: 'Beweise',
            viewClaim: 'Anspruch anzeigen',
            statusPending: 'Ausstehend',
            statusUnderReview: 'In Prüfung',
            statusVerified: 'Verifiziert',
            statusDisputed: 'Umstritten',
            statusFalse: 'Falsch',
            statusUnverifiable: 'Nicht überprüfbar',
          }}
        />
      );
      expect(screen.getByText('Unterstützend')).toBeInTheDocument();
      expect(screen.getByText('Widersprechend')).toBeInTheDocument();
    });

    it('passes status translations to badge', () => {
      const claim = createMockClaim({ status: 'verified' });
      render(
        <ClaimCard
          claim={claim}
          translations={{
            supporting: 'Unterstützend',
            contradicting: 'Widersprechend',
            evidence: 'Beweise',
            viewClaim: 'Anspruch anzeigen',
            statusPending: 'Ausstehend',
            statusUnderReview: 'In Prüfung',
            statusVerified: 'Bestätigt',
            statusDisputed: 'Umstritten',
            statusFalse: 'Falsch',
            statusUnverifiable: 'Nicht überprüfbar',
          }}
        />
      );
      expect(screen.getByText('Bestätigt')).toBeInTheDocument();
    });

    it('uses topic translations', () => {
      const claim = createMockClaim({ topics: ['local-news'] });
      render(
        <ClaimCard claim={claim} topicTranslations={{ 'local-news': 'Lokale Nachrichten' }} />
      );
      expect(screen.getByText('Lokale Nachrichten')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has aria-label with claim statement', () => {
      const claim = createMockClaim({ statement: 'Important claim' });
      render(<ClaimCard claim={claim} onClick={vi.fn()} />);
      expect(screen.getByLabelText('Claim: Important claim')).toBeInTheDocument();
    });
  });
});
