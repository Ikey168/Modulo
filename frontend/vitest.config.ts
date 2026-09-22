/// <reference types="vitest" />
/// <reference types="@testing-library/jest-dom" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    // A few interaction-heavy workspace suites reliably complete in ~1–2s
    // alone but can exceed Vitest's 5s default when the full 1k+ test suite is
    // transforming/rendering in parallel. Keep a bounded timeout while avoiding
    // false negatives caused purely by full-suite contention.
    testTimeout: 10000,
    css: true,
    // Unit tests live under src/. The `tests/` directory holds Playwright
    // e2e specs, which must not be collected by Vitest.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/setupTests.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
        'src/**/*.stories.{js,jsx,ts,tsx}',
        'src/**/__mocks__/**',
        'src/types/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src',
      '@modulo/core': resolve(__dirname, './src/core/index.ts')
    }
  }
});
