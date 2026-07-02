'use client';

/**
 * CollectiveMembershipBadge — Shows collective membership with role indicator.
 *
 * Displays the collective name with a role-specific icon:
 * - ★ founder (gold)
 * - ◆ moderator (blue)
 * - ● member (gray)
 */

import type { ReactElement } from 'react';
import type { MemberRole } from '@cocuyo/types';

export interface CollectiveMembershipBadgeProps {
  /** Name of the collective */
  collectiveName: string;
  /** User's role in the collective */
  role: MemberRole;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Optional click handler */
  onClick?: () => void;
}

interface RoleConfig {
  icon: string;
  colorClass: string;
  title: string;
}

function getRoleConfig(role: MemberRole): RoleConfig {
  switch (role) {
    case 'founder':
      return {
        icon: '★',
        colorClass: 'text-[var(--color-firefly-gold)]',
        title: 'Founder',
      };
    case 'moderator':
      return {
        icon: '◆',
        colorClass: 'text-[var(--fg-info)]',
        title: 'Moderator',
      };
    case 'member':
    default:
      return {
        icon: '●',
        colorClass: 'text-[var(--fg-tertiary)]',
        title: 'Member',
      };
  }
}

export function CollectiveMembershipBadge({
  collectiveName,
  role,
  size = 'sm',
  onClick,
}: CollectiveMembershipBadgeProps): ReactElement {
  const roleConfig = getRoleConfig(role);

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';
  const interactiveClasses = onClick
    ? 'cursor-pointer hover:border-[var(--border-emphasis)] transition-colors'
    : '';

  const handleClick = (): void => {
    onClick?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface-nested)] font-medium text-[var(--fg-secondary)] ${sizeClasses} ${interactiveClasses}`}
      title={`${roleConfig.title} of ${collectiveName}`}
      onClick={onClick ? handleClick : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
    >
      <span className={roleConfig.colorClass} aria-hidden="true">
        {roleConfig.icon}
      </span>
      <span>{collectiveName}</span>
    </span>
  );
}
