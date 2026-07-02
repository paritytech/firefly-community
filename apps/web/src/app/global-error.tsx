/**
 * Global error page.
 *
 * Displayed when an error occurs in the root layout.
 * Must be a client component and include its own html/body tags.
 */

'use client';

import type { ReactElement } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error: _error, reset }: GlobalErrorProps): ReactElement {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white">
        <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
          <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-900">
            <svg
              className="h-10 w-10 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold">Something went wrong</h1>
          <p className="mb-8 max-w-md text-zinc-400">
            We encountered an unexpected error. This has been noted and we&apos;re working on it.
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-white px-6 py-3 font-medium text-black transition-colors hover:bg-zinc-200"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
