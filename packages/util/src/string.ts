/** `text` without one trailing dot; any other dot, and everything else, stays. */
export function stripTrailingDot(text: string): string {
  return text.endsWith('.') ? text.slice(0, -1) : text;
}

/** Words as a card prints a list of them, each ending in a full stop: `Curse. Omen.` */
export function sentences(words: readonly string[]): string {
  return words.map((word) => `${word}.`).join(' ');
}

/** A camelCase identifier as lower-case words: `failedBy` becomes `failed by`. */
export function camelCaseToWords(text: string): string {
  return text.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
}

/** `text` with every RegExp special character escaped, so `new RegExp(escapeRegExp(text))` matches it literally. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * `texts` with a running number after each text that occurs more than once
 * (`['Cellar', 'Hall', 'Cellar']` becomes `['Cellar 1', 'Hall', 'Cellar 2']`),
 * so every entry can be told apart by its text. A number can still collide
 * with a text that already ends in one (`['A 1', 'A', 'A']`); callers pass
 * names, which don't.
 */
export function numberedDuplicates(texts: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return texts.map((text) => {
    if (texts.indexOf(text) === texts.lastIndexOf(text)) return text;
    const number = (seen.get(text) ?? 0) + 1;
    seen.set(text, number);
    return `${text} ${number}`;
  });
}
