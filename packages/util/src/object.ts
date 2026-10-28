/**
 * A shallow copy of `object` without the property `key`. Unlike setting it to
 * `undefined`, the key is really gone, so a serialised or compared copy has no
 * trace of it. Total: a missing key leaves an equal copy.
 */
export function withoutKey<T extends object, K extends keyof T>(object: T, key: K): Omit<T, K> {
  const copy = { ...object };
  delete copy[key];
  return copy;
}

/**
 * `{ [key]: copy of list }` when the list has entries, else the empty object.
 * Meant for spreading into an object literal so that empty lists stay out of
 * a view instead of showing up as `key: []`. The list is copied, never shared.
 */
export function listIfAny<K extends string, T>(key: K, list: readonly T[]): { [P in K]?: T[] } {
  return list.length > 0 ? ({ [key]: [...list] } as { [P in K]: T[] }) : {};
}

/**
 * `{ [key]: record }` when the record has own keys, else the empty object: `listIfAny` for a
 * record, so an empty one stays out of a view instead of showing up as `key: {}`.
 */
export function recordIfAny<K extends string, T extends object>(
  key: K,
  record: T,
): { [P in K]?: T } {
  return Object.keys(record).length > 0 ? ({ [key]: record } as { [P in K]: T }) : {};
}

/**
 * Whether `a` and `b` have the same own keys with the same values (`Object.is`),
 * one level deep. For small flat records compared as values, such as a timing
 * window and its parameters.
 */
export function shallowEqual<T extends object>(a: T, b: T): boolean {
  const left = Object.entries(a);
  const right = new Map(Object.entries(b));
  return (
    left.length === right.size &&
    left.every(([key, value]) => right.has(key) && Object.is(value, right.get(key)))
  );
}
