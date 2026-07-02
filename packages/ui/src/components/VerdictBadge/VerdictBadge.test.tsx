import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerdictBadge } from './VerdictBadge';

describe('VerdictBadge', () => {
  describe('rendering', () => {
    it('renders with confirmed status', () => {
      render(<VerdictBadge status="confirmed" />);
      expect(screen.getByText('Verified')).toBeInTheDocument();
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('renders with disputed status', () => {
      render(<VerdictBadge status="disputed" />);
      expect(screen.getByText('Disputed')).toBeInTheDocument();
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('renders with false status', () => {
      render(<VerdictBadge status="false" />);
      expect(screen.getByText('False')).toBeInTheDocument();
      expect(screen.getByText('✗')).toBeInTheDocument();
    });

    it('renders with synthetic status', () => {
      render(<VerdictBadge status="synthetic" />);
      expect(screen.getByText('Synthetic')).toBeInTheDocument();
      expect(screen.getByText('⚡')).toBeInTheDocument();
    });

    it('renders with inconclusive status', () => {
      render(<VerdictBadge status="inconclusive" />);
      expect(screen.getByText('Inconclusive')).toBeInTheDocument();
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('label visibility', () => {
    it('shows label by default', () => {
      render(<VerdictBadge status="confirmed" />);
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('hides label when showLabel is false', () => {
      render(<VerdictBadge status="confirmed" showLabel={false} />);
      expect(screen.queryByText('Verified')).not.toBeInTheDocument();
      // Icon should still be visible
      expect(screen.getByText('✓')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('renders medium size by default', () => {
      const { container } = render(<VerdictBadge status="confirmed" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('text-sm', 'px-2', 'py-1');
    });

    it('renders small size', () => {
      const { container } = render(<VerdictBadge status="confirmed" size="sm" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('text-xs', 'px-1.5', 'py-0.5');
    });
  });

  describe('styling', () => {
    it('has inline-flex display', () => {
      const { container } = render(<VerdictBadge status="confirmed" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('inline-flex');
    });

    it('has rounded-full border', () => {
      const { container } = render(<VerdictBadge status="confirmed" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('rounded-full', 'border');
    });

    it('applies custom styles for confirmed status', () => {
      const { container } = render(<VerdictBadge status="confirmed" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveStyle({ backgroundColor: 'var(--color-firefly-gold)' });
    });
  });

  describe('accessibility', () => {
    it('icon is hidden from screen readers', () => {
      render(<VerdictBadge status="confirmed" />);
      const icon = screen.getByText('✓');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
