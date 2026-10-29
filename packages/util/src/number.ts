/** Whether `value` is a whole number of at least 1 (false for `NaN`, infinities and fractions). */
export function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

/** Whether `value` is a whole number of at least 0 (false for `NaN`, infinities and fractions). */
export function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/** Whether `value` is a whole number other than 0, e.g. a valid correction delta. */
export function isNonZeroInteger(value: number): boolean {
  return Number.isInteger(value) && value !== 0;
}

/**
 * The index `step` places on from `index` in a list of `length` items, wrapping round at either
 * end, as arrow keys move through a row of tabs.
 */
export function cycledIndex(index: number, step: number, length: number): number {
  return (((index + step) % length) + length) % length;
}
