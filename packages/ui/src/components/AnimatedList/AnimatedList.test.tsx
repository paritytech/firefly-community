import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnimatedList } from './AnimatedList';

describe('AnimatedList', () => {
  it('renders children', () => {
    render(
      <AnimatedList>
        <div>Item 1</div>
        <div>Item 2</div>
        <div>Item 3</div>
      </AnimatedList>
    );

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('applies stagger animation class to children', () => {
    render(
      <AnimatedList>
        <div data-testid="item-0">Item 1</div>
        <div data-testid="item-1">Item 2</div>
      </AnimatedList>
    );

    const item0 = screen.getByTestId('item-0');
    const item1 = screen.getByTestId('item-1');

    expect(item0.className).toContain('animate-stagger-item');
    expect(item1.className).toContain('animate-stagger-item');
  });

  it('applies fast variant class when specified', () => {
    render(
      <AnimatedList variant="fast">
        <div data-testid="item">Item</div>
      </AnimatedList>
    );

    const item = screen.getByTestId('item');
    expect(item.className).toContain('animate-stagger-item-fast');
  });

  it('sets stagger index as CSS variable', () => {
    render(
      <AnimatedList>
        <div data-testid="item-0">Item 1</div>
        <div data-testid="item-1">Item 2</div>
        <div data-testid="item-2">Item 3</div>
      </AnimatedList>
    );

    const item0 = screen.getByTestId('item-0');
    const item1 = screen.getByTestId('item-1');
    const item2 = screen.getByTestId('item-2');

    expect(item0.style.getPropertyValue('--stagger-index')).toBe('0');
    expect(item1.style.getPropertyValue('--stagger-index')).toBe('1');
    expect(item2.style.getPropertyValue('--stagger-index')).toBe('2');
  });

  it('limits animation to maxAnimatedItems', () => {
    render(
      <AnimatedList maxAnimatedItems={2}>
        <div data-testid="item-0">Item 1</div>
        <div data-testid="item-1">Item 2</div>
        <div data-testid="item-2">Item 3</div>
      </AnimatedList>
    );

    const item0 = screen.getByTestId('item-0');
    const item1 = screen.getByTestId('item-1');
    const item2 = screen.getByTestId('item-2');

    expect(item0.className).toContain('animate-stagger-item');
    expect(item1.className).toContain('animate-stagger-item');
    expect(item2.className).not.toContain('animate-stagger-item');
  });

  it('applies custom className to container', () => {
    const { container } = render(
      <AnimatedList className="custom-class space-y-4">
        <div>Item</div>
      </AnimatedList>
    );

    expect(container.firstChild).toHaveClass('custom-class', 'space-y-4');
  });

  it('renders as different HTML elements', () => {
    const { container, rerender } = render(
      <AnimatedList as="ul">
        <li>Item</li>
      </AnimatedList>
    );

    expect(container.querySelector('ul')).toBeInTheDocument();

    rerender(
      <AnimatedList as="ol">
        <li>Item</li>
      </AnimatedList>
    );

    expect(container.querySelector('ol')).toBeInTheDocument();
  });
});
