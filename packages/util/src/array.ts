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
