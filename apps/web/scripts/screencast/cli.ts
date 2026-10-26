/**
 * Command-line entry for the PR screencasts, run with plain `node` (type stripping) by
 * `.github/workflows/preview.yml`:
 *
 *   node cli.ts render <report.json> <base.json> <outDir> <baseUrl> <version>
 *     Converts every passing flow video into `<outDir>/<slug>.gif` and `.webm`, copies every
 *     passing screenshot to `<outDir>/<slug>.png`, adds the player page (`player.html`, listing
 *     the recorded flows) and writes the PR description section to `<outDir>/section.md` and
 *     `version` to `<outDir>/version.txt`, so the workflow can tell when Pages serves this push.
 *     Specs whose picture is the same in `base.json` (the base commit's run) are skipped.
 *   node cli.ts splice <body.md> <section.md>
 *     Prints the PR description with the screencast section replaced.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import {
  flowVideos,
  gifArgs,
  playerPage,
  renderSection,
  replaceSection,
  screenshots,
} from './screencasts.ts';
import type { BaseRun, PlaywrightReport } from './screencasts.ts';

function render(
  reportPath: string,
  baseReportPath: string,
  outDir: string,
  baseUrl: string,
  version: string,
): void {
  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as PlaywrightReport;
  const base: BaseRun = {
    report: readBaseReport(baseReportPath),
    samePicture,
  };
  const flows = flowVideos(report, base);
  const shots = screenshots(report, base);
  mkdirSync(outDir, { recursive: true });
  for (const { slug, imagePath } of shots) {
    if (imagePath) copyFileSync(imagePath, join(outDir, `${slug}.png`));
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
  writeFileSync(join(outDir, 'section.md'), renderSection({ flows, shots, baseUrl, version }));
  writeFileSync(join(outDir, 'version.txt'), `${version}\n`);
}

/**
 * Whether two PNGs look the same. Pixels may differ slightly: the playmat's faint lines don't
 * render byte-identically from run to run, so this uses Playwright's own default tolerance.
 */
function samePicture(headPath: string, basePath: string): boolean {
  if (!existsSync(basePath)) return false;
  try {
    const head = PNG.sync.read(readFileSync(headPath));
    const base = PNG.sync.read(readFileSync(basePath));
    if (head.width !== base.width || head.height !== base.height) return false;
    const differing = pixelmatch(head.data, base.data, undefined, head.width, head.height, {
      threshold: 0.2,
    });
    return differing === 0;
  } catch (error) {
    console.warn(`Could not compare ${headPath} with ${basePath}; showing it:`, error);
    return false;
  }
}

/** The base run's report, or none when the run broke off before writing a whole report. */
function readBaseReport(path: string): PlaywrightReport {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as PlaywrightReport;
  } catch (error) {
    console.warn(`Ignoring the base run's report ${path}; every tagged spec is shown:`, error);
    return {};
  }
}

function splice(bodyPath: string, sectionPath: string): void {
  const body = readFileSync(bodyPath, 'utf8');
  const section = readFileSync(sectionPath, 'utf8');
  process.stdout.write(replaceSection(body, section));
}

const [command, ...args] = process.argv.slice(2);
if (command === 'render' && args.length === 5) {
  const [reportPath, baseReportPath, outDir, baseUrl, version] = args as [
    string,
    string,
    string,
    string,
    string,
  ];
  render(reportPath, baseReportPath, outDir, baseUrl, version);
} else if (command === 'splice' && args.length === 2) {
  const [bodyPath, sectionPath] = args as [string, string];
  splice(bodyPath, sectionPath);
} else {
  console.error(
    'usage: cli.ts render <report> <base> <outDir> <baseUrl> <version> | splice <body> <section>',
  );
  process.exit(1);
}
