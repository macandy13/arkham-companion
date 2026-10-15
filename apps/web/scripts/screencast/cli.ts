/**
 * Command-line entry for the PR screencasts, run with plain `node` (type stripping) by
 * `.github/workflows/preview.yml`:
 *
 *   node cli.ts render <report.json> <outDir> <baseUrl> <version>
 *     Converts every passing flow video into `<outDir>/<slug>.gif` and `.webm` and writes
 *     the PR description section to `<outDir>/section.md`.
 *   node cli.ts splice <body.md> <section.md>
 *     Prints the PR description with the screencast section replaced.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { flowVideos, gifArgs, renderSection, replaceSection } from './screencasts.ts';
import type { PlaywrightReport } from './screencasts.ts';

function render(reportPath: string, outDir: string, baseUrl: string, version: string): void {
  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as PlaywrightReport;
  const flows = flowVideos(report);
  mkdirSync(outDir, { recursive: true });
  for (const { slug, videoPath } of flows) {
    if (!videoPath) continue;
    copyFileSync(videoPath, join(outDir, `${slug}.webm`));
    execFileSync('ffmpeg', gifArgs({ input: videoPath, output: join(outDir, `${slug}.gif`) }), {
      stdio: 'inherit',
    });
  }
  writeFileSync(join(outDir, 'section.md'), renderSection({ flows, baseUrl, version }));
}

function splice(bodyPath: string, sectionPath: string): void {
  const body = readFileSync(bodyPath, 'utf8');
  const section = readFileSync(sectionPath, 'utf8');
  process.stdout.write(replaceSection(body, section));
}

const [command, ...args] = process.argv.slice(2);
if (command === 'render' && args.length === 4) {
  const [reportPath, outDir, baseUrl, version] = args as [string, string, string, string];
  render(reportPath, outDir, baseUrl, version);
} else if (command === 'splice' && args.length === 2) {
  const [bodyPath, sectionPath] = args as [string, string];
  splice(bodyPath, sectionPath);
} else {
  console.error(
    'usage: cli.ts render <report> <outDir> <baseUrl> <version> | splice <body> <section>',
  );
  process.exit(1);
}
