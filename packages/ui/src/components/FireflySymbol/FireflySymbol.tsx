/**
 * FireflySymbol — The firefly icon used throughout the UI.
 *
 * Uses the four-pointed star character (✦) as the primary symbol,
 * representing illumination and the firefly metaphor.
 */

import type { CSSProperties, ReactElement } from 'react';

export interface FireflySymbolProps {
  /** Size of the symbol in pixels or CSS unit */
  size?: number | string;
  /** Color of the symbol. Defaults to firefly gold */
  color?: 'gold' | 'white' | 'inherit';
  /** Whether to animate with a subtle glow pulse */
  animate?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Accessible label */
  'aria-label'?: string;
}

const colorMap = {
  gold: 'var(--color-accent)',
  white: 'var(--color-text-primary)',
  inherit: 'inherit',
} as const;

export function FireflySymbol({
  size = 16,
  color = 'gold',
  animate = false,
  className = '',
  'aria-label': ariaLabel = 'Firefly',
}: FireflySymbolProps): ReactElement {
  const style: CSSProperties = {
    fontSize: typeof size === 'number' ? `${String(size)}px` : size,
    color: colorMap[color],
    lineHeight: 1,
  };

  const animateClass = animate ? 'animate-firefly-pulse' : '';

  return (
    <span
      className={`${animateClass} ${className}`.trim()}
      style={style}
      role="img"
      aria-label={ariaLabel}
    >
      ✦
    </span>
  );
}
