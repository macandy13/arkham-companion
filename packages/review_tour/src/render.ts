import type { TourLine } from './diff_lines.ts';
import { escapeHtml, highlightLine } from './highlight.ts';
import { PAGE_CSS, PAGE_SCRIPT } from './page_assets.ts';
import type { Device } from './pictures.ts';
import type { Tour, TourQuestion, TourStop } from './tour.ts';

/** Everything `renderPage` needs, resolved by the CLI from the tour, the diff and the goldens. */
export interface PageInput {
  readonly pr: {
    readonly number: number;
    readonly title: string;
    readonly url: string;
    readonly headSha: string;
  };
  readonly tour: Tour;
  /** One per `tour.stops`, in the same order. */
  readonly stops: readonly StopContent[];
  /** Added plus removed lines of the whole PR and of the code the stops show, for the "70 of 482" line. */
  readonly changedLines: { readonly all: number; readonly onTour: number };
}

/** What a stop shows besides its text. */
export interface StopContent {
  readonly code: readonly StopCode[];
  readonly pictures: readonly StopPicture[];
}

/** One device's golden at a stop, as image URLs at the base and head commits. */
export interface StopPicture {
  readonly device: Device;
  /** Whether the PR adds, removes or rewrites this golden; only then does the page offer before and after. */
  readonly changed: boolean;
  readonly before?: string;
  readonly after?: string;
}

/** One file's lines at a stop (`cutStopLines`), with a link to them in the PR's diff. */
export interface StopCode {
  readonly file: string;
  readonly newFile: boolean;
  readonly added: number;
  readonly removed: number;
  readonly lines: readonly TourLine[];
  readonly diffUrl: string;
}

/** The review page for one PR as a single HTML document (styles, script and markup inline). */
export function renderPage(input: PageInput): string {
  const { pr, tour } = input;
  const title = splitTitle(pr.title);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>#${pr.number} review tour</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&amp;family=JetBrains+Mono:wght@400;600&amp;display=swap">
<style>${PAGE_CSS}</style>
</head>
<body>
<main>
${renderNav(pr.number, tour)}
<header>
<p class="kicker">${[...title.labels, `as of ${pr.headSha.slice(0, 7)}`].map(escapeHtml).join(' · ')}</p>
<h1>${escapeHtml(title.headline)}</h1>
<p class="meta">${renderMeta(input)}</p>
</header>
${renderLead(tour)}
${renderQuestions(tour.questions, pr.url)}
${tour.stops.map((stop, index) => renderStop(stop, index + 1, input.stops[index])).join('\n')}
<section class="done"><p>That's the whole change.</p><a href="${escapeHtml(pr.url)}/files">Review on GitHub</a></section>
${renderRest(tour.rest)}
</main>
<script>${PAGE_SCRIPT}</script>
</body>
</html>
`;
}

function renderNav(number: number, tour: Tour): string {
  const question =
    tour.questions.length > 0
      ? '<li><a class="question" href="#questions" aria-label="Questions">?</a></li>'
      : '';
  const stops = tour.stops.map(
    (_, i) => `<li><a href="#stop-${i + 1}" data-stop="stop-${i + 1}">${i + 1}</a></li>`,
  );
  return `<nav aria-label="Tour"><span class="number">#${number}</span><ol>${question}${stops.join('')}</ol></nav>`;
}

function renderMeta(input: PageInput): string {
  return tourSummary(input)
    .map((item) => `<span>${item}</span>`)
    .join('');
}

/** The page's size line, also the PR comment that links the page: "4 stops", "1 question", "50 of 482 …". */
export function tourSummary({
  tour,
  changedLines,
}: Pick<PageInput, 'tour' | 'changedLines'>): string[] {
  return [
    plural(tour.stops.length, 'stop'),
    plural(tour.questions.length, 'question'),
    `${changedLines.onTour} of ${changedLines.all} changed lines on the tour`,
  ];
}

/** The problem first, when the tour states it, then how the PR solves it. */
function renderLead(tour: Tour): string {
  const sections: [heading: string, text: string][] = [['What changes', tour.concept]];
  if (tour.problem !== undefined) sections.unshift(['The problem', tour.problem]);
  return sections
    .map(
      ([heading, text]) =>
        `<section class="lead"><h2>${heading}</h2><p>${inline(text)}</p></section>`,
    )
    .join('\n');
}

