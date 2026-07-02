import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Breadcrumb } from './Breadcrumb';

describe('Breadcrumb', () => {
  describe('rendering', () => {
    it('renders as nav element with aria-label', () => {
      render(<Breadcrumb items={[{ label: 'Home' }]} />);
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    });

    it('renders single item', () => {
      render(<Breadcrumb items={[{ label: 'Home' }]} />);
      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    it('renders multiple items', () => {
      render(
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Products', href: '/products' },
            { label: 'Widget' },
          ]}
        />
      );
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Products')).toBeInTheDocument();
      expect(screen.getByText('Widget')).toBeInTheDocument();
    });

    it('renders links for items with href', () => {
      render(<Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Current' }]} />);
      const link = screen.getByRole('link', { name: 'Home' });
      expect(link).toHaveAttribute('href', '/');
    });

    it('does not render link for last item', () => {
      render(
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Current', href: '/current' },
          ]}
        />
      );
      // Last item should not be a link even if it has href
      expect(screen.queryAllByRole('link')).toHaveLength(1);
    });

    it('renders items without href as plain text', () => {
      render(<Breadcrumb items={[{ label: 'Category' }, { label: 'Item' }]} />);
      expect(screen.queryAllByRole('link')).toHaveLength(0);
    });
  });

  describe('separators', () => {
    it('renders default separator between items', () => {
      const { container } = render(
        <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Current' }]} />
      );
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });

    it('renders custom separator', () => {
      render(
        <Breadcrumb
          items={[{ label: 'Home', href: '/' }, { label: 'Current' }]}
          separator={<span data-testid="custom-sep">/</span>}
        />
      );
      expect(screen.getByTestId('custom-sep')).toBeInTheDocument();
    });

    it('does not render separator before first item', () => {
      render(
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Products', href: '/products' },
            { label: 'Current' },
          ]}
          separator={<span data-testid="sep">→</span>}
        />
      );
      // Should have 2 separators for 3 items
      expect(screen.getAllByTestId('sep')).toHaveLength(2);
    });
  });

  describe('custom link renderer', () => {
    it('uses renderLink for linked items', () => {
      render(
        <Breadcrumb
          items={[{ label: 'Home', href: '/' }, { label: 'Current' }]}
          renderLink={(item, children) => (
            <a href={item.href} data-testid="custom-link">
              {children}
            </a>
          )}
        />
      );
      expect(screen.getByTestId('custom-link')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('marks current page with aria-current', () => {
      render(<Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Current Page' }]} />);
      expect(screen.getByText('Current Page')).toHaveAttribute('aria-current', 'page');
    });

    it('hides separator from screen readers', () => {
      const { container } = render(
        <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Current' }]} />
      );
      const separatorWrapper = container.querySelector('[aria-hidden="true"]');
      expect(separatorWrapper).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('applies custom className', () => {
      render(<Breadcrumb items={[{ label: 'Home' }]} className="custom-class" />);
      expect(screen.getByRole('navigation')).toHaveClass('custom-class');
    });

    it('last item has font-medium', () => {
      render(<Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Current' }]} />);
      expect(screen.getByText('Current')).toHaveClass('font-medium');
    });
  });
});
