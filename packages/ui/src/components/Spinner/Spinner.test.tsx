import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  describe('rendering', () => {
    it('renders with status role', () => {
      render(<Spinner />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders as SVG element', () => {
      render(<Spinner />);
      const spinner = screen.getByRole('status');
      expect(spinner.tagName).toBe('svg');
    });

    it('has default "Loading" aria-label', () => {
      render(<Spinner />);
      expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('renders small size', () => {
      render(<Spinner size="sm" />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('w-4', 'h-4');
    });

    it('renders medium size by default', () => {
      render(<Spinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('w-6', 'h-6');
    });

    it('renders large size', () => {
      render(<Spinner size="lg" />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('w-8', 'h-8');
    });
  });

  describe('colors', () => {
    it('renders primary color by default', () => {
      render(<Spinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('text-[var(--fg-primary)]');
    });

    it('renders accent color', () => {
      render(<Spinner color="accent" />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('text-[var(--fg-accent)]');
    });

    it('renders inherit color', () => {
      render(<Spinner color="inherit" />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('text-current');
    });
  });

  describe('accessibility', () => {
    it('supports custom label', () => {
      render(<Spinner label="Processing" />);
      expect(screen.getByLabelText('Processing')).toBeInTheDocument();
    });

    it('has animate-spin class for animation', () => {
      render(<Spinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveClass('animate-spin');
    });
  });
});
