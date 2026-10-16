/**
 * Keywords the engine reacts to. Mirrors `KeywordName` in `@arkham/engine`
 * (the engine declares its own copy so it never imports `carddata`).
 */
export const KEYWORD_NAMES = [
  'surge',
  'peril',
  'hunter',
  'aloof',
  'elite',
  'massive',
  'retaliate',
  'alert',
  'patrol',
  'prey',
  'spawn',
] as const;

/**
 * One keyword of a card, e.g. `{ name: 'hunter' }` or `{ name: 'prey', detail: 'Highest [agility]' }`.
 * Victory points are not a keyword here: ArkhamDB has a `victory` field for
 * them (`CardDef.victory`).
 */
export interface Keyword {
  name: (typeof KEYWORD_NAMES)[number];
  /** The free text after `patrol`, `prey` and `spawn`; interpreted by the rule that uses it. */
  detail?: string;
}

const PLAIN_KEYWORDS: ReadonlySet<string> = new Set([
  'surge',
  'peril',
  'hunter',
  'aloof',
  'massive',
  'retaliate',
  'alert',
]);
const VICTORY_SENTENCE = /^victory\s+\d+$/i;
const DETAIL_KEYWORD_NAME = /^(patrol|prey|spawn)/i;
const DASHES = '-–—';
const PUT_WORD = /\b(?:put|place)s?\b/i;
// Global so that `lastIndex` makes the search start after the put/place word
// while `\b` still sees the characters before it.
const THREAT_AREA_PHRASE = /\bin your threat area\b/gi;

/**
 * The keywords of a card, read from the ArkhamDB rules text. ArkhamDB prints
 * them as sentences on their own lines ("Hunter. Retaliate.", "Victory 1.",
 * "Spawn - Cellar."), sometimes wrapped in `<b>`.
 *
 * Only lines made up entirely of keyword sentences count. A sentence such as
 * "Surge protection is …" in the body of a card must not become a keyword, and
 * reminder text in `<i>` is dropped first so it cannot hide one. `Elite` is a
 * trait on ArkhamDB rather than part of the text, hence the `traits` argument.
 */
export function parseKeywords(text: string | undefined, traits: readonly string[]): Keyword[] {
  const fromText = plainLines(text ?? '').flatMap(keywordsOfLine);
  const elite: Keyword[] = traits.some((t) => t.toLowerCase() === 'elite')
    ? [{ name: 'elite' }]
    : [];
  return [...fromText, ...elite];
}

/**
 * Whether the text puts the card into an investigator's threat area, so that
 * a drawn treachery stays in play instead of being discarded. A heuristic on
 * "put/place … in your threat area"; revelation text is free-form, and a
 * wrong guess is fixed by moving the card by hand.
 */
export function entersThreatArea(text: string | undefined): boolean {
  return plainLines(text ?? '')
    .join(' ')
    .split('.')
    .some(putsIntoThreatArea);
}

/**
 * Whether one sentence has "in your threat area" after a put/place word.
 * Sentence-wise and by two plain searches instead of one regex with a gap
 * (`put … [^.]* … in your threat area`), which backtracks quadratically on
 * text with many put/place words.
 */
function putsIntoThreatArea(sentence: string): boolean {
  const put = PUT_WORD.exec(sentence);
  if (!put) return false;
  THREAT_AREA_PHRASE.lastIndex = put.index + put[0].length;
  return THREAT_AREA_PHRASE.test(sentence);
}

/**
 * Text without ArkhamDB markup (reminder text, bold, `[[Trait]]`), as trimmed non-empty lines.
 *
 * Tags are removed by {@link stripMarkup}, a single linear scan, rather than by
 * regexes: lazy or repeated patterns over card text backtrack polynomially on
 * inputs with many unmatched `<`, and re-running them until stable to catch
 * tags spliced together by nested markup is no better.
 */
