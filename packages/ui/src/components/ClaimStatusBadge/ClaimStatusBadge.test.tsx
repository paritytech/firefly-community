import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClaimStatusBadge } from './ClaimStatusBadge';

describe('ClaimStatusBadge', () => {
  describe('status rendering', () => {
    it('renders pending status', () => {
      render(<ClaimStatusBadge status="pending" />);
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('○')).toBeInTheDocument();
    });

    it('renders under_review status', () => {
      render(<ClaimStatusBadge status="under_review" />);
      expect(screen.getByText('Under Review')).toBeInTheDocument();
      expect(screen.getByText('◐')).toBeInTheDocument();
    });

    it('renders verified status', () => {
      render(<ClaimStatusBadge status="verified" />);
      expect(screen.getByText('Verified')).toBeInTheDocument();
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('renders disputed status', () => {
      render(<ClaimStatusBadge status="disputed" />);
      expect(screen.getByText('Disputed')).toBeInTheDocument();
      expect(screen.getByText('⚡')).toBeInTheDocument();
    });

    it('renders false status', () => {
      render(<ClaimStatusBadge status="false" />);
      expect(screen.getByText('False')).toBeInTheDocument();
      expect(screen.getByText('✕')).toBeInTheDocument();
    });

    it('renders unverifiable status', () => {
      render(<ClaimStatusBadge status="unverifiable" />);
      expect(screen.getByText('Unverifiable')).toBeInTheDocument();
      expect(screen.getByText('?')).toBeInTheDocument();
    });
  });

  describe('label visibility', () => {
    it('shows label by default', () => {
      render(<ClaimStatusBadge status="verified" />);
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('hides label when showLabel is false', () => {
      render(<ClaimStatusBadge status="verified" showLabel={false} />);
      expect(screen.queryByText('Verified')).not.toBeInTheDocument();
      // Icon should still be visible
      expect(screen.getByText('✓')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('renders small size by default', () => {
      const { container } = render(<ClaimStatusBadge status="pending" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('text-xs', 'px-1.5', 'py-0.5');
    });

    it('renders medium size', () => {
      const { container } = render(<ClaimStatusBadge status="pending" size="md" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('text-sm', 'px-2', 'py-1');
    });
  });

  describe('translations', () => {
    it('uses custom translations', () => {
      render(
        <ClaimStatusBadge
          status="verified"
          translations={{
            pending: 'Ausstehend',
            under_review: 'In Prüfung',
            verified: 'Verifiziert',
            disputed: 'Umstritten',
            false: 'Falsch',
            unverifiable: 'Nicht überprüfbar',
          }}
        />
      );
      expect(screen.getByText('Verifiziert')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has aria-label with status', () => {
      render(<ClaimStatusBadge status="verified" />);
      expect(screen.getByLabelText('Claim status: Verified')).toBeInTheDocument();
    });

    it('has title attribute', () => {
      const { container } = render(<ClaimStatusBadge status="pending" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveAttribute('title', 'Pending');
    });

    it('icon is hidden from screen readers', () => {
      render(<ClaimStatusBadge status="verified" />);
      const icon = screen.getByText('✓');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('styling', () => {
    it('has inline-flex display', () => {
      const { container } = render(<ClaimStatusBadge status="pending" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('inline-flex');
    });

    it('has rounded-full border', () => {
      const { container } = render(<ClaimStatusBadge status="pending" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('rounded-full');
    });
  });
});
