/**
 * The items that occur more than once in `items`, each listed once, in the
 * order of their second occurrence. Compares like a `Set` (`SameValueZero`).
 * Total: an empty or duplicate-free list yields `[]`.
 */
export function duplicates<T>(items: readonly T[]): T[] {
  return [...new Set(items.filter((item, i) => items.indexOf(item) !== i))];
}

/**
 * A copy of `items` without the first occurrence of `item` (compared with
 * `===`). Removes one copy, unlike `filter`, so it suits multisets such as a
 * bag of tokens. Total: an absent item leaves an equal copy.
 */
export function withoutFirst<T>(items: readonly T[], item: T): T[] {
  const index = items.indexOf(item);
  return index === -1 ? [...items] : [...items.slice(0, index), ...items.slice(index + 1)];
}
