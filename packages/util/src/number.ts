/** Whether `value` is a whole number of at least 1 (false for `NaN`, infinities and fractions). */
export function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}
