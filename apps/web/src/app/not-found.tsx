/**
 * 404 Not Found page.
 *
 * Displayed when a route doesn't exist.
 */

import type { ReactElement } from 'react';
import Link from 'next/link';
import { Button } from '@cocuyo/ui';

export default function NotFound(): ReactElement {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--bg-default)] text-[var(--fg-primary)]">
        <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
          <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--bg-surface-container)]">
            <svg
              className="h-10 w-10 text-[var(--fg-tertiary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="mb-4 text-6xl font-bold text-[var(--fg-primary)]">404</h1>
          <h2 className="mb-2 text-xl font-semibold text-[var(--fg-primary)]">Page not found</h2>
          <p className="mb-8 max-w-md text-[var(--fg-secondary)]">
            The signal you&apos;re looking for has faded into the dark. It may have been moved or no
            longer exists.
          </p>
          <Link href="/">
            <Button variant="primary">Return home</Button>
          </Link>
        </div>
      </body>
    </html>
  );
}
