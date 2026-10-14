/** Copy of `items` without any element equal (`===`) to `item`. */
export function without<T>(items: readonly T[], item: T): T[] {
  return items.filter((other) => other !== item);
}

/** Copy of `items` with `item` inserted at `index` (0 = front); appended when `index` is omitted. */
export function insertedAt<T>(items: readonly T[], item: T, index?: number): T[] {
  const next = items.slice();
  next.splice(index ?? next.length, 0, item);
  return next;
}
