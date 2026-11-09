/**
 * The items that occur more than once in `items`, each listed once, in the
 * order of their second occurrence. Compares like a `Set` (`SameValueZero`).
 * Total: an empty or duplicate-free list yields `[]`.
 */
export function duplicates<T>(items: readonly T[]): T[] {
  return [...new Set(items.filter((item, i) => items.indexOf(item) !== i))];
}

/**
 * Each item of `items` once, in the order of its first occurrence, like the
 * distinct tokens of a bag. Compares like a `Set` (`SameValueZero`).
 */
export function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
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

/**
 * A copy of `items` with the items that match first, each group keeping its order, e.g. to list
 * the current item ahead of the rest. Total: no match leaves an equal copy.
 */
export function matchingFirst<T>(items: readonly T[], matches: (item: T) => boolean): T[] {
  return [...items.filter(matches), ...items.filter((item) => !matches(item))];
}

/**
 * `items` cut into runs of neighbours that share `keyOf`, in order, each with its key: a key that
 * comes back after another one starts a new run. Total: empty for an empty list.
 */
export function runsBy<T, K>(items: readonly T[], keyOf: (item: T) => K): { key: K; items: T[] }[] {
  const runs: { key: K; items: T[] }[] = [];
  for (const item of items) {
    const key = keyOf(item);
    const last = runs.at(-1);
    if (last && last.key === key) last.items.push(item);
    else runs.push({ key, items: [item] });
  }
  return runs;
}

/**
 * `items` grouped by `keyOf`, each group with its key, in the order each key first appears; unlike
 * `runsBy`, a key that comes back joins its group. Total: empty for an empty list.
 */
export function groupBy<T, K>(
  items: readonly T[],
  keyOf: (item: T) => K,
): { key: K; items: T[] }[] {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return [...groups].map(([key, grouped]) => ({ key, items: grouped }));
}

/**
 * The first index at which `first` and `second` differ by `equals`, a list that ends early
 * counting as a difference there; `undefined` when they are equal. Total: two empty lists are equal.
 */
export function firstDifference<T>(
  first: readonly T[],
  second: readonly T[],
  equals: (a: T, b: T) => boolean,
): number | undefined {
  const length = Math.max(first.length, second.length);
  for (let i = 0; i < length; i++) {
    if (i >= first.length || i >= second.length || !equals(first[i]!, second[i]!)) return i;
  }
  return undefined;
}

/**
 * `items` turned round so that the one at `index` comes first and the rest follow in their cycle,
 * as when a table's order starts at another seat; an index out of range leaves them as they are.
 */
export function rotateTo<T>(items: readonly T[], index: number): T[] {
  if (index < 0 || index >= items.length) return [...items];
  return [...items.slice(index), ...items.slice(0, index)];
}

/**
 * `count` of `items` (at most all of them), drawn one by one without putting any back, each with
 * `pick(left)` choosing the index among the `left` still undrawn, and the items left over in their
 * order. `pick` is the caller's seeded random source, so the draw stays deterministic.
 */
export function drawWithoutReplacement<T>(
  items: readonly T[],
  count: number,
  pick: (left: number) => number,
): { drawn: T[]; left: T[] } {
  const left = [...items];
  const drawn = Array.from(
    { length: Math.min(count, left.length) },
    // Never undefined: `pick` returns an index below the length it is given.
    () => left.splice(pick(left.length), 1)[0]!,
  );
  return { drawn, left };
}
