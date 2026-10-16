import { describe, expect, it } from 'vitest';
import { isNonZeroInteger, isPositiveInteger } from './index';

describe('isPositiveInteger', () => {
  it.each([
    { value: 1, expected: true },
    { value: 12, expected: true },
    { value: 0, expected: false },
    { value: -2, expected: false },
    { value: 1.5, expected: false },
    { value: Number.NaN, expected: false },
    { value: Number.POSITIVE_INFINITY, expected: false },
  ])('is $expected for $value', ({ value, expected }) => {
    expect(isPositiveInteger(value)).toBe(expected);
  });
});

describe('isNonZeroInteger', () => {
  it.each([
    { value: 3, expected: true },
    { value: -3, expected: true },
    { value: 0, expected: false },
    { value: 0.5, expected: false },
    { value: Number.NaN, expected: false },
  ])('is $expected for $value', ({ value, expected }) => {
    expect(isNonZeroInteger(value)).toBe(expected);
  });
});
