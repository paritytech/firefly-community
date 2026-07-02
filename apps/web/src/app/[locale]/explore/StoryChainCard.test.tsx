/**
 * Tests for StoryChainCard — status mapping and rendering.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ChainPreview, ChainStatus } from '@cocuyo/types';
import { createChainId } from '@cocuyo/types';
import { StoryChainCard, toBadgeStatus } from './StoryChainCard';

const labels = {
  eyebrow: 'Story chain',
  signals: 'signals',
  corroborations: 'corroborations',
  updated: 'updated',
};

function makeChain(over: Partial<ChainPreview> = {}): ChainPreview {
  return {
    id: createChainId('chain-1'),
    title: 'Merrimack water-quality reports',
    topics: ['water-quality'],
    status: 'active',
    postCount: 7,
    corroborationCount: 12,
    updatedAt: 1000,
    ...over,
  };
}

describe('toBadgeStatus', () => {
  it('maps each ChainStatus to a VerificationBadge status', () => {
    const cases: Array<[ChainStatus, string]> = [
      ['established', 'verified'],
      ['contested', 'disputed'],
      ['active', 'in_review'],
      ['emerging', 'pending'],
    ];
    cases.forEach(([input, expected]) => expect(toBadgeStatus(input)).toBe(expected));
  });
});

describe('StoryChainCard', () => {
  const baseProps = {
    chain: makeChain(),
    topicLabel: 'Water quality',
    labels,
    updatedLabel: '2h ago',
    onClick: vi.fn(),
  };

  it('renders the title, eyebrow with topic, and meta line', () => {
    render(<StoryChainCard {...baseProps} />);
    expect(screen.getByText('Merrimack water-quality reports')).toBeInTheDocument();
    expect(screen.getByText(/Story chain · Water quality/)).toBeInTheDocument();
    expect(screen.getByText(/7 signals · 12 corroborations · updated 2h ago/)).toBeInTheDocument();
  });

  it('invokes onClick with the chain id when activated', () => {
    const onClick = vi.fn();
    render(<StoryChainCard {...baseProps} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(createChainId('chain-1'));
  });
});
