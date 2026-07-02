/* eslint-disable @typescript-eslint/no-deprecated -- act from @testing-library/react is not deprecated */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';

// Test component that uses the toast hook
function TestConsumer(): React.JSX.Element {
  const { toasts, addToast, removeToast } = useToast();
  return (
    <div>
      <button onClick={() => addToast('Test message')}>Add Toast</button>
      <button onClick={() => addToast('Success!', 'success')}>Add Success</button>
      <button onClick={() => addToast('Error!', 'error')}>Add Error</button>
      <button onClick={() => addToast('Warning!', 'warning')}>Add Warning</button>
      <button onClick={() => addToast('Custom duration', 'info', 1000)}>Add Custom Duration</button>
      <div data-testid="toast-count">{toasts.length}</div>
      {toasts.map((toast) => (
        <button key={toast.id} onClick={() => removeToast(toast.id)}>
          Remove {toast.id}
        </button>
      ))}
    </div>
  );
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ToastProvider', () => {
    it('renders children', () => {
      render(
        <ToastProvider>
          <div>Child content</div>
        </ToastProvider>
      );
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('renders toast container', () => {
      render(
        <ToastProvider>
          <div>Content</div>
        </ToastProvider>
      );
      expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
    });
  });

  describe('useToast hook', () => {
    it('throws error when used outside provider', () => {
      // Suppress console.error for this test
      const spy = vi.spyOn(console, 'error').mockImplementation(vi.fn());

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useToast must be used within a ToastProvider');

      spy.mockRestore();
    });

    it('adds toast with default info variant', () => {
      render(
        <ToastProvider>
          <TestConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Add Toast'));

      expect(screen.getByText('Test message')).toBeInTheDocument();
      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
    });

    it('adds success toast', () => {
      render(
        <ToastProvider>
          <TestConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Add Success'));

      expect(screen.getByText('Success!')).toBeInTheDocument();
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('adds error toast', () => {
      render(
        <ToastProvider>
          <TestConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Add Error'));

      expect(screen.getByText('Error!')).toBeInTheDocument();
      expect(screen.getByText('✕')).toBeInTheDocument();
    });

    it('adds warning toast', () => {
      render(
        <ToastProvider>
          <TestConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Add Warning'));

      expect(screen.getByText('Warning!')).toBeInTheDocument();
      expect(screen.getByText('!')).toBeInTheDocument();
    });

    it('removes toast manually', () => {
      render(
        <ToastProvider>
          <TestConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Add Toast'));
      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');

      // Find and click the remove button (contains the toast id)
      const removeButton = screen.getByText(/^Remove toast-/);
      fireEvent.click(removeButton);

      expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
    });
  });

  describe('auto-dismiss', () => {
    it('auto-dismisses after default duration (4000ms)', () => {
      render(
        <ToastProvider>
          <TestConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Add Toast'));
      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
    });

    it('uses custom duration', () => {
      render(
        <ToastProvider>
          <TestConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Add Custom Duration'));
      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
    });
  });

  describe('dismiss button', () => {
    it('renders dismiss button on toast', () => {
      render(
        <ToastProvider>
          <TestConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Add Toast'));

      expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();
    });

    it('dismisses toast when dismiss button clicked', () => {
      render(
        <ToastProvider>
          <TestConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Add Toast'));
      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');

      fireEvent.click(screen.getByLabelText('Dismiss'));

      expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
    });
  });

  describe('accessibility', () => {
    it('toast has status role', () => {
      render(
        <ToastProvider>
          <TestConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Add Toast'));

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('toast has aria-live polite', () => {
      render(
        <ToastProvider>
          <TestConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Add Toast'));

      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('multiple toasts', () => {
    it('can display multiple toasts', () => {
      render(
        <ToastProvider>
          <TestConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Add Toast'));
      fireEvent.click(screen.getByText('Add Success'));
      fireEvent.click(screen.getByText('Add Error'));

      expect(screen.getByTestId('toast-count')).toHaveTextContent('3');
      expect(screen.getByText('Test message')).toBeInTheDocument();
      expect(screen.getByText('Success!')).toBeInTheDocument();
      expect(screen.getByText('Error!')).toBeInTheDocument();
    });
  });
});
