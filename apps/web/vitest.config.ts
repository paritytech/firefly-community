import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.tsx'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Measure ALL executable app source honestly — not just lib/hooks. Presentational
      // components and route files are largely exercised by the Playwright e2e journeys;
      // the logic core (services, hooks, contexts) carries the unit-coverage weight and is
      // well covered (key modules 85-98%). The thresholds below are an enforced FLOOR that
      // ratchets UP as coverage grows — never lower them to make a change pass; add tests.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/node_modules/**',
        '**/.next/**',
        '**/dist/**',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/test/**',
        '**/e2e/**',
        '**/index.ts',
        // Type-only files (no executable code)
        '**/lib/ai/types.ts',
        // Re-export files
        '**/lib/utils/address.ts',
        // Service hooks that wrap TanStack Query (tested via integration)
        '**/lib/services/hooks/**',
      ],
      thresholds: {
        lines: 22,
        functions: 40,
        branches: 73,
        statements: 22,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@cocuyo/types': resolve(__dirname, '../../packages/types/src'),
      '@cocuyo/ui': resolve(__dirname, '../../packages/ui/src'),
    },
  },
});
