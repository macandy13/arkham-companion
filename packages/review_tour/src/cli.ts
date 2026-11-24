/**
 * Command-line entry for the review tour, run with plain `node` (type stripping) by
 * `.github/workflows/review-tour.yml` in a checkout that has both commits. Reads the tour block
 * from the PR body and writes the page to `<out>/index.html`; writes nothing when the body has
 * no block, and fails with the reason when the block is malformed or points at nothing. Prints the
 * page's summary ("4 stops · 1 question · …") as its last line.
 *
 *   node cli.ts --body <file> --title <PR title> --pr <number> --repo <owner/name>
 *     --base <sha> --head <sha> --out <dir>
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { cutStopLines, parseDiff, type FileDiff } from './diff_lines.ts';
import { GOLDEN_DIR, pictureVariants } from './pictures.ts';
import {
  renderPage,
  tourSummary,
  type StopCode,
  type StopContent,
  type StopPicture,
} from './render.ts';
import { parseTour, type CodeRef, type TourStop } from './tour.ts';

const required = { type: 'string', default: '' } as const;
const { values } = parseArgs({
  options: {
    body: required,
    title: required,
    pr: required,
    repo: required,
    base: required,
    head: required,
    out: required,
  },
});
const missing = Object.entries(values).filter(([, value]) => value === '');
if (missing.length > 0) {
  console.error(`missing options: ${missing.map(([name]) => `--${name}`).join(', ')}`);
  process.exit(1);
}
const { head, repo } = values;
// The PR's changes are relative to where it forked from the base branch, as GitHub's diff shows them.
const base = execFileSync('git', ['merge-base', values.base, head], { encoding: 'utf8' }).trim();
const prUrl = `https://github.com/${repo}/pull/${values.pr}`;

const tour = parseTour(readFileSync(values.body, 'utf8'));
if (tour === undefined) {
  console.log('The PR body has no review-tour block; no page.');
  process.exit(0);
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

const codeFiles = [...new Set(tour.stops.flatMap((stop) => stop.code.map((ref) => ref.file)))];
// Full context, so every head line of a file a stop shows comes with its change marks.
const diffs =
  codeFiles.length > 0
    ? parseDiff(git('diff', '-U1000000', '--no-renames', base, head, '--', ...codeFiles))
    : new Map<string, FileDiff>();
// NUL-separated, since git quotes paths with non-ASCII characters (test titles with ’) otherwise.
const goldens = (commit: string) =>
  new Set(git('ls-tree', '-r', '-z', '--name-only', commit, '--', GOLDEN_DIR).split('\0'));
const [baseGoldens, headGoldens] = [goldens(base), goldens(head)];
const changedGoldens = new Set(
  git('diff', '-z', '--name-only', '--no-renames', base, head, '--', GOLDEN_DIR).split('\0'),
);

function rawUrl(commit: string, path: string): string {
  return `https://raw.githubusercontent.com/${repo}/${commit}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

function stopCode(ref: CodeRef): StopCode {
  const diff = diffs.get(ref.file);
  const anchor = createHash('sha256').update(ref.file).digest('hex');
  const [first, last] = [ref.ranges[0], ref.ranges.at(-1)];
  return {
    file: ref.file,
    newFile: diff?.newFile ?? false,
    added: diff?.added ?? 0,
    removed: diff?.removed ?? 0,
    lines: cutStopLines(
      ref,
      diff,
      git('show', `${head}:${ref.file}`).replace(/\n$/, '').split('\n'),
    ),
    diffUrl: `${prUrl}/files#diff-${anchor}R${first?.from}-R${last?.to}`,
  };
}

/** A golden a stop or a piece of evidence names, for every device that has it. */
function pictureContent(golden: string | undefined): StopPicture[] {
  if (golden === undefined) return [];
  return pictureVariants(golden, baseGoldens, headGoldens).map((picture) => ({
    device: picture.device,
    changed: changedGoldens.has(picture.after ?? picture.before ?? ''),
    ...(picture.before !== undefined && { before: rawUrl(base, picture.before) }),
    ...(picture.after !== undefined && { after: rawUrl(head, picture.after) }),
  }));
}

function stopContent(stop: TourStop): StopContent {
  return { code: stop.code.map(stopCode), pictures: pictureContent(stop.picture) };
}

const stops = tour.stops.map(stopContent);
// Binary files (goldens) count as "-" in numstat and are left out, like the size budget does.
const allChanged = git('diff', '--numstat', '--no-renames', base, head)
  .split('\n')
  .map((line) => line.split('\t'))
  .reduce((sum, [added, removed]) => sum + (Number(added) || 0) + (Number(removed) || 0), 0);
const onTour = stops
  .flatMap((stop) => stop.code.flatMap((code) => code.lines))
  .filter((line) => line.kind === 'added' || line.kind === 'removed').length;

const page = {
  pr: { number: Number(values.pr), title: values.title, url: prUrl, headSha: head },
  tour,
  stops,
  evidence: tour.evidence.map((item) => pictureContent(item.picture)),
  changedLines: { all: allChanged, onTour },
};
mkdirSync(values.out, { recursive: true });
writeFileSync(join(values.out, 'index.html'), renderPage(page));
// The last line is the summary review-tour.yml puts in the PR comment that links the page.
console.log(tourSummary(page).join(' · '));
