import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PersonhoodBadge } from './PersonhoodBadge';

describe('PersonhoodBadge', () => {
  describe('rendering', () => {
    it('shows full verification with filled diamond', () => {
      render(<PersonhoodBadge level="full" showLabel />);
      expect(screen.getByText('◆')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('shows lite verification with hollow diamond', () => {
      render(<PersonhoodBadge level="lite" showLabel />);
      expect(screen.getByText('◇')).toBeInTheDocument();
      expect(screen.getByText('Lite')).toBeInTheDocument();
    });

    it('shows none level with circle when showLabel is true', () => {
      render(<PersonhoodBadge level="none" showLabel />);
      expect(screen.getByText('○')).toBeInTheDocument();
      expect(screen.getByText('Unverified')).toBeInTheDocument();
    });
  });

  describe('unverified behavior', () => {
    it('hides badge for none level without showLabel', () => {
      render(<PersonhoodBadge level="none" />);
      expect(screen.getByText('Unverified identity')).toHaveClass('sr-only');
    });

    it('shows badge for none level with showLabel', () => {
      render(<PersonhoodBadge level="none" showLabel />);
      expect(screen.getByText('Unverified')).toBeInTheDocument();
    });
  });

  describe('label visibility', () => {
    it('hides label by default', () => {
      render(<PersonhoodBadge level="full" />);
      expect(screen.getByText('◆')).toBeInTheDocument();
      expect(screen.queryByText('Verified')).not.toBeInTheDocument();
    });

    it('shows label when showLabel is true', () => {
      render(<PersonhoodBadge level="full" showLabel />);
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('uses small size by default', () => {
      render(<PersonhoodBadge level="full" showLabel />);
      const badge = screen.getByLabelText('DIM Verified');
      expect(badge).toHaveClass('text-xs');
    });

    it('supports medium size', () => {
      render(<PersonhoodBadge level="full" size="md" showLabel />);
      const badge = screen.getByLabelText('DIM Verified');
      expect(badge).toHaveClass('text-sm');
    });
  });

  describe('accessibility', () => {
    it('has appropriate aria-label for full level', () => {
      render(<PersonhoodBadge level="full" />);
      expect(screen.getByLabelText('DIM Verified')).toBeInTheDocument();
    });

    it('has appropriate aria-label for lite level', () => {
      render(<PersonhoodBadge level="lite" />);
      expect(screen.getByLabelText('DIM Lite')).toBeInTheDocument();
    });

    it('has title attribute', () => {
      render(<PersonhoodBadge level="full" />);
      expect(screen.getByTitle('DIM Verified')).toBeInTheDocument();
    });
  });
});
