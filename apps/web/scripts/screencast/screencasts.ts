/**
 * Pure helpers behind the PR screencasts and screenshots: pick the flow videos and the
 * screenshots out of a Playwright JSON report, build the ffmpeg arguments that turn the videos
 * into GIFs, and render the Markdown section the preview workflow writes into the PR
 * description.
 * The side effects (ffmpeg, files) live in `cli.ts`.
 */

/**
 * Delay Playwright adds before every action while recording (`slowMo`), so a viewer can
 * follow each step. The GIF frame rate is derived from it: each UI state is held for at
 * least this long, so one frame per step is enough and keeps the GIFs small.
 */
export const SCREENCAST_STEP_MS = 250;

/**
 * How much slower than recorded the screencasts play by default: at recording speed a step
 * flashes by too fast to read. The GIF holds each frame this many times longer, and the
 * player page (`player.html`) starts at `1 / SCREENCAST_SLOWDOWN` speed.
 */
export const SCREENCAST_SLOWDOWN = 4;

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
  /** The spec file, relative to the test directory; identifies the spec together with `title`. */
  readonly file?: string;
  readonly tests: readonly {
    readonly projectName: string;
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

/**
 * One screenshot spec (tagged `@shot`). `imagePath` is the `.png` Playwright took when the
 * test ended, or `undefined` when the spec did not pass.
 */
export interface Screenshot {
  readonly title: string;
  readonly slug: string;
  readonly imagePath: string | undefined;
}

/**
 * The Playwright projects that record for the PR (`playwright.config.ts`): `screencast` films
 * the `@flow` specs, `screenshot` photographs the `@shot` specs as they end. Both run in one
 * report, so each spec is read from its own project only.
 */
export const RECORDING_PROJECTS = { flows: 'screencast', shots: 'screenshot' } as const;

/**
 * The base commit's run of the same projects (`playwright test` on the merge commit's first
 * parent) and how to compare two picture files. A spec the base also records is left out when
 * its last picture (the shot, or a flow's end state) is the same on both sides: the PR didn't
 * change it, an earlier PR only left its tag on `main`. Without a base, every tagged spec shows.
 */
export interface BaseRun {
  readonly report: PlaywrightReport;
  readonly samePicture: (headPath: string, basePath: string) => boolean;
}

const NO_BASE: BaseRun = { report: {}, samePicture: () => false };

/**
 * Flattens the report into one entry per flow spec, in report order, using the last passing
 * attempt, leaving out flows whose end state `base` shows unchanged.
 */
export function flowVideos(report: PlaywrightReport, base: BaseRun = NO_BASE): FlowVideo[] {
  return changedSpecs(report, RECORDING_PROJECTS.flows, base).map((spec) => ({
    title: spec.title,
    slug: slugify(spec.title),
    videoPath: passingAttachment(spec, RECORDING_PROJECTS.flows, 'video'),
  }));
}

/**
 * Flattens the report into one entry per screenshot spec, in report order, using the last
 * passing attempt, leaving out shots whose picture `base` shows unchanged.
 */
export function screenshots(report: PlaywrightReport, base: BaseRun = NO_BASE): Screenshot[] {
  return changedSpecs(report, RECORDING_PROJECTS.shots, base).map((spec) => ({
    title: spec.title,
    slug: slugify(spec.title),
    imagePath: passingAttachment(spec, RECORDING_PROJECTS.shots, 'screenshot'),
  }));
}

function changedSpecs(report: PlaywrightReport, project: string, base: BaseRun): ReportSpec[] {
  const basePictures = new Map(
    specsIn(base.report, project).map((spec) => [
      specKey(spec),
      passingAttachment(spec, project, 'screenshot'),
    ]),
  );
  return specsIn(report, project).filter((spec) => {
    const headPicture = passingAttachment(spec, project, 'screenshot');
    const basePicture = basePictures.get(specKey(spec));
    // A missing picture on either side (failed run, spec new to the PR) can't prove "unchanged".
    return !headPicture || !basePicture || !base.samePicture(headPicture, basePicture);
  });
}

function specsIn(report: PlaywrightReport, project: string): ReportSpec[] {
  return allSpecs(report.suites ?? []).filter((spec) =>
    spec.tests.some((test) => test.projectName === project),
  );
}

// The leaf title is enough: specs repeating a title in one file would already collide on their slug.
function specKey(spec: ReportSpec): string {
  return `${spec.file ?? ''} › ${spec.title}`;
}

function allSpecs(suites: readonly ReportSuite[]): ReportSpec[] {
  return suites.flatMap((suite) => [...(suite.specs ?? []), ...allSpecs(suite.suites ?? [])]);
}

function passingAttachment(spec: ReportSpec, project: string, name: string): string | undefined {
  const passed = spec.tests
    .filter((test) => test.projectName === project)
    .flatMap((test) => test.results)
    .filter((r) => r.status === 'passed');
  return passed.at(-1)?.attachments.find((a) => a.name === name)?.path;
}

/** Lower-case, dash-separated file name for a test title (`App boots` → `app-boots`). */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * ffmpeg arguments that convert a recording into a looping GIF with one frame per
 * {@link SCREENCAST_STEP_MS}, each held {@link SCREENCAST_SLOWDOWN} times as long. Stretching
 * the timestamps after sampling slows the GIF without adding frames. A per-video palette keeps the flat UI colours crisp;
 * dithering is off because it only adds noise (and bytes) to flat colours.
 */
export function gifArgs({ input, output }: { input: string; output: string }): string[] {
  const fps = 1000 / SCREENCAST_STEP_MS;
  const filter = [
    `fps=${fps}`,
    `setpts=${SCREENCAST_SLOWDOWN}*PTS`,
    `scale=${GIF_WIDTH}:-1:flags=lanczos`,
    `tpad=stop_mode=clone:stop_duration=${GIF_END_HOLD_SECONDS}`,
    'split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=none',
  ].join(',');
  return ['-y', '-loglevel', 'error', '-i', input, '-vf', filter, '-loop', '0', output];
}

/**
 * The Markdown section (including its markers) listing every screenshot inline, then every
 * flow with an inline GIF and a link to the player page, which plays the full-quality video
 * with pause, seeking and speed; just the markers when nothing is tagged, which empties a
 * section an earlier push wrote. Pictures are linked from `pictureBaseUrl` (the gh-pages
 * branch on raw.githubusercontent.com, which serves a push at once, while Pages takes a minute
 * or more to deploy it; the workflow pins the branch to the commit it pushed), the player from
 * `baseUrl` (Pages, the only host that serves it as a page). `version` (the commit) is appended
 * as a query string because the player's file name stays the same across pushes and GitHub's
 * image proxy and Pages cache by URL.
 */
export function renderSection({
  flows,
  shots,
  baseUrl,
  pictureBaseUrl,
  version,
}: {
  flows: readonly FlowVideo[];
  shots: readonly Screenshot[];
  baseUrl: string;
  pictureBaseUrl: string;
  version: string;
}): string {
  // Nothing tagged means the PR changed no flow or situation: the markers stay, so a later push can fill them.
  if (flows.length === 0 && shots.length === 0) return [SECTION_START, SECTION_END].join('\n');
  const withSlash = (url: string) => (url.endsWith('/') ? url : `${url}/`);
  const base = withSlash(baseUrl);
  const pictures = withSlash(pictureBaseUrl);
  const shotEntries = shots.map((shot) => {
    const heading = `### ${shot.title}`;
    if (!shot.imagePath) return `${heading}\n\n_Not taken: the spec failed, see the E2E check._`;
    return `${heading}\n\n![${shot.title}](${pictures}${shot.slug}.png?v=${version})`;
  });
  const flowEntries = flows.map((flow) => {
    const heading = `### ${flow.title}`;
    if (!flow.videoPath) return `${heading}\n\n_Not recorded: the flow failed, see the E2E check._`;
    const gif = `${pictures}${flow.slug}.gif?v=${version}`;
    const player = `${base}player.html?flow=${flow.slug}&v=${version}&speed=${1 / SCREENCAST_SLOWDOWN}`;
    return `${heading}\n\n![${flow.title}](${gif})\n\n[Play with pause and speed controls](${player})`;
  });
  const intro = `_Recorded from ${version} by the PR preview workflow; updated on every push that changes \`apps/web\`._`;
  return [
    SECTION_START,
    intro,
    ...(shots.length > 0 ? ['## Screenshots', ...shotEntries] : []),
    ...(flows.length > 0 ? ['## Screencasts', ...flowEntries] : []),
    SECTION_END,
  ].join('\n\n');
}

/** The placeholder in `player.html` that `playerPage` replaces with the recorded flows. */
export const PLAYER_PLACEHOLDER = "/* recorded flows */ { version: '', flows: {} }";

/**
 * The player page for one push: `template` (`player.html`) with the recorded flows (slug to
 * title) and `version` written in. The page plays only a flow listed here, so its query
 * string selects a known video instead of naming a URL. `<` is escaped so a title can never
 * close the script element.
 */
export function playerPage(
  template: string,
  { flows, version }: { flows: readonly FlowVideo[]; version: string },
): string {
  if (!template.includes(PLAYER_PLACEHOLDER))
    throw new Error(`player.html has no placeholder ${PLAYER_PLACEHOLDER}`);
  const recorded = Object.fromEntries(
    flows.filter((flow) => flow.videoPath).map((flow) => [flow.slug, flow.title]),
  );
  const data = JSON.stringify({ version, flows: recorded }).replaceAll('<', '\\u003c');
  return template.replace(PLAYER_PLACEHOLDER, () => data);
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
