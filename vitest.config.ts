import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'apps/*/src/**/*.test.{ts,tsx}',
      'apps/*/scripts/**/*.test.ts',
    ],
    setupFiles: ['apps/web/src/test_setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/web/src/**', 'apps/web/scripts/**'],
      exclude: [
        '**/*.test.{ts,tsx}',
        // Entry points and network scripts are covered by E2E / the carddata check workflow.
        'apps/web/src/main.tsx',
        'apps/web/src/test_setup.ts',
        'packages/carddata/src/fetch.ts',
        'apps/web/scripts/screencast/cli.ts',
        'packages/review_digest/src/cli.ts',
        'apps/web/scripts/tsconfig.json',
      ],
      reporter: ['text-summary', 'json-summary', 'html'],
      // Floors, not targets: CI fails if coverage drops below them. Raise them as coverage grows.
      // The engine is pure logic and the heart of the app, so it gets a higher bar.
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
        'packages/engine/src/**': {
          lines: 95,
          statements: 95,
          functions: 90,
          branches: 85,
        },
      },
    },
  },
});
