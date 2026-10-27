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
 * One screenshot spec (tagged `@shot`). `pictures` holds, per device, the `.png` Playwright
 * took when the test ended, or `undefined` when the spec did not pass on that device.
 */
export interface Screenshot {
  readonly title: string;
  readonly slug: string;
  readonly pictures: Readonly<Record<ShotDevice, string | undefined>>;
}

/**
 * The Playwright projects that record for the PR (`playwright.config.ts`): `screencast` films
 * the `@flow` specs, `screenshot` and `screenshot-phone` photograph the `@shot` specs as they
 * end, on the tablet and on a phone. All run in one report, so each spec is read from its own
 * projects only.
 */
export const RECORDING_PROJECTS = {
  flows: 'screencast',
  shots: 'screenshot',
  phoneShots: 'screenshot-phone',
} as const;

/** The screens every `@shot` spec is photographed on, shown side by side in the PR. */
export type ShotDevice = 'desktop' | 'phone';

/**
 * Per device: the project that photographs it, its column heading, and the width it is shown
 * at. The widths give both pictures about the same height (tablet 1180×820, phone 390×844),
 * and side by side they still fit the PR description's column.
 */
export const SHOT_DEVICES: Readonly<
  Record<ShotDevice, { project: string; label: string; width: number }>
> = {
  desktop: { project: RECORDING_PROJECTS.shots, label: 'Desktop', width: 560 },
  phone: { project: RECORDING_PROJECTS.phoneShots, label: 'Phone', width: 180 },
};

/** The devices in column order. */
export const SHOT_DEVICE_NAMES = Object.keys(SHOT_DEVICES) as ShotDevice[];

/** The published file name of one device's picture of a shot (`map-tabs-phone.png`). */
export function shotFile(slug: string, device: ShotDevice): string {
  return `${slug}-${device}.png`;
}

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
  return changedSpecs(report, [RECORDING_PROJECTS.flows], base).map((spec) => ({
    title: spec.title,
    slug: slugify(spec.title),
    videoPath: passingAttachment(spec, RECORDING_PROJECTS.flows, 'video'),
  }));
}

/**
 * Flattens the report into one entry per screenshot spec, in report order, using the last
 * passing attempt per device, leaving out shots whose pictures `base` shows unchanged on every
 * device.
 */
export function screenshots(report: PlaywrightReport, base: BaseRun = NO_BASE): Screenshot[] {
  const projects = SHOT_DEVICE_NAMES.map((device) => SHOT_DEVICES[device].project);
  return changedSpecs(report, projects, base).map((spec) => ({
    title: spec.title,
    slug: slugify(spec.title),
    pictures: Object.fromEntries(
      SHOT_DEVICE_NAMES.map((device) => [
        device,
        passingAttachment(spec, SHOT_DEVICES[device].project, 'screenshot'),
      ]),
    ) as Record<ShotDevice, string | undefined>,
  }));
}

/**
 * The specs `projects` record, in report order, except those whose last picture in every one of
 * the projects is the same in `base`.
 */
function changedSpecs(
  report: PlaywrightReport,
  projects: readonly string[],
  base: BaseRun,
): ReportSpec[] {
  const baseSpecs = new Map(specsIn(base.report, projects).map((spec) => [specKey(spec), spec]));
  return specsIn(report, projects).filter((spec) =>
    projects.some((project) => {
      if (!spec.tests.some((test) => test.projectName === project)) return false;
      const headPicture = passingAttachment(spec, project, 'screenshot');
      const baseSpec = baseSpecs.get(specKey(spec));
      const basePicture = baseSpec && passingAttachment(baseSpec, project, 'screenshot');
      // A missing picture on either side (failed run, spec or device new to the PR) can't prove "unchanged".
      return !headPicture || !basePicture || !base.samePicture(headPicture, basePicture);
    }),
  );
}

/**
 * One spec per file and title that `projects` ran, in report order. Playwright lists a spec once
 * per project, so the runs of the same spec are merged into one entry holding all their tests.
 */
function specsIn(report: PlaywrightReport, projects: readonly string[]): ReportSpec[] {
  const merged = new Map<string, ReportSpec>();
  for (const spec of allSpecs(report.suites ?? [])) {
    const tests = spec.tests.filter((test) => projects.includes(test.projectName));
    if (tests.length === 0) continue;
    const earlier = merged.get(specKey(spec));
    merged.set(specKey(spec), { ...spec, tests: [...(earlier?.tests ?? []), ...tests] });
  }
  return [...merged.values()];
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
 * The Markdown section (including its markers) listing every screenshot inline, desktop and
 * phone side by side, then every
 * flow with an inline GIF and a link to the player page, which plays the full-quality video
 * with pause, seeking and speed; just the markers when nothing is tagged, which empties a
 * section an earlier push wrote. `version` (the commit) is appended as a query string
 * because file names stay the same across pushes and GitHub's image proxy caches by URL.
 */
export function renderSection({
  flows,
  shots,
  baseUrl,
  version,
}: {
  flows: readonly FlowVideo[];
  shots: readonly Screenshot[];
  baseUrl: string;
  version: string;
}): string {
  // Nothing tagged means the PR changed no flow or situation: the markers stay, so a later push can fill them.
  if (flows.length === 0 && shots.length === 0) return [SECTION_START, SECTION_END].join('\n');
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const shotEntries = shots.map((shot) => {
    const heading = `### ${shot.title}`;
    const notTaken = 'Not taken: the spec failed, see the E2E check.';
    if (SHOT_DEVICE_NAMES.every((device) => !shot.pictures[device]))
      return `${heading}\n\n_${notTaken}_`;
    // HTML rather than a Markdown table: only `width` keeps both pictures side by side at sizes that match.
    const cell = (device: ShotDevice) => {
      const { label, width } = SHOT_DEVICES[device];
      if (!shot.pictures[device]) return `<td>${notTaken}</td>`;
      const src = `${base}${shotFile(shot.slug, device)}?v=${version}`;
      return `<td><img src="${src}" alt="${label}" width="${width}"></td>`;
    };
    const headings = SHOT_DEVICE_NAMES.map((device) => `<th>${SHOT_DEVICES[device].label}</th>`);
    return [
      heading,
      '',
      '<table>',
      `<tr>${headings.join('')}</tr>`,
      `<tr>${SHOT_DEVICE_NAMES.map(cell).join('')}</tr>`,
      '</table>',
    ].join('\n');
  });
  const flowEntries = flows.map((flow) => {
    const heading = `### ${flow.title}`;
    if (!flow.videoPath) return `${heading}\n\n_Not recorded: the flow failed, see the E2E check._`;
    const gif = `${base}${flow.slug}.gif?v=${version}`;
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
