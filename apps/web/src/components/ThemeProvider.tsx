'use client';

/**
 * ThemeProvider — Manages light/dark theme state.
 *
 * Persists preference using the storage adapter (HostAPI compliant).
 * Respects system preference on first visit.
 */

import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
  type ReactElement,
} from 'react';
import { storage } from '@/lib/host/storage';

export type Theme = 'light' | 'dark';

export interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'theme';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): ReactElement {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  // Initialize theme from storage or system preference
  useEffect(() => {
    let cancelled = false;

    const loadTheme = async (): Promise<void> => {
      const stored = await storage.read<Theme>(STORAGE_KEY);

      // Guard: don't update state if unmounted
      if (cancelled) return;

      if (stored === 'light' || stored === 'dark') {
        setThemeState(stored);
      } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        setThemeState('light');
      }

      setMounted(true);
    };

    void loadTheme();

    return () => {
      cancelled = true;
    };
  }, []);

  // Apply theme to document and persist
  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute('data-theme', theme);
      void storage.write(STORAGE_KEY, theme);
    }
  }, [theme, mounted]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(
    (): ThemeContextValue => ({
      theme,
      toggleTheme,
      setTheme,
    }),
    [theme, toggleTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
