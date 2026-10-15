/** `text` without one trailing dot; any other dot, and everything else, stays. */
export function stripTrailingDot(text: string): string {
  return text.endsWith('.') ? text.slice(0, -1) : text;
}
