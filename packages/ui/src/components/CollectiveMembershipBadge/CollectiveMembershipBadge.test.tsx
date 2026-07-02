import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollectiveMembershipBadge } from './CollectiveMembershipBadge';

describe('CollectiveMembershipBadge', () => {
  describe('role rendering', () => {
    it('renders founder role with star icon', () => {
      render(<CollectiveMembershipBadge collectiveName="Test Collective" role="founder" />);
      expect(screen.getByText('★')).toBeInTheDocument();
      expect(screen.getByText('Test Collective')).toBeInTheDocument();
    });

    it('renders moderator role with diamond icon', () => {
      render(<CollectiveMembershipBadge collectiveName="Test Collective" role="moderator" />);
      expect(screen.getByText('◆')).toBeInTheDocument();
    });

    it('renders member role with circle icon', () => {
      render(<CollectiveMembershipBadge collectiveName="Test Collective" role="member" />);
      expect(screen.getByText('●')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('renders small size by default', () => {
      const { container } = render(
        <CollectiveMembershipBadge collectiveName="Test" role="member" />
      );
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('text-xs', 'px-2', 'py-0.5');
    });

    it('renders medium size', () => {
      const { container } = render(
        <CollectiveMembershipBadge collectiveName="Test" role="member" size="md" />
      );
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('text-sm', 'px-2.5', 'py-1');
    });
  });

  describe('interactions', () => {
    it('calls onClick when clicked', () => {
      const onClick = vi.fn();
      render(<CollectiveMembershipBadge collectiveName="Test" role="member" onClick={onClick} />);

      fireEvent.click(screen.getByRole('button'));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('has button role when clickable', () => {
      render(<CollectiveMembershipBadge collectiveName="Test" role="member" onClick={vi.fn()} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('does not have button role when not clickable', () => {
      render(<CollectiveMembershipBadge collectiveName="Test" role="member" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('handles Enter key press', () => {
      const onClick = vi.fn();
      render(<CollectiveMembershipBadge collectiveName="Test" role="member" onClick={onClick} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('handles Space key press', () => {
      const onClick = vi.fn();
      render(<CollectiveMembershipBadge collectiveName="Test" role="member" onClick={onClick} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('has tabIndex when clickable', () => {
      render(<CollectiveMembershipBadge collectiveName="Test" role="member" onClick={vi.fn()} />);
      expect(screen.getByRole('button')).toHaveAttribute('tabindex', '0');
    });

    it('has hover styles when clickable', () => {
      const { container } = render(
        <CollectiveMembershipBadge collectiveName="Test" role="member" onClick={vi.fn()} />
      );
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('cursor-pointer');
    });
  });

  describe('accessibility', () => {
    it('has title with role and collective name', () => {
      const { container } = render(
        <CollectiveMembershipBadge collectiveName="My Collective" role="founder" />
      );
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveAttribute('title', 'Founder of My Collective');
    });

    it('icon is hidden from screen readers', () => {
      render(<CollectiveMembershipBadge collectiveName="Test" role="founder" />);
      const icon = screen.getByText('★');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('role coloring', () => {
    it('founder has gold coloring', () => {
      render(<CollectiveMembershipBadge collectiveName="Test" role="founder" />);
      const icon = screen.getByText('★');
      expect(icon).toHaveClass('text-[var(--color-firefly-gold)]');
    });

    it('moderator has info coloring', () => {
      render(<CollectiveMembershipBadge collectiveName="Test" role="moderator" />);
      const icon = screen.getByText('◆');
      expect(icon).toHaveClass('text-[var(--fg-info)]');
    });

    it('member has tertiary coloring', () => {
      render(<CollectiveMembershipBadge collectiveName="Test" role="member" />);
      const icon = screen.getByText('●');
      expect(icon).toHaveClass('text-[var(--fg-tertiary)]');
    });
  });

  describe('styling', () => {
    it('has inline-flex display', () => {
      const { container } = render(
        <CollectiveMembershipBadge collectiveName="Test" role="member" />
      );
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('inline-flex');
    });

    it('has rounded-full border', () => {
      const { container } = render(
        <CollectiveMembershipBadge collectiveName="Test" role="member" />
      );
      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass('rounded-full', 'border');
    });
  });
});
