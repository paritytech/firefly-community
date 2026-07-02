/**
 * Toast — Non-blocking notification component.
 *
 * Displays temporary messages that auto-dismiss.
 * Supports success, error, warning, and info variants.
 */

'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactElement,
  type ReactNode,
} from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastData[];
  addToast: (message: string, variant?: ToastVariant, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<ToastVariant, { bg: string; icon: string }> = {
  success: {
    bg: 'bg-[var(--bg-success)]',
    icon: '✓',
  },
  error: {
    bg: 'bg-[var(--bg-error)]',
    icon: '✕',
  },
  warning: {
    bg: 'bg-[#92400e]',
    icon: '!',
  },
  info: {
    bg: 'bg-[var(--bg-surface-container)]',
    icon: 'ℹ',
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastData;
  onDismiss: () => void;
}): ReactElement {
  const styles = variantStyles[toast.variant];

  useEffect(() => {
    const timer = setTimeout(onDismiss, toast.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [onDismiss, toast.duration]);

  return (
    <div
      className={`rounded-nested shadow-2 animate-slide-up flex items-center gap-3 px-4 py-3 ${styles.bg}`}
      role="status"
      aria-live="polite"
    >
      <span className="font-medium text-[var(--fg-primary)]" aria-hidden="true">
        {styles.icon}
      </span>
      <p className="flex-1 text-sm text-[var(--fg-primary)]">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg-primary)]"
        aria-label="Dismiss"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

export interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps): ReactElement {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = 'info', duration?: number) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const toast: ToastData =
        duration !== undefined ? { id, message, variant, duration } : { id, message, variant };
      setToasts((prev) => [...prev, toast]);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* Toast container */}
      <div
        className="pointer-events-none fixed right-4 bottom-4 left-4 z-[var(--z-toast)] mx-auto flex max-w-sm flex-col gap-2 sm:right-4 sm:left-auto sm:mx-0 sm:w-full"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={() => removeToast(toast.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
