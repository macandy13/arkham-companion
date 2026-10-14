/**
 * Copy of `record` with `key` set to `value`, or with `key` removed when `value` is
 * `undefined`. Removing instead of storing `undefined` keeps one canonical shape,
 * so states compare equal regardless of history.
 */
export function withEntry<R extends object, K extends keyof R>(
  record: R,
  key: K,
  value: R[K] | undefined,
): R {
  const next = { ...record };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}
