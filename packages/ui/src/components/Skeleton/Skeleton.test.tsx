import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonPostCard,
  SkeletonClaimCard,
  SkeletonFeedPostCard,
} from './Skeleton';

describe('Skeleton', () => {
  describe('rendering', () => {
    it('renders with presentation role (hidden)', () => {
      render(<Skeleton />);
      expect(screen.getByRole('presentation', { hidden: true })).toBeInTheDocument();
    });

    it('is hidden from screen readers', () => {
      render(<Skeleton />);
      expect(screen.getByRole('presentation', { hidden: true })).toHaveAttribute(
        'aria-hidden',
        'true'
      );
    });

    it('has animate-pulse class', () => {
      render(<Skeleton />);
      expect(screen.getByRole('presentation', { hidden: true })).toHaveClass('animate-pulse');
    });
  });

  describe('variants', () => {
    it('renders text variant by default', () => {
      render(<Skeleton />);
      const skeleton = screen.getByRole('presentation', { hidden: true });
      expect(skeleton).toHaveClass('rounded-nested');
    });

    it('renders rectangular variant', () => {
      render(<Skeleton variant="rectangular" />);
      const skeleton = screen.getByRole('presentation', { hidden: true });
      expect(skeleton).toHaveClass('rounded-nested');
    });

    it('renders circular variant', () => {
      render(<Skeleton variant="circular" />);
      const skeleton = screen.getByRole('presentation', { hidden: true });
      expect(skeleton).toHaveClass('rounded-full');
    });
  });

  describe('dimensions', () => {
    it('applies custom width', () => {
      render(<Skeleton width={200} />);
      const skeleton = screen.getByRole('presentation', { hidden: true });
      expect(skeleton).toHaveStyle({ width: '200px' });
    });

    it('applies custom height', () => {
      render(<Skeleton height={50} />);
      const skeleton = screen.getByRole('presentation', { hidden: true });
      expect(skeleton).toHaveStyle({ height: '50px' });
    });

    it('applies string dimensions', () => {
      render(<Skeleton width="50%" height="2rem" />);
      const skeleton = screen.getByRole('presentation', { hidden: true });
      expect(skeleton).toHaveStyle({ width: '50%', height: '2rem' });
    });
  });

  describe('customization', () => {
    it('accepts additional className', () => {
      render(<Skeleton className="custom-class" />);
      expect(screen.getByRole('presentation', { hidden: true })).toHaveClass('custom-class');
    });
  });
});

describe('SkeletonText', () => {
  it('renders 3 lines by default', () => {
    render(<SkeletonText />);
    const skeletons = screen.getAllByRole('presentation', { hidden: true });
    expect(skeletons).toHaveLength(3);
  });

  it('renders specified number of lines', () => {
    render(<SkeletonText lines={5} />);
    const skeletons = screen.getAllByRole('presentation', { hidden: true });
    expect(skeletons).toHaveLength(5);
  });

  it('last line is shorter (60% width)', () => {
    render(<SkeletonText lines={2} />);
    const skeletons = screen.getAllByRole('presentation', { hidden: true });
    expect(skeletons[1]).toHaveStyle({ width: '60%' });
  });

  it('accepts className', () => {
    const { container } = render(<SkeletonText className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });
});

describe('SkeletonCard', () => {
  it('renders multiple skeleton elements', () => {
    render(<SkeletonCard />);
    const skeletons = screen.getAllByRole('presentation', { hidden: true });
    expect(skeletons.length).toBeGreaterThan(3);
  });

  it('includes circular skeleton for avatar', () => {
    render(<SkeletonCard />);
    const skeletons = screen.getAllByRole('presentation', { hidden: true });
    const circularSkeleton = skeletons.find((el) => el.classList.contains('rounded-full'));
    expect(circularSkeleton).toBeDefined();
  });

  it('accepts className', () => {
    const { container } = render(<SkeletonCard className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });
});

describe('SkeletonPostCard', () => {
  it('renders skeleton structure', () => {
    render(<SkeletonPostCard />);
    const skeletons = screen.getAllByRole('presentation', { hidden: true });
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('accepts className', () => {
    const { container } = render(<SkeletonPostCard className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });
});

describe('SkeletonClaimCard', () => {
  it('renders skeleton structure', () => {
    render(<SkeletonClaimCard />);
    const skeletons = screen.getAllByRole('presentation', { hidden: true });
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('accepts className', () => {
    const { container } = render(<SkeletonClaimCard className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });
});

describe('SkeletonFeedPostCard', () => {
  it('renders skeleton structure', () => {
    render(<SkeletonFeedPostCard />);
    const skeletons = screen.getAllByRole('presentation', { hidden: true });
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('includes circular skeleton for author avatar', () => {
    render(<SkeletonFeedPostCard />);
    const skeletons = screen.getAllByRole('presentation', { hidden: true });
    const circularSkeleton = skeletons.find((el) => el.classList.contains('rounded-full'));
    expect(circularSkeleton).toBeDefined();
  });

  it('accepts className', () => {
    const { container } = render(<SkeletonFeedPostCard className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });
});
