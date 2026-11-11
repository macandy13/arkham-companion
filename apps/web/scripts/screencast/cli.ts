/**
 * Command-line entry for the PR screencasts, run with plain `node` (type stripping) in `apps/web`
 * by `.github/workflows/preview.yml`. What a PR shows is the goldens (`e2e/__screenshots__`) it
 * changes between `<base>` and `<head>` (git revisions), named from `<list.json>`, a
 * `playwright test --list --reporter=json` run of the golden projects:
 *
 *   node cli.ts flows <list.json> <base> <head>
 *     Prints the `--grep` pattern for the flows to record: those whose end-state golden the PR
 *     adds or rewrites, at most SCREENCAST_LIMIT of them, on one line; nothing when none did.
 *   node cli.ts render <list.json> <base> <head> <recording.json> <outDir> <baseUrl> <pictureBaseUrl> <version>
 *     Converts the passing video of every changed flow in `recording.json` (the `e2e:screencast`
 *     run) into `<outDir>/<slug>.gif` and `.webm`, writes each changed shot golden as it is on
 *     either side to `<outDir>/<slug>-<device>-<before|after>.png`, adds the player page
 *     (`player.html`, listing the recorded flows) and writes the PR description section to
 *     `<outDir>/section.md`, with pictures linked from `pictureBaseUrl` and the player from
 *     `baseUrl`.
 *   node cli.ts splice <body.md> <section.md>
 *     Prints the PR description with the screencast section replaced.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  changedFlows,
  changedShots,
  flowGrep,
  flowVideos,
  GOLDEN_DIR,
  goldenChanges,
  gifArgs,
  listedTests,
  playerPage,
  renderSection,
  replaceSection,
  SCREENCAST_LIMIT,
  SHOT_DEVICE_NAMES,
  shotFile,
} from './screencasts.ts';
import type { GoldenChange, GoldenSide, ListedTest, PlaywrightReport } from './screencasts.ts';

function flows(listPath: string, base: string, head: string): void {
  const changed = changedFlows(changesBetween(base, head), readListed(listPath));
  if (changed.length > 0) process.stdout.write(`${flowGrep(changed.slice(0, SCREENCAST_LIMIT))}\n`);
}

function render(
  listPath: string,
  revisions: Readonly<Record<GoldenSide, string>>,
  recordingPath: string,
  outDir: string,
  baseUrl: string,
  pictureBaseUrl: string,
  version: string,
): void {
  const changes = changesBetween(revisions.before, revisions.after);
  const listed = readListed(listPath);
  const changed = changedFlows(changes, listed);
  const flows = flowVideos(
    changed.slice(0, SCREENCAST_LIMIT),
    readReport(recordingPath, 'the recording'),
  );
  const moreFlows = changed.slice(SCREENCAST_LIMIT).map((flow) => flow.title);
  const shots = changedShots(changes, listed);
  mkdirSync(outDir, { recursive: true });
  for (const { slug, pictures } of shots) {
    for (const device of SHOT_DEVICE_NAMES) {
      for (const side of ['before', 'after'] as const) {
        const path = pictures[device]?.[side];
        if (path)
          writeFileSync(join(outDir, shotFile(slug, device, side)), gitShow(revisions[side], path));
      }
    }
  }
  for (const { slug, videoPath } of flows) {
    if (!videoPath) continue;
    copyFileSync(videoPath, join(outDir, `${slug}.webm`));
    execFileSync('ffmpeg', gifArgs({ input: videoPath, output: join(outDir, `${slug}.gif`) }), {
      stdio: 'inherit',
    });
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const template = readFileSync(join(here, 'player.html'), 'utf8');
  writeFileSync(join(outDir, 'player.html'), playerPage(template, { flows, version }));
  writeFileSync(
    join(outDir, 'section.md'),
    renderSection({ flows, shots, moreFlows, baseUrl, pictureBaseUrl, version }),
  );
}

/**
 * The goldens that differ between the two revisions. Renames are read as a deletion and an
 * addition, since a renamed test's golden is another test's picture.
 */
function changesBetween(base: string, head: string): GoldenChange[] {
  const nameStatus = execFileSync(
    'git',
    [
      '-c',
      'core.quotePath=false',
      'diff',
      '--name-status',
      '--no-renames',
      '--relative',
      base,
      head,
      '--',
      GOLDEN_DIR,
    ],
    { encoding: 'utf8' },
  );
  return goldenChanges(nameStatus);
}

/** The bytes of `path` (relative to `apps/web`) at `revision`. */
function gitShow(revision: string, path: string): Buffer {
  return execFileSync('git', ['show', `${revision}:./${path}`], { maxBuffer: 64 * 1024 * 1024 });
}

function readListed(path: string): ListedTest[] {
  return listedTests(readReport(path, 'the test list'));
}

/**
 * A run's report, or an empty one when the run broke off before writing a whole report (or, for
 * the recording, didn't run because no flow changed). Without a test list the goldens are named
 * by their file names.
 */
function readReport(path: string, run: string): PlaywrightReport {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as PlaywrightReport;
  } catch (error) {
    console.warn(`Ignoring the report of ${run} in ${path}:`, error);
    return {};
  }
}

function splice(bodyPath: string, sectionPath: string): void {
  const body = readFileSync(bodyPath, 'utf8');
  const section = readFileSync(sectionPath, 'utf8');
  process.stdout.write(replaceSection(body, section));
}

const [command, ...args] = process.argv.slice(2);
if (command === 'flows' && args.length === 3) {
  const [listPath, base, head] = args as [string, string, string];
  flows(listPath, base, head);
} else if (command === 'render' && args.length === 8) {
  const [listPath, base, head, recordingPath, outDir, baseUrl, pictureBaseUrl, version] = args as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  render(
    listPath,
    { before: base, after: head },
    recordingPath,
    outDir,
    baseUrl,
    pictureBaseUrl,
    version,
  );
} else if (command === 'splice' && args.length === 2) {
  const [bodyPath, sectionPath] = args as [string, string];
  splice(bodyPath, sectionPath);
} else {
  console.error(
    'usage: cli.ts flows <list> <base> <head> | render <list> <base> <head> <recording> <outDir> <baseUrl> <pictureBaseUrl> <version> | splice <body> <section>',
  );
  process.exit(1);
}
