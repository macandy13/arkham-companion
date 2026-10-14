import { z } from 'zod';

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
export const KeywordSchema = z.object({
  name: z.enum(KEYWORD_NAMES),
  /** The free text after `patrol`, `prey` and `spawn`; interpreted by the rule that uses it. */
  detail: z.string().optional(),
});
export type Keyword = z.infer<typeof KeywordSchema>;

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
const DETAIL_KEYWORD = /^(patrol|prey|spawn)(?:\s*[-–—]\s*(.+)|\s*\((.+)\))$/i;
const THREAT_AREA = /\b(?:put|place)s?\b[^.]*\bin your threat area\b/i;

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
  return THREAT_AREA.test(plainLines(text ?? '').join(' '));
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
  return stripMarkup(text)
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
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
      i = hasGt && text[end] === '>' ? end + 1 : i + 1;
    }
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
  const detailed = DETAIL_KEYWORD.exec(sentence);
  if (!detailed) return undefined;
  return {
    name: (detailed[1] as string).toLowerCase() as Keyword['name'],
    detail: (detailed[2] ?? detailed[3]) as string,
  };
}
