/**
 * ErrorBoundary — Catches React component crashes.
 *
 * Displays a friendly error message with recovery options.
 * Class component required for componentDidCatch.
 */

'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI */
  fallback?: ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-surface-container)]">
            <svg
              className="h-8 w-8 text-[var(--fg-error)]"
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
          <h2 className="mb-2 text-xl font-semibold text-[var(--fg-primary)]">
            Something went wrong
          </h2>
          <p className="mb-6 max-w-md text-[var(--fg-secondary)]">
            We encountered an unexpected error. This has been noted and we&apos;re working on it.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-nested bg-[var(--bg-action-primary)] px-4 py-2 font-medium text-[var(--fg-inverse)] transition-colors hover:bg-[var(--bg-action-primary-hover)]"
          >
            Try again
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error !== null && (
            <details className="mt-8 w-full max-w-lg text-left">
              <summary className="cursor-pointer text-sm text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)]">
                Error details
              </summary>
              <pre className="rounded-nested mt-2 overflow-x-auto bg-[var(--bg-surface-container)] p-4 text-xs text-[var(--fg-error)]">
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
