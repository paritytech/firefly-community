/**
 * Footer — Minimal site footer.
 *
 * Simplified for Triangle host.
 * Single line: Tagline · Copyright
 */

import type { ReactElement } from 'react';

export interface FooterProps {
  /** Copyright year */
  year?: number;
  /** Translated labels */
  labels?: {
    builtOn?: string;
    tagline?: string;
    copyright?: string;
  };
}

export function Footer({
  year = new Date().getFullYear(),
  labels = {},
}: FooterProps): ReactElement {
  const { builtOn = 'Built on Polkadot', tagline = 'Lights in the dark.', copyright } = labels;

  return (
    <footer
      className="border-t border-[var(--border-default)] bg-[var(--bg-surface-main)] py-6"
      role="contentinfo"
    >
      <div className="container-wide">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-[var(--fg-tertiary)]">
          {/* Built on Polkadot */}
          <span className="flex items-center gap-1.5">
            {builtOn}
            <span
              className="inline-block h-2 w-2 rounded-full bg-[var(--color-polkadot-pink)]"
              aria-hidden="true"
            />
          </span>
          <span aria-hidden="true">·</span>
          {/* Tagline */}
          <span className="italic">{tagline}</span>
          {/* Copyright — only rendered when a non-empty copyright label is provided */}
          {copyright !== undefined && copyright !== '' && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                &copy; {year} {copyright}
              </span>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
