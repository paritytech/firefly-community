import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BackButton } from './BackButton';

describe('BackButton', () => {
  describe('rendering', () => {
    it('renders as a button', () => {
      render(<BackButton onClick={vi.fn()} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders default "Back" label', () => {
      render(<BackButton onClick={vi.fn()} />);
      expect(screen.getByText('Back')).toBeInTheDocument();
    });

    it('renders custom label', () => {
      render(<BackButton onClick={vi.fn()} label="Go back" />);
      expect(screen.getByText('Go back')).toBeInTheDocument();
    });

    it('renders default arrow icon', () => {
      const { container } = render(<BackButton onClick={vi.fn()} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('renders custom icon when provided', () => {
      render(<BackButton onClick={vi.fn()} icon={<span data-testid="custom-icon">←</span>} />);
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onClick when clicked', () => {
      const onClick = vi.fn();
      render(<BackButton onClick={onClick} />);

      fireEvent.click(screen.getByRole('button'));

      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('has aria-label matching the label text', () => {
      render(<BackButton onClick={vi.fn()} label="Return" />);
      expect(screen.getByLabelText('Return')).toBeInTheDocument();
    });

    it('has type="button"', () => {
      render(<BackButton onClick={vi.fn()} />);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    });
  });

  describe('styling', () => {
    it('applies custom className', () => {
      render(<BackButton onClick={vi.fn()} className="custom-class" />);
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });

    it('has inline-flex display', () => {
      render(<BackButton onClick={vi.fn()} />);
      expect(screen.getByRole('button')).toHaveClass('inline-flex');
    });
  });
});
