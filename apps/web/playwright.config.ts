import { defineConfig, devices } from '@playwright/test';
import type { PictureOptions } from './e2e/fixtures/test';
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
  // 1×, as the tablet: the committed goldens (e2e/__screenshots__) would take four times the
  // bytes at 2×, and a review sees the same layout.
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
};

// The screenshot specs.
const shotSpecs = /[\\/]shots[\\/].*\.spec\.ts$/;
// Not pictures of a change: the shots, and the accessibility checks, which would otherwise take
// the first recording slots whenever a change shows on every screen.
const notFlows = [shotSpecs, /accessibility\.spec\.ts$/];

// The pictures the preview compares with the base's (scripts/screencast/cli.ts), taken once the
// screen has settled (e2e/fixtures/test.ts): a glide or a
// fade still running as the test ends would make the same screen differ from run to run, and the
// app leaves its animations out for reduced motion.
// A spec that can't reach its situation (some don't yet on a phone) fails after 10 s instead
// of Playwright's 30 s test timeout, which made those few specs most of the run's time.
const picture = { endPicture: true, reducedMotion: 'reduce', actionTimeout: 10_000 } as const;

// Lets local/cloud sessions use a preinstalled Chromium instead of downloading one.
const executablePath = process.env.PW_CHROMIUM_PATH;

/**
 * E2E tests run against the production build (`vite preview`), the same bundle users get, built
 * in mode `e2e` only to add a test campaign the app plays no real one for (`findCampaign`).
 * `pnpm e2e` runs every spec once: the accessibility checks in `accessibility`, every flow (the
 * specs outside `e2e/shots/`) in `flow-picture` and every spec in `e2e/shots/` in `screenshot`
 * and `screenshot-phone`, the last three photographing each test as it ends and, with
 * `GOLDENS=1` (CI), comparing it with its committed golden. The preview also runs those three
 * (`pnpm e2e:pictures`); `screencast` re-runs the flows whose end state the PR changes, slowed
 * down and recorded (`pnpm e2e:screencast`, see docs/automation.md).
 */
export default defineConfig<PictureOptions>({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // One golden per test and project, named after the test, so a PR's changed goldens name the
  // screens it changed (e2e/fixtures/test.ts compares them).
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{testName}{ext}',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The app's service worker takes over the page in the middle of a test (autoUpdate) and
    // then fetches the card pictures itself; on a busy runner some of those loads failed and
    // their tiles kept the pattern, so the same flow ended in different pictures.
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'accessibility',
      testMatch: /accessibility\.spec\.ts$/,
      use: { ...tablet, launchOptions: { executablePath } },
    },
    {
      name: RECORDING_PROJECTS.flowPictures,
      testIgnore: notFlows,
      outputDir: 'test-results/flow-picture',
      use: { ...tablet, ...picture, launchOptions: { executablePath } },
    },
    {
      name: RECORDING_PROJECTS.flows,
      testIgnore: notFlows,
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
      testMatch: shotSpecs,
      outputDir: 'test-results/screenshot',
      use: { ...tablet, ...picture, launchOptions: { executablePath } },
    },
    {
      name: RECORDING_PROJECTS.phoneShots,
      testMatch: shotSpecs,
      outputDir: 'test-results/screenshot-phone',
      use: { ...phone, ...picture, launchOptions: { executablePath } },
    },
  ],
  webServer: {
    command: 'pnpm build --mode e2e && pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