function renderQuestions(questions: readonly TourQuestion[], prUrl: string): string {
  if (questions.length === 0) return '';
  const items = questions.map((question) => {
    const about = [
      question.stop && `Concerns <a href="#stop-${question.stop}">stop ${question.stop}</a>.`,
      question.picked && `Picked: ${inline(question.picked)}.`,
    ]
      .filter(Boolean)
      .join(' ');
    return `<li><p>${inline(question.text)}</p>${about ? `<span class="about">${about}</span>` : ''}</li>`;
  });
  const title = questions.length === 1 ? 'Question for you' : 'Questions for you';
  return `<section class="questions" id="questions"><h2>${title}</h2><ol>${items.join('')}</ol><a href="${escapeHtml(prUrl)}">Answer on GitHub →</a></section>`;
}

function renderStop(stop: TourStop, number: number, content: StopContent | undefined): string {
  return `<section class="stop" id="stop-${number}">
<header><span class="stop-number">${number}</span>${stop.tag ? `<span class="tag">${escapeHtml(stop.tag)}</span>` : '<span></span>'}<h2>${escapeHtml(stop.title)}</h2></header>
<p>${inline(stop.text)}</p>
${content ? renderPictures(content.pictures) : ''}
${content?.code.map(renderCode).join('\n') ?? ''}
</section>`;
}

function renderPictures(pictures: readonly StopPicture[]): string {
  if (pictures.length === 0) return '';
  const changed = pictures.some((picture) => picture.changed);
  const when = changed
    ? segments('when', [
        ['before', 'Before'],
        ['after', 'After'],
      ])
    : '';
  const devices =
    pictures.length > 1
      ? segments(
          'device',
          pictures.map((p) => [p.device, capitalise(p.device)]),
        )
      : '';
  return `<figure data-variants="${escapeHtml(JSON.stringify(pictures))}"><div class="toggle">${when}${devices}</div><div class="frame"></div></figure>`;
}

function segments(
  name: 'when' | 'device',
  options: readonly (readonly [string, string])[],
): string {
  const buttons = options.map(
    ([value, label]) => `<button type="button" name="${name}" value="${value}">${label}</button>`,
  );
  return `<span class="segments">${buttons.join('')}</span>`;
}

function renderCode(code: StopCode): string {
  const badge = code.newFile ? 'new file' : `+${code.added} −${code.removed}`;
  const colour = SCRIPT_FILE.test(code.file) ? highlightLine : escapeHtml;
  const lines = code.lines.map((line) => renderLine(line, code.newFile, colour)).join('');
  return `<div class="code"><header><span class="file">${escapeHtml(code.file)}</span><span>${badge}</span><a href="${escapeHtml(code.diffUrl)}">Open in diff</a></header><pre><code>${lines}</code></pre></div>`;
}

/** The files `highlightLine` knows; YAML, Markdown and CSS stay plain rather than coloured wrong. */
const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;

const MARKS = { context: ' ', added: '+', removed: '−', gap: '⋯' } as const;

/** In a new file every line is added, so only highlighted lines stand out there. */
function renderLine(line: TourLine, newFile: boolean, colour: (text: string) => string): string {
  if (line.kind === 'gap') return lineHtml('gap', '', MARKS.gap, escapeHtml(line.text));
  const shown = newFile && line.kind === 'added' ? 'context' : line.kind;
  return lineHtml(
    line.highlighted ? 'highlighted' : shown,
    String(line.number),
    MARKS[shown],
    colour(line.text),
  );
}

function lineHtml(
  kind: TourLine['kind'] | 'highlighted',
  number: string,
  mark: string,
  text: string,
): string {
  return `<span class="line ${kind}"><span class="number">${number}</span><span class="mark">${mark}</span><span class="text">${text}</span></span>`;
}

function renderRest(rest: readonly string[]): string {
  if (rest.length === 0) return '';
  return `<details><summary>Not on the tour</summary><ul>${rest.map((line) => `<li>${inline(line)}</li>`).join('')}</ul></details>`;
}

const CONVENTIONAL_TITLE = /^(\w+(?:\([^)]*\))?!?):\s*(.+?)(?:\s*\(([^)]+)\))?$/;

/**
 * Splits a Conventional Commit title into a headline and the labels the kicker shows:
 * `feat(web): draw a weakness (ME.26c)` → "Draw a weakness" and `feat(web)`, `ME.26c`.
 */
export function splitTitle(title: string): { headline: string; labels: string[] } {
  const parts = CONVENTIONAL_TITLE.exec(title);
  if (!parts?.[1] || !parts[2]) return { headline: title, labels: [] };
  return { headline: capitalise(parts[2]), labels: parts[3] ? [parts[1], parts[3]] : [parts[1]] };
}

/** Escaped text with `backticks` as code, the only markup a tour's text may use. */
function inline(text: string): string {
  return escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>');
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
