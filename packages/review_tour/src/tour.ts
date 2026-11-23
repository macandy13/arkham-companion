/**
 * The review tour a session writes into a PR body as a hidden JSON block,
 * `<!-- review-tour {…} -->`. `review-tour.yml` turns it into the PR's review page
 * (`renderPage`): the open questions first, then one stop per interesting change, each with
 * the code it points at (`cutStopLines`) and the goldens it names (`pictureVariants`).
 */
export interface Tour {
  /**
   * What is wrong or missing before this PR and why it matters, the page's first section, so the
   * reviewer knows the problem before reading the answer. Optional only so that tours written
   * before it existed still build; `docs/coding-guidelines.md` §7 asks for it.
   */
  readonly problem?: string;
  /** How the PR solves the problem, in a few plain sentences: the page's "What changes". */
  readonly concept: string;
  readonly questions: readonly TourQuestion[];
  readonly stops: readonly TourStop[];
  /** Short lines for the page's folded "Not on the tour" box: the plumbing the stops leave out. */
  readonly rest: readonly string[];
}

/** A decision the reviewer should check, answered on GitHub. */
export interface TourQuestion {
  readonly text: string;
  /** The 1-based stop it concerns, linked from the question. */
  readonly stop?: number;
  /** What the PR went with meanwhile. */
  readonly picked?: string;
}

/** One place on the tour, read in order. */
export interface TourStop {
  readonly title: string;
  /** A short kind label above the title, such as "Rule" or "UI · the dialog". */
  readonly tag?: string;
  /** One or two sentences on what changes here and why. */
  readonly text: string;
  readonly code: readonly CodeRef[];
  /**
   * A golden's path below its project directory in `apps/web/e2e/__screenshots__/`
   * (`shots/game_screen.spec.ts/<test>.png`); the page shows it for every device that has it,
   * before and after.
   */
  readonly picture?: string;
}

/** Lines of one file at the PR's head commit to show at a stop. */
export interface CodeRef {
  /** Repo-relative path. */
  readonly file: string;
  readonly ranges: readonly LineRange[];
  /** Head line numbers to mark as the ones to look at. */
  readonly highlight: readonly number[];
}

/** Head line numbers `from` to `to`, inclusive. */
export interface LineRange {
  readonly from: number;
  readonly to: number;
  /** Says what the skipped lines before this range hold. */
  readonly label?: string;
}

/** At the start of a line, so a body that mentions the block in its text isn't taken for one. */
const BLOCK = /^<!--\s*review-tour\s*([\s\S]*?)-->/m;

/**
 * Reads the tour block from a PR body; undefined when the body has none. A malformed block
 * throws with what is wrong, so the workflow's log tells the session how to fix it.
 */
export function parseTour(body: string): Tour | undefined {
  const block = BLOCK.exec(body);
  if (!block) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(block[1] ?? '');
  } catch (error) {
    throw new Error(`The review-tour block is not valid JSON: ${String(error)}`, { cause: error });
  }
  return readTour(json);
}

function readTour(json: unknown): Tour {
  const tour = record(json, 'the tour');
  const stops = list(tour.stops, 'stops').map((stop, i) => readStop(stop, `stops[${i}]`));
  const questions = list(tour.questions, 'questions').map((question, i) =>
    readQuestion(question, `questions[${i}]`),
  );
  questions.forEach((question, i) => {
    if (question.stop !== undefined && question.stop > stops.length) {
      throw new Error(
        `questions[${i}].stop is ${question.stop}, but the tour has ${stops.length} stops`,
      );
    }
  });
  return {
    ...optional('problem', tour.problem, (value) => text(value, 'problem')),
    concept: text(tour.concept, 'concept'),
    questions,
    stops,
    rest: list(tour.rest, 'rest').map((line, i) => text(line, `rest[${i}]`)),
  };
}

function readQuestion(json: unknown, path: string): TourQuestion {
  const question = record(json, path);
  return {
    text: text(question.text, `${path}.text`),
    ...optional('stop', question.stop, (value) => count(value, `${path}.stop`)),
    ...optional('picked', question.picked, (value) => text(value, `${path}.picked`)),
  };
}

function readStop(json: unknown, path: string): TourStop {
  const stop = record(json, path);
  return {
    title: text(stop.title, `${path}.title`),
    ...optional('tag', stop.tag, (value) => text(value, `${path}.tag`)),
    text: text(stop.text, `${path}.text`),
    code: list(stop.code, `${path}.code`).map((ref, i) => readCodeRef(ref, `${path}.code[${i}]`)),
    ...optional('picture', stop.picture, (value) => text(value, `${path}.picture`)),
  };
}

function readCodeRef(json: unknown, path: string): CodeRef {
  const ref = record(json, path);
  const ranges = list(ref.ranges, `${path}.ranges`).map((range, i) =>
    readRange(range, `${path}.ranges[${i}]`),
  );
  if (ranges.length === 0) throw new Error(`${path}.ranges must name at least one range`);
  return {
    file: text(ref.file, `${path}.file`),
    ranges,
    highlight: list(ref.highlight, `${path}.highlight`).map((line, i) =>
      count(line, `${path}.highlight[${i}]`),
    ),
  };
}

function readRange(json: unknown, path: string): LineRange {
  const range = record(json, path);
  const from = count(range.from, `${path}.from`);
  const to = count(range.to, `${path}.to`);
  if (to < from) throw new Error(`${path} ends (${to}) before it starts (${from})`);
  return { from, to, ...optional('label', range.label, (value) => text(value, `${path}.label`)) };
}

function record(json: unknown, path: string): Record<string, unknown> {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error(`${path} must be an object`);
  }
  return json as Record<string, unknown>;
}

/** A missing list reads as empty, so a tour leaves out what it has nothing for. */
function list(json: unknown, path: string): readonly unknown[] {
  if (json === undefined) return [];
  if (!Array.isArray(json)) throw new Error(`${path} must be a list`);
  return json;
}

function text(json: unknown, path: string): string {
  if (typeof json !== 'string' || json.trim() === '')
    throw new Error(`${path} must be a non-empty string`);
  return json;
}

function count(json: unknown, path: string): number {
  if (typeof json !== 'number' || !Number.isInteger(json) || json < 1) {
    throw new Error(`${path} must be a whole number from 1`);
  }
  return json;
}

/** `{ [key]: read(value) }` when the field is there, so optional fields stay absent, not undefined. */
function optional<K extends string, T>(
  key: K,
  json: unknown,
  read: (value: unknown) => T,
): { [P in K]?: T } {
  return json === undefined ? {} : ({ [key]: read(json) } as { [P in K]?: T });
}
