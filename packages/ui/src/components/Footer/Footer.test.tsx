import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';

describe('Footer', () => {
  describe('rendering', () => {
    it('renders footer element with contentinfo role', () => {
      render(<Footer />);
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });

    it('renders default "Built on Polkadot" text', () => {
      render(<Footer />);
      expect(screen.getByText('Built on Polkadot')).toBeInTheDocument();
    });

    it('renders default tagline', () => {
      render(<Footer />);
      expect(screen.getByText('Lights in the dark.')).toBeInTheDocument();
    });

    it('does not render a copyright line by default', () => {
      render(<Footer />);
      expect(screen.queryByText(/©/)).not.toBeInTheDocument();
    });

    it('renders the year alongside a provided copyright', () => {
      const currentYear = new Date().getFullYear();
      render(<Footer labels={{ copyright: 'Example Corp' }} />);
      expect(screen.getByText(new RegExp(`${currentYear}`))).toBeInTheDocument();
    });
  });

  describe('customization', () => {
    it('renders custom year with a provided copyright', () => {
      render(<Footer year={2020} labels={{ copyright: 'Example Corp' }} />);
      expect(screen.getByText(/2020/)).toBeInTheDocument();
    });

    it('renders custom labels', () => {
      render(
        <Footer
          labels={{
            builtOn: 'Powered by Polkadot',
            tagline: 'Custom tagline',
            copyright: 'Custom Corp',
          }}
        />
      );
      expect(screen.getByText('Powered by Polkadot')).toBeInTheDocument();
      expect(screen.getByText('Custom tagline')).toBeInTheDocument();
      expect(screen.getByText(/Custom Corp/)).toBeInTheDocument();
    });

    it('renders partial custom labels with defaults for missing, and no copyright when omitted', () => {
      render(<Footer labels={{ tagline: 'My tagline' }} />);
      expect(screen.getByText('Built on Polkadot')).toBeInTheDocument();
      expect(screen.getByText('My tagline')).toBeInTheDocument();
      expect(screen.queryByText(/©/)).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has Polkadot dot indicator hidden from screen readers', () => {
      render(<Footer />);
      const hiddenElements = document.querySelectorAll('[aria-hidden="true"]');
      expect(hiddenElements.length).toBeGreaterThan(0);
    });
  });
});
