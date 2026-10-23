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

/**
 * Each item of `items` with the running total of `valueOf` up to and
 * including it, starting from `start`: the last item's `total` is the sum of
 * all of them. Copies the items; empty for an empty list.
 */
export function withRunningTotals<T extends object>(
  items: readonly T[],
  valueOf: (item: T) => number,
  start = 0,
): (T & { total: number })[] {
  let total = start;
  return items.map((item) => {
    total += valueOf(item);
    return { ...item, total };
  });
}

/** The whole numbers from 0 up to `count`, excluding it: `range(3)` is `[0, 1, 2]`. Empty for 0. */
export function range(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}
