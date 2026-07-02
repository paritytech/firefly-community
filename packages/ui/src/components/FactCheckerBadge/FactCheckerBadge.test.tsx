import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FactCheckerBadge } from './FactCheckerBadge';

describe('FactCheckerBadge', () => {
  describe('status rendering', () => {
    it('renders verified status', () => {
      render(<FactCheckerBadge status="verified" />);
      expect(screen.getByText('Verified Fact-Checker')).toBeInTheDocument();
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('renders suspended status', () => {
      render(<FactCheckerBadge status="suspended" />);
      expect(screen.getByText('Suspended')).toBeInTheDocument();
      expect(screen.getByText('⊘')).toBeInTheDocument();
    });

    it('returns null for none status', () => {
      const { container } = render(<FactCheckerBadge status="none" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('sizes', () => {
    it('renders small size by default', () => {
      const { container } = render(<FactCheckerBadge status="verified" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('text-xs', 'px-2', 'py-0.5');
    });

    it('renders medium size', () => {
      const { container } = render(<FactCheckerBadge status="verified" size="md" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('text-sm', 'px-2.5', 'py-1');
    });
  });

  describe('custom labels', () => {
    it('uses custom labels for verified', () => {
      render(
        <FactCheckerBadge
          status="verified"
          labels={{
            verified: 'Geprüfter Faktenprüfer',
            suspended: 'Gesperrt',
          }}
        />
      );
      expect(screen.getByText('Geprüfter Faktenprüfer')).toBeInTheDocument();
    });

    it('uses custom labels for suspended', () => {
      render(
        <FactCheckerBadge
          status="suspended"
          labels={{
            verified: 'Geprüfter Faktenprüfer',
            suspended: 'Gesperrt',
          }}
        />
      );
      expect(screen.getByText('Gesperrt')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has aria-label for verified status', () => {
      render(<FactCheckerBadge status="verified" />);
      expect(screen.getByLabelText('Verified Fact-Checker')).toBeInTheDocument();
    });

    it('has aria-label for suspended status', () => {
      render(<FactCheckerBadge status="suspended" />);
      expect(screen.getByLabelText('Suspended')).toBeInTheDocument();
    });

    it('has title attribute', () => {
      const { container } = render(<FactCheckerBadge status="verified" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveAttribute('title', 'Verified Fact-Checker');
    });

    it('icon is hidden from screen readers', () => {
      render(<FactCheckerBadge status="verified" />);
      const icon = screen.getByText('✓');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('styling', () => {
    it('has inline-flex display', () => {
      const { container } = render(<FactCheckerBadge status="verified" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('inline-flex');
    });

    it('has rounded-full border', () => {
      const { container } = render(<FactCheckerBadge status="verified" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('rounded-full');
    });

    it('verified has gold coloring', () => {
      const { container } = render(<FactCheckerBadge status="verified" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('text-[var(--color-firefly-gold)]');
    });

    it('suspended has error coloring', () => {
      const { container } = render(<FactCheckerBadge status="suspended" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('text-[var(--fg-error)]');
    });
  });
});
