/**
 * Claude Code Stop hook (wired in `.claude/settings.json`).
 *
 * Before Claude ends a turn that changed code, runs `pnpm typecheck && pnpm lint && pnpm test`.
 * On failure it exits with code 2 and writes the errors to stderr, which Claude Code feeds back
 * so Claude fixes them before finishing.
 *
 * It does nothing when no relevant file differs from `main`, and it never blocks twice in a
 * row (`stop_hook_active`), so a problem Claude cannot fix does not trap the session in a loop.
 *
 * Runs with Node's built-in TypeScript support (Node ≥ 22.18), so it needs no dependencies.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The part of the Stop hook's JSON input this script uses. */
interface StopHookInput {
  /** True when Claude is already continuing because of an earlier Stop hook block. */
  stop_hook_active?: boolean;
}

/** Exit code that tells Claude Code to block stopping and show stderr to Claude. */
const blockStop = 2;
const relevantFile = /\.(ts|tsx|js|mjs|cjs|json|ya?ml|css|html|md)$/;
const checks = [
  ['pnpm', 'typecheck'],
  ['pnpm', 'lint'],
  ['pnpm', 'test'],
] as const;
const maxReportedLines = 60;

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

/** Parses the hook input from stdin; anything unreadable counts as a first stop. */
function readInput(): StopHookInput {
  try {
    return JSON.parse(readFileSync(0, 'utf8')) as StopHookInput;
  } catch {
    return {};
  }
}

/** Runs a git command in the project and returns its stdout lines (empty on failure). */
function gitLines(...args: string[]): string[] {
  const result = spawnSync('git', args, { cwd: projectDir, encoding: 'utf8' });
  if (result.status !== 0) return [];
  return result.stdout.split('\n').filter(Boolean);
}

/** Files that differ from `main`: committed on this branch, uncommitted, or untracked. */
function changedFiles(): string[] {
  const base = gitLines('merge-base', 'HEAD', 'origin/main')[0] ?? 'HEAD';
  const files = [
    ...gitLines('diff', '--name-only', base),
    ...gitLines('diff', '--name-only'),
    ...gitLines('ls-files', '--others', '--exclude-standard'),
  ];
  return [...new Set(files)].filter((file) => relevantFile.test(file));
}

/** Runs the checks in order and returns the combined output of the first failing one. */
function firstFailure(): string | undefined {
  for (const [command, ...args] of checks) {
    const result = spawnSync(command, args, { cwd: projectDir, encoding: 'utf8' });
    if (result.status !== 0) {
      return `$ ${command} ${args.join(' ')}\n${result.stdout}${result.stderr}`;
    }
  }
  return undefined;
}

function main(): number {
  if (readInput().stop_hook_active) return 0;
  if (changedFiles().length === 0) return 0;

  if (!existsSync(join(projectDir, 'node_modules'))) {
    spawnSync('pnpm', ['install', '--frozen-lockfile'], { cwd: projectDir, stdio: 'ignore' });
  }

  const failure = firstFailure();
  if (failure === undefined) return 0;

  const tail = failure.trimEnd().split('\n').slice(-maxReportedLines).join('\n');
  process.stderr.write(
    'Checks failed (pnpm typecheck && pnpm lint && pnpm test). Fix these before finishing:\n' +
      `${tail}\n(Formatting only? Run: pnpm format)\n`,
  );
  return blockStop;
}

process.exit(main());
