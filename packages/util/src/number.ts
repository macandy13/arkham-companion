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
