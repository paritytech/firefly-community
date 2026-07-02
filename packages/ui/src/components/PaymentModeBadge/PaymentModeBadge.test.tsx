import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentModeBadge } from './PaymentModeBadge';

describe('PaymentModeBadge', () => {
  describe('public mode', () => {
    it('renders public mode with dollar icon', () => {
      render(<PaymentModeBadge mode="public" />);
      expect(screen.getByText('$')).toBeInTheDocument();
    });

    it('renders default public label', () => {
      render(<PaymentModeBadge mode="public" />);
      expect(screen.getByText('Public pUSD')).toBeInTheDocument();
    });

    it('has correct aria-label for public mode', () => {
      render(<PaymentModeBadge mode="public" />);
      expect(screen.getByLabelText('Payment mode: Public pUSD')).toBeInTheDocument();
    });
  });

  describe('private mode', () => {
    it('renders private mode with shield icon', () => {
      render(<PaymentModeBadge mode="private" />);
      expect(screen.getByText('⛨')).toBeInTheDocument();
    });

    it('renders default private label', () => {
      render(<PaymentModeBadge mode="private" />);
      expect(screen.getByText('Private')).toBeInTheDocument();
    });

    it('has correct aria-label for private mode', () => {
      render(<PaymentModeBadge mode="private" />);
      expect(screen.getByLabelText('Payment mode: Private')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('renders small size by default', () => {
      const { container } = render(<PaymentModeBadge mode="public" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('text-xs', 'px-1.5', 'py-0.5');
    });

    it('renders medium size', () => {
      const { container } = render(<PaymentModeBadge mode="public" size="md" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('text-sm', 'px-2', 'py-1');
    });
  });

  describe('translations', () => {
    it('uses custom translation for public mode', () => {
      render(
        <PaymentModeBadge
          mode="public"
          translations={{ public: 'Öffentlich', private: 'Privat' }}
        />
      );
      expect(screen.getByText('Öffentlich')).toBeInTheDocument();
    });

    it('uses custom translation for private mode', () => {
      render(
        <PaymentModeBadge
          mode="private"
          translations={{ public: 'Öffentlich', private: 'Privat' }}
        />
      );
      expect(screen.getByText('Privat')).toBeInTheDocument();
    });

    it('updates aria-label with translation', () => {
      render(
        <PaymentModeBadge
          mode="public"
          translations={{ public: 'Transparent', private: 'Hidden' }}
        />
      );
      expect(screen.getByLabelText('Payment mode: Transparent')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('has inline-flex display', () => {
      const { container } = render(<PaymentModeBadge mode="public" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('inline-flex');
    });

    it('has rounded-full border', () => {
      const { container } = render(<PaymentModeBadge mode="public" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('rounded-full');
    });

    it('has title attribute', () => {
      const { container } = render(<PaymentModeBadge mode="public" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveAttribute('title', 'Public pUSD');
    });
  });

  describe('accessibility', () => {
    it('icon is hidden from screen readers', () => {
      render(<PaymentModeBadge mode="public" />);
      const icon = screen.getByText('$');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
