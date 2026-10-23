/** `text` without one trailing dot; any other dot, and everything else, stays. */
export function stripTrailingDot(text: string): string {
  return text.endsWith('.') ? text.slice(0, -1) : text;
}

/** A camelCase identifier as lower-case words: `failedBy` becomes `failed by`. */
export function camelCaseToWords(text: string): string {
  return text.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
}

/** `text` with every RegExp special character escaped, so `new RegExp(escapeRegExp(text))` matches it literally. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
