import { defineConfig, devices } from '@playwright/test';
import { RECORDING_PROJECTS, SCREENCAST_STEP_MS } from './scripts/screencast/screencasts';

// The app's primary device is a landscape tablet (product.md "UI concept").
const tablet = {
  ...devices['Desktop Chrome'],
  viewport: { width: 1180, height: 820 },
  hasTouch: true,
};

// Phone portrait, the size the phone play screen is designed for (M3.14, 390 px like its
// prototype). Screenshots only: flows stay on the tablet.
const phone = {
  ...devices['Desktop Chrome'],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

// Lets local/cloud sessions use a preinstalled Chromium instead of downloading one.
const executablePath = process.env.PW_CHROMIUM_PATH;

/**
 * E2E tests run against the production build (`vite preview`), the same bundle users get.
 * `tablet-landscape` runs every spec (`pnpm e2e`). For the PR description, `screencast`
 * re-runs only the specs tagged `@flow`, slowed down and recorded, and `screenshot` and
 * `screenshot-phone` only the specs tagged `@shot`, photographed as they end on the tablet and on
 * a phone (`pnpm e2e:screencast`, see docs/automation.md).
 */
export default defineConfig({
  testDir: './e2e',
  // Downloads the card pictures the tests show into a gitignored folder (e2e/fixtures/card_pictures.ts).
  globalSetup: './e2e/fixtures/card_pictures.ts',
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
      name: RECORDING_PROJECTS.flows,
      grep: /@flow/,
      outputDir: 'test-results/screencast',
      use: {
        ...tablet,
        // The end state, so the preview can tell whether this PR changed the flow (cli.ts render).
        screenshot: 'on',
        video: {
          mode: 'on',
          size: tablet.viewport,
          show: {
            // Pointer and highlight on every interaction, so a viewer sees what was clicked.
            // Two steps long, so the 4 fps GIF always catches it in at least two frames.
            actions: { cursor: 'pointer', duration: 2 * SCREENCAST_STEP_MS },
            // The current `test.step` name as a caption, so the GIF narrates the flow. Bottom
            // right keeps it off the header, and the font stays readable once scaled to the GIF width.
            test: { level: 'step', position: 'bottom-right', fontSize: 18 },
          },
        },
        launchOptions: { executablePath, slowMo: SCREENCAST_STEP_MS },
      },
    },
    {
      name: RECORDING_PROJECTS.shots,
      grep: /@shot/,
      outputDir: 'test-results/screenshot',
      use: { ...tablet, screenshot: 'on', launchOptions: { executablePath } },
    },
    {
      name: RECORDING_PROJECTS.phoneShots,
      grep: /@shot/,
      outputDir: 'test-results/screenshot-phone',
      use: { ...phone, screenshot: 'on', launchOptions: { executablePath } },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
