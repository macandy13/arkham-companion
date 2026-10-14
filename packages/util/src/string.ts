/** Returns `text` without `prefix` if it starts with it, otherwise `text` unchanged. */
export function stripPrefix(text: string, prefix: string): string {
  return text.startsWith(prefix) ? text.slice(prefix.length) : text;
}

/** Returns `text` without `suffix` if it ends with it, otherwise `text` unchanged. */
export function stripSuffix(text: string, suffix: string): string {
  // Guard the empty suffix: `slice(0, -0)` would return an empty string.
  return suffix && text.endsWith(suffix) ? text.slice(0, -suffix.length) : text;
}
