import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against the production build (`vite preview`), the same bundle users get.
 * The default viewport is a landscape tablet, the app's primary device (architecture §11).
 */
export default defineConfig({
  testDir: './e2e',
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
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1180, height: 820 },
        hasTouch: true,
        // Lets local/cloud sessions use a preinstalled Chromium instead of downloading one.
        launchOptions: process.env.PW_CHROMIUM_PATH
          ? { executablePath: process.env.PW_CHROMIUM_PATH }
          : {},
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
