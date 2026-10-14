/** Splits `text` at `separator`, trims each part and drops empty parts. */
export function splitTrimmed(text: string, separator: string): string[] {
  return text
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean);
}
