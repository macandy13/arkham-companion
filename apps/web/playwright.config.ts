import { defineConfig, devices } from '@playwright/test';
import { SCREENCAST_STEP_MS } from './scripts/screencast/screencasts';

// The app's primary device is a landscape tablet (architecture §11).
const tablet = {
  ...devices['Desktop Chrome'],
  viewport: { width: 1180, height: 820 },
  hasTouch: true,
};

// Lets local/cloud sessions use a preinstalled Chromium instead of downloading one.
const executablePath = process.env.PW_CHROMIUM_PATH;

/**
 * E2E tests run against the production build (`vite preview`), the same bundle users get.
 * `tablet-landscape` runs every spec (`pnpm e2e`). `screencast` re-runs only the specs
 * tagged `@flow`, slowed down and recorded, for the PR description (`pnpm e2e:screencast`,
 * see docs/automation.md).
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'tablet-landscape',
      use: { ...tablet, launchOptions: { executablePath } },
    },
    {
      name: 'screencast',
      grep: /@flow/,
      outputDir: 'test-results/screencast',
      use: {
        ...tablet,
        video: {
          mode: 'on',
          size: tablet.viewport,
          show: {
            // Pointer and highlight on every interaction, so a viewer sees what was clicked.
            // Two steps long, so the 4 fps GIF always catches it in at least two frames.
            actions: { cursor: 'pointer', duration: 2 * SCREENCAST_STEP_MS },
            // The current `test.step` name as a caption, so the GIF narrates the flow.
            test: { level: 'step', position: 'top-right' },
          },
        },
        launchOptions: { executablePath, slowMo: SCREENCAST_STEP_MS },
      },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
