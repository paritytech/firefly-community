import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  describe('rendering', () => {
    it('renders title', () => {
      render(<EmptyState title="No results found" />);
      expect(screen.getByRole('heading', { name: 'No results found' })).toBeInTheDocument();
    });

    it('renders description when provided', () => {
      render(<EmptyState title="Empty" description="Try adjusting your search." />);
      expect(screen.getByText('Try adjusting your search.')).toBeInTheDocument();
    });

    it('does not render description when not provided', () => {
      const { container } = render(<EmptyState title="Empty" />);
      expect(container.querySelectorAll('p')).toHaveLength(0);
    });

    it('renders action when provided', () => {
      render(<EmptyState title="Empty" action={<button>Add item</button>} />);
      expect(screen.getByRole('button', { name: 'Add item' })).toBeInTheDocument();
    });

    it('renders default icon when none provided', () => {
      const { container } = render(<EmptyState title="Empty" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('renders custom icon when provided', () => {
      render(<EmptyState title="Empty" icon={<span data-testid="custom-icon">🔍</span>} />);
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('renders medium size by default', () => {
      const { container } = render(<EmptyState title="Empty" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('py-12', 'px-8');
    });

    it('renders small size', () => {
      const { container } = render(<EmptyState title="Empty" size="sm" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('py-8', 'px-6');
    });

    it('renders large size', () => {
      const { container } = render(<EmptyState title="Empty" size="lg" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('py-16', 'px-10');
    });

    it('applies correct title size for small', () => {
      render(<EmptyState title="Empty" size="sm" />);
      const heading = screen.getByRole('heading');
      expect(heading).toHaveClass('text-base');
    });

    it('applies correct title size for medium', () => {
      render(<EmptyState title="Empty" size="md" />);
      const heading = screen.getByRole('heading');
      expect(heading).toHaveClass('text-lg');
    });

    it('applies correct title size for large', () => {
      render(<EmptyState title="Empty" size="lg" />);
      const heading = screen.getByRole('heading');
      expect(heading).toHaveClass('text-xl');
    });
  });

  describe('styling', () => {
    it('has centered text alignment', () => {
      const { container } = render(<EmptyState title="Empty" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('text-center');
    });

    it('has flex column layout', () => {
      const { container } = render(<EmptyState title="Empty" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('flex', 'flex-col', 'items-center');
    });

    it('has fade-in animation', () => {
      const { container } = render(<EmptyState title="Empty" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('animate-fade-in');
    });
  });
});
