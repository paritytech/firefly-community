/**
 * Button — High-contrast button component.
 *
 * Variants:
 * - primary: White text on black, inverts on hover
 * - secondary: Outlined, transparent background
 * - illuminate: Gold accent, used ONLY for the "Illuminate" action
 *
 * The illuminate variant is special — it should feel like lighting a signal fire.
 */

import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';
import { FireflySymbol } from '../FireflySymbol';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button visual variant */
  variant?: 'primary' | 'secondary' | 'illuminate';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the button is in a loading state */
  isLoading?: boolean;
  /** Content to render inside the button */
  children: ReactNode;
}

const baseStyles = `
  inline-flex items-center justify-center gap-2
  font-medium transition-all duration-150 ease-out
  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
  disabled:cursor-not-allowed
  active:scale-[0.98]
`;

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm rounded-small',
  md: 'px-4 py-2 text-sm rounded-nested',
  lg: 'px-6 py-3 text-base rounded-nested',
};

const variantStyles = {
  primary: `
    bg-transparent text-[var(--fg-primary)] border border-[var(--fg-primary)]
    hover:bg-[var(--bg-action-primary)] hover:text-[var(--fg-inverse)]
    focus-visible:outline-[var(--fg-primary)]
    disabled:border-[var(--fg-tertiary)] disabled:text-[var(--fg-tertiary)]
    disabled:hover:bg-transparent disabled:hover:text-[var(--fg-tertiary)]
  `,
  secondary: `
    bg-transparent text-[var(--fg-secondary)] border border-[var(--border-default)]
    hover:text-[var(--fg-primary)] hover:border-[var(--border-emphasis)]
    focus-visible:outline-[var(--border-emphasis)]
    disabled:text-[var(--fg-tertiary)] disabled:border-[var(--border-subtle)]
  `,
  illuminate: `
    bg-transparent text-[var(--fg-accent)] border border-[var(--border-accent)]
    animate-firefly-pulse
    hover:bg-[var(--bg-accent-firefly)] hover:text-black hover:shadow-glow hover:scale-[1.02] hover:animate-none
    active:brightness-110 active:shadow-[0_0_30px_rgba(232,185,49,0.25)]
    focus-visible:outline-[var(--fg-accent)]
    disabled:border-[var(--fg-tertiary)] disabled:text-[var(--fg-tertiary)] disabled:animate-none
    disabled:hover:bg-transparent disabled:hover:text-[var(--fg-tertiary)] disabled:hover:shadow-none disabled:hover:scale-100
  `,
};

/**
 * Get button class names for applying button styles to any element.
 * Useful for styling Link components as buttons.
 */
export function getButtonClassName(
  variant: 'primary' | 'secondary' | 'illuminate' = 'primary',
  size: 'sm' | 'md' | 'lg' = 'md',
  className?: string
): string {
  return `
    ${baseStyles}
    ${sizeStyles[size]}
    ${variantStyles[variant]}
    ${className ?? ''}
  `
    .trim()
    .replace(/\s+/g, ' ');
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps): ReactElement {
  const isDisabled = disabled === true || isLoading;
  const combinedClassName = getButtonClassName(variant, size, className);

  return (
    <button className={combinedClassName} disabled={isDisabled} {...props}>
      {variant === 'illuminate' && !isLoading && (
        <FireflySymbol size={14} color="inherit" aria-hidden="true" />
      )}
      {isLoading ? <span className="animate-pulse">Loading...</span> : children}
    </button>
  );
}
