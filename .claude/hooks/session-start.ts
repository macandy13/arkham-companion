/**
 * Claude Code SessionStart hook (wired in `.claude/settings.json`).
 *
 * Fresh cloud sessions start without `node_modules`, so typecheck and tests would fail until
 * someone runs `pnpm install`. This hook installs dependencies when they are missing or older
 * than the lockfile, and exposes a preinstalled Chromium to Playwright via `CLAUDE_ENV_FILE`.
 *
 * Runs with Node's built-in TypeScript support (Node ≥ 22.18), because it must work before
 * any dependency is installed. Whatever it prints to stdout is added to the session context,
 * so it prints at most one short line.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const preinstalledBrowsers = '/opt/pw-browsers';

/** True when `node_modules` is missing or was installed from an older lockfile. */
function needsInstall(): boolean {
  const marker = join(projectDir, 'node_modules', '.modules.yaml');
  if (!existsSync(marker)) return true;
  return statSync(join(projectDir, 'pnpm-lock.yaml')).mtimeMs > statSync(marker).mtimeMs;
}

/** Path of a preinstalled Chromium binary, if the environment ships one. */
function findPreinstalledChromium(): string | undefined {
  if (!existsSync(preinstalledBrowsers)) return undefined;
  const dir = readdirSync(preinstalledBrowsers).find((name) => /^chromium-\d+$/.test(name));
  const binary = dir && join(preinstalledBrowsers, dir, 'chrome-linux', 'chrome');
  return binary && existsSync(binary) ? binary : undefined;
}

if (needsInstall()) {
  const result = spawnSync('pnpm', ['install', '--frozen-lockfile'], {
    cwd: projectDir,
    stdio: 'ignore',
  });
  console.log(
    result.status === 0
      ? 'Dependencies installed (pnpm install).'
      : 'pnpm install failed – run it manually before typecheck/test.',
  );
}

const chromium = findPreinstalledChromium();
const envFile = process.env.CLAUDE_ENV_FILE;
if (chromium && envFile) {
  appendFileSync(envFile, `export PW_CHROMIUM_PATH=${chromium}\n`);
}
