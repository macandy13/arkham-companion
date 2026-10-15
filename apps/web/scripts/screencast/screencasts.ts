/**
 * Pure helpers behind the PR screencasts: pick the flow videos out of a Playwright JSON
 * report, build the ffmpeg arguments that turn them into GIFs, and render the Markdown
 * section the preview workflow writes into the PR description.
 * The side effects (ffmpeg, files) live in `cli.ts`.
 */

/**
 * Delay Playwright adds before every action while recording (`slowMo`), so a viewer can
 * follow each step. The GIF frame rate is derived from it: each UI state is held for at
 * least this long, so one frame per step is enough and keeps the GIFs small.
 */
export const SCREENCAST_STEP_MS = 250;

/** Width the GIFs are scaled to; enough to read the UI inline in a PR description. */
export const GIF_WIDTH = 800;

/** How long the last frame is held before the GIF loops, so the end state is readable. */
export const GIF_END_HOLD_SECONDS = 2;

/** Markers that delimit the section owned by the preview workflow in the PR description. */
export const SECTION_START = '<!-- screencasts:start -->';
export const SECTION_END = '<!-- screencasts:end -->';

/** The subset of Playwright's JSON reporter output this module reads. */
export interface PlaywrightReport {
  readonly suites?: readonly ReportSuite[];
}

interface ReportSuite {
  readonly suites?: readonly ReportSuite[];
  readonly specs?: readonly ReportSpec[];
}

interface ReportSpec {
  readonly title: string;
  readonly tests: readonly {
    readonly results: readonly {
      readonly status: string;
      readonly attachments: readonly { readonly name: string; readonly path?: string }[];
    }[];
  }[];
}

/**
 * One recorded flow spec. `videoPath` is the `.webm` Playwright wrote, or `undefined`
 * when the flow did not pass (a failed run's video would show a broken flow).
 */
export interface FlowVideo {
  readonly title: string;
  readonly slug: string;
  readonly videoPath: string | undefined;
}

/** Flattens the report into one entry per spec, in report order, using the last passing attempt. */
export function flowVideos(report: PlaywrightReport): FlowVideo[] {
  return allSpecs(report.suites ?? []).map((spec) => ({
    title: spec.title,
    slug: slugify(spec.title),
    videoPath: passingVideo(spec),
  }));
}

function allSpecs(suites: readonly ReportSuite[]): ReportSpec[] {
  return suites.flatMap((suite) => [...(suite.specs ?? []), ...allSpecs(suite.suites ?? [])]);
}

function passingVideo(spec: ReportSpec): string | undefined {
  const passed = spec.tests.flatMap((test) => test.results).filter((r) => r.status === 'passed');
  return passed.at(-1)?.attachments.find((a) => a.name === 'video')?.path;
}

/** Lower-case, dash-separated file name for a test title (`App boots` → `app-boots`). */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * ffmpeg arguments that convert a recording into a looping GIF at one frame per
 * {@link SCREENCAST_STEP_MS}. A per-video palette keeps the flat UI colours crisp;
 * dithering is off because it only adds noise (and bytes) to flat colours.
 */
export function gifArgs({ input, output }: { input: string; output: string }): string[] {
  const fps = 1000 / SCREENCAST_STEP_MS;
  const filter = [
    `fps=${fps}`,
    `scale=${GIF_WIDTH}:-1:flags=lanczos`,
    `tpad=stop_mode=clone:stop_duration=${GIF_END_HOLD_SECONDS}`,
    'split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=none',
  ].join(',');
  return ['-y', '-loglevel', 'error', '-i', input, '-vf', filter, '-loop', '0', output];
}

/**
 * The Markdown section (including its markers) listing every flow with an inline GIF and a
 * link to the full-quality video. `version` (the commit) is appended as a query string
 * because file names stay the same across pushes and GitHub's image proxy caches by URL.
 */
export function renderSection({
  flows,
  baseUrl,
  version,
}: {
  flows: readonly FlowVideo[];
  baseUrl: string;
  version: string;
}): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const entries = flows.map((flow) => {
    const heading = `### ${flow.title}`;
    if (!flow.videoPath) return `${heading}\n\n_Not recorded: the flow failed, see the E2E check._`;
    const gif = `${base}${flow.slug}.gif?v=${version}`;
    const webm = `${base}${flow.slug}.webm?v=${version}`;
    return `${heading}\n\n![${flow.title}](${gif})\n\n[Full-quality video](${webm})`;
  });
  const intro = `_Recorded from ${version} by the PR preview workflow; updated on every push that changes \`apps/web\`._`;
  return [SECTION_START, '## Screencasts', intro, ...entries, SECTION_END].join('\n\n');
}

/**
 * Replaces the marked section in a PR description with `section`, or appends it when the
 * description has no markers yet (e.g. the template section was deleted). Text outside the
 * markers is the author's and stays untouched.
 */
export function replaceSection(body: string, section: string): string {
  const start = body.indexOf(SECTION_START);
  const end = body.indexOf(SECTION_END, start);
  if (start === -1 || end === -1)
    return body.trimEnd() ? `${body.trimEnd()}\n\n${section}\n` : `${section}\n`;
  return body.slice(0, start) + section + body.slice(end + SECTION_END.length);
}
