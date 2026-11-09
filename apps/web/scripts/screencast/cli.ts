/**
 * Command-line entry for the PR screencasts, run with plain `node` (type stripping) by
 * `.github/workflows/preview.yml`:
 *
 *   node cli.ts flows <pictures.json> <base.json>
 *     (Each report may also be a directory holding one report per shard.)
 *     Prints the `--grep` pattern for the flows to record: those whose end state in
 *     `pictures.json` (this PR's `e2e:pictures` run) differs from `base.json` (the base commit's),
 *     at most SCREENCAST_LIMIT of them, on one line; nothing when no flow changed.
 *   node cli.ts render <pictures.json> <base.json> <recording.json> <outDir> <baseUrl> <pictureBaseUrl> <version>
 *     Converts the passing video of every changed flow in `recording.json` (the `e2e:screencast`
 *     run) into `<outDir>/<slug>.gif` and `.webm`, copies every changed passing screenshot to
 *     `<outDir>/<slug>-<device>.png`, adds the player page (`player.html`, listing the recorded
 *     flows) and writes the PR description section to `<outDir>/section.md`, with pictures
 *     linked from `pictureBaseUrl` and the player from `baseUrl`. Each picture shown also leaves
 *     the PR's and the base's copy and their pixel difference in `<outDir>/diff/`.
 *   node cli.ts splice <body.md> <section.md>
 *     Prints the PR description with the screencast section replaced.
 */
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import {
  changedFlows,
  flowGrep,
  flowVideos,
  SCREENCAST_LIMIT,
  gifArgs,
  joinReports,
  playerPage,
  renderSection,
  replaceSection,
  screenshots,
  SHOT_DEVICE_NAMES,
  shotFile,
} from './screencasts.ts';
import type { BaseRun, PlaywrightReport } from './screencasts.ts';

function flows(picturesPath: string, baseReportPath: string): void {
  const changed = changedFlows(readReport(picturesPath, 'this PR'), baseRun(baseReportPath));
  if (changed.length > 0) process.stdout.write(`${flowGrep(changed.slice(0, SCREENCAST_LIMIT))}\n`);
}

function render(
  picturesPath: string,
  baseReportPath: string,
  recordingPath: string,
  outDir: string,
  baseUrl: string,
  pictureBaseUrl: string,
  version: string,
): void {
  diffDir = join(outDir, 'diff');
  const pictures = readReport(picturesPath, 'this PR');
  const base = baseRun(baseReportPath);
  const changed = changedFlows(pictures, base);
  const flows = flowVideos(
    changed.slice(0, SCREENCAST_LIMIT),
    readReport(recordingPath, 'the recording'),
  );
  const moreFlows = changed.slice(SCREENCAST_LIMIT).map((flow) => flow.title);
  const shots = screenshots(pictures, base);
  mkdirSync(outDir, { recursive: true });
  for (const { slug, pictures } of shots) {
    for (const device of SHOT_DEVICE_NAMES) {
      const picture = pictures[device];
      if (picture) copyFileSync(picture, join(outDir, shotFile(slug, device)));
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
 * How many pixels two pictures of the same screen may differ in: antialiasing at the edge of a
 * curve sometimes lands a pixel or two differently from run to run. The smallest real change (a
 * digit) covers far more.
 */
const NOISE_PIXELS = 20;

/**
 * Whether two PNGs look the same. Pixels may differ slightly: the playmat's faint lines don't
 * render byte-identically from run to run, so this uses Playwright's own default tolerance, and
 * up to {@link NOISE_PIXELS} pixels may differ beyond it.
 */
function samePicture(headPath: string, basePath: string): boolean {
  if (!existsSync(basePath)) return false;
  try {
    const head = PNG.sync.read(readFileSync(headPath));
    const base = PNG.sync.read(readFileSync(basePath));
    if (head.width !== base.width || head.height !== base.height) return false;
    const diff = new PNG({ width: head.width, height: head.height });
    const differing = pixelmatch(head.data, base.data, diff.data, head.width, head.height, {
      threshold: 0.2,
    });
    if (differing <= NOISE_PIXELS) return true;
    keepDifference(headPath, basePath, diff, differing);
    return false;
  } catch (error) {
    console.warn(`Could not compare ${headPath} with ${basePath}; showing it:`, error);
    return false;
  }
}

/**
 * Where `render` keeps, for each picture it shows, the base's picture and pixelmatch's map of the
 * differing pixels next to the PR's (`DIFF_DIR` under its output, published with the preview), so
 * a picture shown without a visible change can be checked against what it was compared with.
 */
let diffDir: string | undefined;
let diffCount = 0;

function keepDifference(headPath: string, basePath: string, diff: PNG, differing: number): void {
  // stderr: `flows` prints its pattern on stdout.
  console.warn(`${differing} pixels differ: ${headPath}`);
  if (diffDir === undefined) return;
  diffCount += 1;
  const name = `${String(diffCount).padStart(3, '0')}-${differing}`;
  mkdirSync(diffDir, { recursive: true });
  copyFileSync(headPath, join(diffDir, `${name}-pr.png`));
  copyFileSync(basePath, join(diffDir, `${name}-base.png`));
  writeFileSync(join(diffDir, `${name}-diff.png`), PNG.sync.write(diff));
}

function baseRun(path: string): BaseRun {
  return { report: readReport(path, 'the base commit'), samePicture };
}

/**
 * A run's report, or an empty one when the run broke off before writing a whole report (or, for
 * the recording, didn't run because no flow changed): on the base, every spec is then shown.
 * `path` may also be a directory of reports, one per shard of a sharded run (`--shard`), which
 * are joined into one; a shard whose report is missing or broken just leaves out its specs.
 */
function readReport(path: string, run: string): PlaywrightReport {
  if (!existsSync(path)) return {};
  if (!statSync(path).isDirectory()) return readReportFile(path, run);
  const shards = readdirSync(path)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readReportFile(join(path, name), run));
  return joinReports(shards);
}

function readReportFile(path: string, run: string): PlaywrightReport {
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
if (command === 'flows' && args.length === 2) {
  const [picturesPath, baseReportPath] = args as [string, string];
  flows(picturesPath, baseReportPath);
} else if (command === 'render' && args.length === 7) {
  const [picturesPath, baseReportPath, recordingPath, outDir, baseUrl, pictureBaseUrl, version] =
    args as [string, string, string, string, string, string, string];
  render(picturesPath, baseReportPath, recordingPath, outDir, baseUrl, pictureBaseUrl, version);
} else if (command === 'splice' && args.length === 2) {
  const [bodyPath, sectionPath] = args as [string, string];
  splice(bodyPath, sectionPath);
} else {
  console.error(
    'usage: cli.ts flows <pictures> <base> | render <pictures> <base> <recording> <outDir> <baseUrl> <pictureBaseUrl> <version> | splice <body> <section>',
  );
  process.exit(1);
}
