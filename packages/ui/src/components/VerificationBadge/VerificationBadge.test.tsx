import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerificationBadge } from './VerificationBadge';

describe('VerificationBadge', () => {
  describe('rendering', () => {
    it('shows verified status with checkmark', () => {
      render(<VerificationBadge status="verified" showLabel />);
      expect(screen.getByText('✓')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('shows disputed status with exclamation', () => {
      render(<VerificationBadge status="disputed" showLabel />);
      expect(screen.getByText('!')).toBeInTheDocument();
      expect(screen.getByText('Disputed')).toBeInTheDocument();
    });

    it('shows false status with X', () => {
      render(<VerificationBadge status="false" showLabel />);
      expect(screen.getByText('✕')).toBeInTheDocument();
      expect(screen.getByText('False')).toBeInTheDocument();
    });

    it('shows synthetic status with lightning', () => {
      render(<VerificationBadge status="synthetic" showLabel />);
      expect(screen.getByText('⚡')).toBeInTheDocument();
      expect(screen.getByText('AI Generated')).toBeInTheDocument();
    });

    it('shows pending status', () => {
      render(<VerificationBadge status="pending" showLabel />);
      expect(screen.getByText('○')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('shows in_review status', () => {
      render(<VerificationBadge status="in_review" showLabel />);
      expect(screen.getByText('◐')).toBeInTheDocument();
      expect(screen.getByText('In Review')).toBeInTheDocument();
    });
  });

  describe('unverified behavior', () => {
    it('hides badge for unverified without showLabel', () => {
      render(<VerificationBadge status="unverified" />);
      expect(screen.getByText('Unverified content')).toHaveClass('sr-only');
    });

    it('shows badge for unverified with showLabel', () => {
      render(<VerificationBadge status="unverified" showLabel />);
      expect(screen.getByText('Unverified')).toBeInTheDocument();
    });
  });

  describe('label visibility', () => {
    it('hides label by default', () => {
      render(<VerificationBadge status="verified" />);
      expect(screen.getByText('✓')).toBeInTheDocument();
      expect(screen.queryByText('Verified')).not.toBeInTheDocument();
    });

    it('shows label when showLabel is true', () => {
      render(<VerificationBadge status="verified" showLabel />);
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('uses small size by default', () => {
      render(<VerificationBadge status="verified" showLabel />);
      const badge = screen.getByLabelText('Verified');
      expect(badge).toHaveClass('text-xs');
    });

    it('supports medium size', () => {
      render(<VerificationBadge status="verified" size="md" showLabel />);
      const badge = screen.getByLabelText('Verified');
      expect(badge).toHaveClass('text-sm');
    });
  });

  describe('collective attribution', () => {
    it('shows collective name in title', () => {
      render(<VerificationBadge status="verified" collectiveName="NH Environmental Watch" />);
      const badge = screen.getByTitle('Verified by NH Environmental Watch');
      expect(badge).toBeInTheDocument();
    });

    it('has correct aria-label with collective', () => {
      render(<VerificationBadge status="verified" collectiveName="NH Environmental Watch" />);
      expect(screen.getByLabelText('Verified by NH Environmental Watch')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has appropriate aria-label', () => {
      render(<VerificationBadge status="verified" />);
      expect(screen.getByLabelText('Verified')).toBeInTheDocument();
    });

    it('has title attribute', () => {
      render(<VerificationBadge status="disputed" />);
      expect(screen.getByTitle('Disputed')).toBeInTheDocument();
    });
  });
});
