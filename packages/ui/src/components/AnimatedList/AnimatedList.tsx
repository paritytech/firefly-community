'use client';

/**
 * AnimatedList — Applies stagger animation to child elements.
 *
 * Wraps each child in a div with animation delay based on index,
 * creating a cascading entrance effect.
 */

import { Children, type ReactNode, type ReactElement, isValidElement, cloneElement } from 'react';

export interface AnimatedListProps {
  /** The list items to animate */
  children: ReactNode;
  /** Animation speed variant */
  variant?: 'normal' | 'fast';
  /** Maximum number of items to animate (rest appear instantly) */
  maxAnimatedItems?: number;
  /** Additional className for the container */
  className?: string;
  /** HTML element to use for the container */
  as?: 'div' | 'ul' | 'ol';
}

export function AnimatedList({
  children,
  variant = 'normal',
  maxAnimatedItems = 10,
  className = '',
  as: Component = 'div',
}: AnimatedListProps): ReactElement {
  const animationClass = variant === 'fast' ? 'animate-stagger-item-fast' : 'animate-stagger-item';

  const childArray = Children.toArray(children);

  return (
    <Component className={className}>
      {childArray.map((child, index) => {
        // Only animate up to maxAnimatedItems
        const shouldAnimate = index < maxAnimatedItems;

        // If the child is a valid element, clone it with the style
        if (isValidElement(child)) {
          return cloneElement(
            child as ReactElement<{ style?: React.CSSProperties; className?: string }>,
            {
              key: (child as ReactElement).key ?? index,
              style: {
                ...(child.props as { style?: React.CSSProperties }).style,
                '--stagger-index': shouldAnimate ? index : 0,
              } as React.CSSProperties,
              className:
                `${(child.props as { className?: string }).className ?? ''} ${shouldAnimate ? animationClass : ''}`.trim(),
            }
          );
        }

        // For non-element children, wrap in a div
        return (
          <div
            key={index}
            className={shouldAnimate ? animationClass : ''}
            style={{ '--stagger-index': shouldAnimate ? index : 0 } as React.CSSProperties}
          >
            {child}
          </div>
        );
      })}
    </Component>
  );
}
