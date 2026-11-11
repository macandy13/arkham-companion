/**
 * Pure helpers behind the PR screencasts and screenshots: read which committed goldens
 * (`e2e/__screenshots__`) a PR changes, name their tests from a `playwright test --list` report,
 * pick the flow videos out of the recording's report, build the ffmpeg arguments that turn the
 * videos into GIFs, and render the Markdown section the preview workflow writes into the PR
 * description.
 * The side effects (git, ffmpeg, files) live in `cli.ts`.
 */
import { createHash } from 'node:crypto';

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

/**
 * Most flows recorded per push. A change to something every screen shows (the app bar, a token)
 * changes the end state of nearly every flow, and recording them all slowed down would take
 * longer than the rest of the preview; the others are listed by name.
 */
export const SCREENCAST_LIMIT = 5;

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
  readonly title?: string;
  readonly suites?: readonly ReportSuite[];
  readonly specs?: readonly ReportSpec[];
}

interface ReportSpec {
  readonly title: string;
  /** The spec file, relative to the test directory; identifies the spec together with `title`. */
  readonly file?: string;
  readonly tests: readonly {
    readonly projectName: string;
    /** Absent in a `--list` report, which runs nothing. */
    readonly results?: readonly {
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
 * A flow spec whose end-state golden the PR changes, named by its file and title so its recording
 * can be found in the `screencast` run (`flowGrep` selects it there).
 */
export interface ChangedFlow {
  readonly title: string;
  readonly file?: string;
}

/**
 * A golden before and after the PR, as paths in the repository: `before` is missing for a golden
 * the PR adds, `after` for one it deletes.
 */
export interface GoldenPair {
  readonly before?: string;
  readonly after?: string;
}

/**
 * One screenshot spec (in `e2e/shots/`) whose golden the PR changes on at least one device.
 * `pictures` holds, per device, its golden before and after, or `undefined` where the PR leaves
 * that device's golden as it is.
 */
export interface Screenshot {
  readonly title: string;
  readonly slug: string;
  readonly pictures: Readonly<Record<ShotDevice, GoldenPair | undefined>>;
}

/**
 * The Playwright projects behind the preview (`playwright.config.ts`): `flow-picture` keeps a
 * golden of every flow spec's end state (outside `e2e/shots/`), `screenshot` and
 * `screenshot-phone` one of every shot spec, on the tablet and on a phone. The goldens a PR
 * changes are what it shows; `screencast` films just the flows whose golden changed, slowed down.
 */
export const RECORDING_PROJECTS = {
  flowPictures: 'flow-picture',
  flows: 'screencast',
  shots: 'screenshot',
  phoneShots: 'screenshot-phone',
} as const;

/** The screens every shot spec is photographed on, shown side by side in the PR. */
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

/** Which side of the PR a golden shown in the description is from. */
export type GoldenSide = 'before' | 'after';

/** The published file name of one device's golden of a shot (`map-tabs-phone-after.png`). */
export function shotFile(slug: string, device: ShotDevice, side: GoldenSide): string {
  return `${slug}-${device}-${side}.png`;
}

/** Where the goldens live, relative to `apps/web` (`playwright.config.ts`'s `snapshotPathTemplate`). */
export const GOLDEN_DIR = 'e2e/__screenshots__';

/**
 * One golden a PR adds, rewrites or deletes: `{project}/{testFilePath}/{testName}.png` under
 * {@link GOLDEN_DIR}, split into its parts.
 */
export interface GoldenChange {
  readonly status: 'added' | 'changed' | 'removed';
  readonly project: string;
  /** The spec file, relative to the test directory, as Playwright's reports name it. */
  readonly file: string;
  /** The test's title as Playwright puts it into file names (`goldenName`). */
  readonly name: string;
  /** The golden's path relative to `apps/web`, for `git show`. */
  readonly path: string;
}

const GIT_STATUS: Readonly<Record<string, GoldenChange['status']>> = {
  A: 'added',
  M: 'changed',
  D: 'removed',
};

/**
 * The goldens in `nameStatus`, the output of `git diff --name-status --no-renames --relative`
 * run in `apps/web` (with `core.quotePath=false`, so a name with a letter like `’` comes through
 * as it is). Lines outside {@link GOLDEN_DIR} or of another status are skipped.
 */
export function goldenChanges(nameStatus: string): GoldenChange[] {
  return nameStatus.split('\n').flatMap((line) => {
    const [code, path] = line.split('\t');
    const status = code === undefined ? undefined : GIT_STATUS[code];
    if (!status || !path?.startsWith(`${GOLDEN_DIR}/`) || !path.endsWith('.png')) return [];
    const [project, ...rest] = path.slice(GOLDEN_DIR.length + 1).split('/');
    const fileName = rest.pop();
    if (!project || !fileName || rest.length === 0) return [];
    return [
      { status, project, file: rest.join('/'), name: fileName.slice(0, -'.png'.length), path },
    ];
  });
}

/**
 * A test's title as Playwright writes it into a golden's file name (`{testName}`): its describe
 * blocks and title joined by spaces, a title over 100 characters cut in the middle around a hash,
 * then every run of characters a file name can't hold (ASCII punctuation and spaces) turned into
 * `-`, on each side of the last dot. Repeats Playwright 1.65's `_fsSanitizedTestName`.
 */
export function goldenName(titlePath: readonly string[]): string {
  const title = trimLongTitle(titlePath.join(' '));
  const sanitize = (text: string) =>
    // eslint-disable-next-line no-control-regex -- the ASCII ranges Playwright replaces, control characters included.
    text.replace(/[\x00-\x2C\x2E-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/g, '-');
  const dot = title.lastIndexOf('.');
  return dot === -1
    ? sanitize(title)
    : `${sanitize(title.slice(0, dot))}.${sanitize(title.slice(dot + 1))}`;
}

function trimLongTitle(title: string, length = 100): string {
  if (title.length <= length) return title;
  const middle = `-${createHash('sha1').update(title).digest('hex').slice(0, 5)}-`;
  const start = Math.floor((length - middle.length) / 2);
  return title.slice(0, start) + middle + title.slice(-(length - middle.length - start));
}

/** A test a `playwright test --list --reporter=json` run lists, in one project. */
export interface ListedTest {
  readonly project: string;
  readonly file: string;
  /** Its describe blocks and title, outermost first. */
  readonly titlePath: readonly string[];
}

/**
 * Every test in `report` (a `--list` run), once per project. The report's top suites are the
 * spec files; the suites inside them are describe blocks.
 */
export function listedTests(report: PlaywrightReport): ListedTest[] {
  const walk = (suite: ReportSuite, describes: readonly string[]): ListedTest[] => [
    ...(suite.specs ?? []).flatMap((spec) =>
      spec.tests.map((test) => ({
        project: test.projectName,
        file: spec.file ?? '',
        titlePath: [...describes, spec.title],
      })),
    ),
    ...(suite.suites ?? []).flatMap((inner) => walk(inner, [...describes, inner.title ?? ''])),
  ];
  return (report.suites ?? []).flatMap((fileSuite) => walk(fileSuite, []));
}

/**
 * The title shown for a golden: its test's, describe blocks included, from `listed`; when no
 * listed test makes that file name (the PR deletes the test with its golden), the file name with
 * its dashes read as spaces.
 */
function goldenTitle(change: GoldenChange, listed: readonly ListedTest[]): string {
  return listedTestOf(change, listed)?.titlePath.join(' › ') ?? change.name.replaceAll('-', ' ');
}

/** The listed test whose golden `change` is, if the PR still has it. */
function listedTestOf(change: GoldenChange, listed: readonly ListedTest[]): ListedTest | undefined {
  return listed.find(
    (test) =>
      test.project === change.project &&
      test.file === change.file &&
      goldenName(test.titlePath) === change.name,
  );
}

/**
 * The flow specs whose end-state golden (`flow-picture`) the PR adds or rewrites, in `changes`
 * order, named from `listed` for `flowGrep`. A flow whose golden it deletes is gone and can't be
 * filmed, and neither can one `listed` lacks (the test list failed): its title, which `--grep`
 * needs, can't be told from a golden's file name.
 */
export function changedFlows(
  changes: readonly GoldenChange[],
  listed: readonly ListedTest[],
): ChangedFlow[] {
  return changes.flatMap((change) => {
    if (change.project !== RECORDING_PROJECTS.flowPictures || change.status === 'removed')
      return [];
    const test = listedTestOf(change, listed);
    // flowGrep matches the leaf title; a describe block's words may stand before it.
    return test ? [{ title: test.titlePath.at(-1) ?? '', file: change.file }] : [];
  });
}

/**
 * One entry per shot spec whose golden the PR changes on any device, in `changes` order, with
 * each device's golden before and after.
 */
export function changedShots(
  changes: readonly GoldenChange[],
  listed: readonly ListedTest[],
): Screenshot[] {
  const deviceOf = (project: string) =>
    SHOT_DEVICE_NAMES.find((device) => SHOT_DEVICES[device].project === project);
  const shots = new Map<
    string,
    { title: string; pictures: Partial<Record<ShotDevice, GoldenPair>> }
  >();
  for (const change of changes) {
    const device = deviceOf(change.project);
    if (!device) continue;
    const key = `${change.file} › ${change.name}`;
    const shot = shots.get(key) ?? { title: goldenTitle(change, listed), pictures: {} };
    shot.pictures[device] = {
      ...(change.status === 'added' ? {} : { before: change.path }),
      ...(change.status === 'removed' ? {} : { after: change.path }),
    };
    shots.set(key, shot);
  }
  return [...shots.values()].map(({ title, pictures }) => ({
    title,
    slug: slugify(title),
    pictures: Object.fromEntries(
      SHOT_DEVICE_NAMES.map((device) => [device, pictures[device]]),
    ) as Record<ShotDevice, GoldenPair | undefined>,
  }));
}

/**
 * The `playwright test --grep` pattern that selects `flows`. Playwright greps the full title
 * (project, file, describe blocks, title and tags, joined by spaces), so each flow is matched by
 * its file and its whole title: `the settings` must not also pick `change the settings` in
 * another file. In the same file, a describe block can't be told from the title's first words.
 */
export function flowGrep(flows: readonly ChangedFlow[]): string {
  // Plain `node` can't load @arkham/util's extensionless imports, so its escapeRegExp is repeated here.
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return flows
    .map((flow) => {
      const file = flow.file === undefined ? '' : `${escape(flow.file)} (.+ )?`;
      return ` ${file}${escape(flow.title)}( @\\S+)*$`;
    })
    .join('|');
}

/**
 * One entry per flow in `flows`, with the video of its last passing attempt in `recording` (the
 * `screencast` run), or none when it failed there or wasn't recorded.
 */
export function flowVideos(
  flows: readonly ChangedFlow[],
  recording: PlaywrightReport,
): FlowVideo[] {
  const recorded = new Map(
    specsIn(recording, [RECORDING_PROJECTS.flows]).map((spec) => [specKey(spec), spec]),
  );
  return flows.map((flow) => {
    const spec = recorded.get(specKey(flow));
    return {
      title: flow.title,
      slug: slugify(flow.title),
      videoPath: spec && passingAttachment(spec, RECORDING_PROJECTS.flows, 'video'),
    };
  });
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
function specKey(spec: { readonly file?: string; readonly title: string }): string {
  return `${spec.file ?? ''} › ${spec.title}`;
}

function allSpecs(suites: readonly ReportSuite[]): ReportSpec[] {
  return suites.flatMap((suite) => [...(suite.specs ?? []), ...allSpecs(suite.suites ?? [])]);
}

function passingAttachment(spec: ReportSpec, project: string, name: string): string | undefined {
  const passed = spec.tests
    .filter((test) => test.projectName === project)
    .flatMap((test) => test.results ?? [])
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
 * The Markdown section (including its markers): every shot whose golden the PR changes, its
 * desktop and phone goldens side by side, before above after, then every changed flow with an
 * inline GIF and a link to the player page, which plays the full-quality video with pause,
 * seeking and speed, and by name the changed flows past {@link SCREENCAST_LIMIT} (`moreFlows`);
 * just the markers when the PR changes no golden, which empties a section an earlier push wrote.
 * Pictures are linked from `pictureBaseUrl` (the gh-pages branch on raw.githubusercontent.com,
 * which serves a push at once, while Pages takes a minute or more to deploy it; the workflow pins
 * the branch to the commit it pushed), the player from `baseUrl` (Pages, the only host that
 * serves it as a page). `version` (the commit) is appended as a query string because the file
 * names stay the same across pushes and GitHub's image proxy and Pages cache by URL.
 */
export function renderSection({
  flows,
  shots,
  baseUrl,
  pictureBaseUrl,
  version,
  moreFlows = [],
}: {
  flows: readonly FlowVideo[];
  shots: readonly Screenshot[];
  moreFlows?: readonly string[];
  baseUrl: string;
  pictureBaseUrl: string;
  version: string;
}): string {
  // The markers stay, so a later push can fill them.
  if (flows.length === 0 && shots.length === 0 && moreFlows.length === 0)
    return [SECTION_START, SECTION_END].join('\n');
  const withSlash = (url: string) => (url.endsWith('/') ? url : `${url}/`);
  const base = withSlash(baseUrl);
  const pictures = withSlash(pictureBaseUrl);
  const missing: Readonly<Record<GoldenSide, string>> = { before: 'New', after: 'Removed' };
  const shotEntries = shots.map((shot) => {
    // HTML rather than a Markdown table: only `width` keeps both pictures side by side at sizes that match.
    const cell = (device: ShotDevice, side: GoldenSide) => {
      const { label, width } = SHOT_DEVICES[device];
      const pair = shot.pictures[device];
      if (!pair) return '<td>Unchanged</td>';
      if (!pair[side]) return `<td>${missing[side]}</td>`;
      const src = `${pictures}${shotFile(shot.slug, device, side)}?v=${version}`;
      return `<td><img src="${src}" alt="${label} ${side}" width="${width}"></td>`;
    };
    const row = (side: GoldenSide, label: string) =>
      `<tr><th>${label}</th>${SHOT_DEVICE_NAMES.map((device) => cell(device, side)).join('')}</tr>`;
    const headings = SHOT_DEVICE_NAMES.map((device) => `<th>${SHOT_DEVICES[device].label}</th>`);
    return [
      `### ${shot.title}`,
      '',
      '<table>',
      `<tr><th></th>${headings.join('')}</tr>`,
      row('before', 'Before'),
      row('after', 'After'),
      '</table>',
    ].join('\n');
  });
  const flowEntries = flows.map((flow) => {
    const heading = `### ${flow.title}`;
    if (!flow.videoPath) return `${heading}\n\n_Not recorded: the flow failed, see the E2E check._`;
    const gif = `${pictures}${flow.slug}.gif?v=${version}`;
    const player = `${base}player.html?flow=${flow.slug}&v=${version}&speed=${1 / SCREENCAST_SLOWDOWN}`;
    return `${heading}\n\n![${flow.title}](${gif})\n\n[Play with pause and speed controls](${player})`;
  });
  const intro = `_The goldens this PR changes, as of ${version}, from the PR preview workflow; updated on every push that changes \`apps/web\`._`;
  return [
    SECTION_START,
    intro,
    ...(shots.length > 0 ? ['## Screenshots', ...shotEntries] : []),
    ...(flows.length > 0 || moreFlows.length > 0 ? ['## Screencasts', ...flowEntries] : []),
    ...(moreFlows.length > 0
      ? [
          `_Also changed, not recorded (at most ${SCREENCAST_LIMIT} per push): ${moreFlows.join('; ')}._`,
        ]
      : []),
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
