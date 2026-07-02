import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FireflySymbol } from './FireflySymbol';

describe('FireflySymbol', () => {
  describe('rendering', () => {
    it('renders the firefly character', () => {
      render(<FireflySymbol />);
      expect(screen.getByRole('img')).toHaveTextContent('✦');
    });

    it('has default aria-label', () => {
      render(<FireflySymbol />);
      expect(screen.getByLabelText('Firefly')).toBeInTheDocument();
    });

    it('accepts custom aria-label', () => {
      render(<FireflySymbol aria-label="Signal light" />);
      expect(screen.getByLabelText('Signal light')).toBeInTheDocument();
    });
  });

  describe('sizing', () => {
    it('uses default size of 16px', () => {
      render(<FireflySymbol />);
      expect(screen.getByRole('img')).toHaveStyle({ fontSize: '16px' });
    });

    it('accepts numeric size', () => {
      render(<FireflySymbol size={24} />);
      expect(screen.getByRole('img')).toHaveStyle({ fontSize: '24px' });
    });

    it('accepts string size', () => {
      render(<FireflySymbol size="2rem" />);
      expect(screen.getByRole('img')).toHaveStyle({ fontSize: '2rem' });
    });
  });

  describe('colors', () => {
    it('uses gold color by default', () => {
      render(<FireflySymbol />);
      expect(screen.getByRole('img')).toHaveStyle({ color: 'var(--color-accent)' });
    });

    it('accepts white color', () => {
      render(<FireflySymbol color="white" />);
      expect(screen.getByRole('img')).toHaveStyle({ color: 'var(--color-text-primary)' });
    });

    it('accepts inherit color', () => {
      render(<FireflySymbol color="inherit" />);
      expect(screen.getByRole('img')).toHaveStyle({ color: 'inherit' });
    });
  });

  describe('accessibility', () => {
    it('has role="img"', () => {
      render(<FireflySymbol />);
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('accepts custom className', () => {
      render(<FireflySymbol className="custom-class" />);
      expect(screen.getByRole('img')).toHaveClass('custom-class');
    });
  });
});