function plainLines(text: string): string[] {
  return unwrapTraits(stripMarkup(text))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Drops `<i>…</i>` reminder text (case-insensitive) and every other `<…>` tag,
 * and any stray `<` or `>`, so the result never contains angle brackets.
 *
 * A `<i>` inside another tag still starts reminder text (as if reminder text
 * were removed first), so `<<i>x</i>` loses only the lone `<`. Once a search
 * for `</i>` or `>` has reached the end of the text (`hasClose`, `hasGt`) it
 * is not repeated, which keeps inputs such as thousands of unmatched `<i>` or
 * `<` linear. The text after an unterminated tag is kept.
 */
function stripMarkup(text: string): string {
  let out = '';
  let hasClose = true;
  let hasGt = true;
  let i = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    if (ch === '>') {
      i += 1;
    } else if (ch !== '<') {
      out += ch;
      i += 1;
    } else if (hasClose && startsWithIgnoreCase(text, i, '<i>')) {
      const close = indexOfIgnoreCase(text, '</i>', i + 3);
      hasClose = close !== -1;
      i = hasClose ? close + 4 : i + 3;
    } else {
      let end = i + 1;
      while (
        hasGt &&
        end < text.length &&
        text[end] !== '>' &&
        !(text[end] === '<' && startsWithIgnoreCase(text, end, '<i>'))
      ) {
        end++;
      }
      hasGt = hasGt && end < text.length;
      if (hasGt && text[end] === '>') {
        i = end + 1;
      } else {
        // The scan stopped at a `<i>` or the end: the chars before it hold no
        // `>`, so each `<` among them would stop at the same place. Skipping
        // them at once avoids rescanning them from every `<`.
        out += text.slice(i + 1, end).replaceAll('<', '');
        i = end;
      }
    }
  }
  return out;
}

/**
 * Replaces `[[Trait]]` with `Trait`; an unmatched `[[` stays as literal text.
 *
 * The position of the next `]` is cached because many `[[` can share one far
 * away `]`, and a search that found none is not repeated: both keep the scan
 * linear where a regex would backtrack.
 */
function unwrapTraits(text: string): string {
  let out = '';
  let close = 0;
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('[[', i)) {
      if (close !== -1 && close < i + 2) close = text.indexOf(']', i + 2);
      if (close > i + 2 && text[close + 1] === ']') {
        out += text.slice(i + 2, close);
        i = close + 2;
        continue;
      }
    }
    out += text[i];
    i += 1;
  }
  return out;
}

function startsWithIgnoreCase(text: string, at: number, needle: string): boolean {
  return text.slice(at, at + needle.length).toLowerCase() === needle;
}

/** Index of the lower-case `needle` in `text` from `from`, ignoring case, or -1. */
function indexOfIgnoreCase(text: string, needle: string, from: number): number {
  for (let i = from; i + needle.length <= text.length; i++) {
    if (startsWithIgnoreCase(text, i, needle)) return i;
  }
  return -1;
}

/** The keywords of a line, or none if any of its sentences is not a keyword. */
function keywordsOfLine(line: string): Keyword[] {
  // Victory comes from ArkhamDB's own `victory` field; a printed "Victory X."
  // is skipped so that it neither becomes a keyword nor hides the others on its line.
  const sentences = line
    .split(/(?<=\.)\s+/)
    .map((sentence) => sentence.replace(/\.$/, '').trim())
    .filter((sentence) => sentence !== '' && !VICTORY_SENTENCE.test(sentence));
  const keywords = sentences.map(parseSentence);
  return keywords.every((k) => k !== undefined) ? keywords : [];
}

function parseSentence(sentence: string): Keyword | undefined {
  const lower = sentence.toLowerCase();
  if (PLAIN_KEYWORDS.has(lower)) return { name: lower as Keyword['name'] };
  const named = DETAIL_KEYWORD_NAME.exec(sentence);
  if (!named) return undefined;
  const detail = detailOf(sentence.slice(named[0].length).trimStart());
  if (detail === undefined) return undefined;
  return { name: named[0].toLowerCase() as Keyword['name'], detail };
}

/**
 * The detail after a keyword name: `- Text` (any dash) or `(Text)`; undefined
 * if there is none or it is empty. Parsed by hand because a regex whose
 * whitespace and `.+` parts overlap backtracks quadratically on long runs of spaces.
 */
function detailOf(rest: string): string | undefined {
  const first = rest[0] ?? '';
  const detail =
    DASHES.includes(first) && first !== ''
      ? rest.slice(1).trim()
      : first === '(' && rest.endsWith(')')
        ? rest.slice(1, -1)
        : '';
  return detail === '' ? undefined : detail;
}
