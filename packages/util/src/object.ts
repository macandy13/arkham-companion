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
