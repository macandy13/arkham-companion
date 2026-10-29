import { describe, expect, it } from 'vitest';
import { cycledIndex, isNonNegativeInteger, isNonZeroInteger, isPositiveInteger } from './index';

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

describe('isNonNegativeInteger', () => {
  it.each([
    { value: 0, expected: true },
    { value: 3, expected: true },
    { value: -1, expected: false },
    { value: 0.5, expected: false },
    { value: Number.NaN, expected: false },
    { value: Number.POSITIVE_INFINITY, expected: false },
  ])('is $expected for $value', ({ value, expected }) => {
    expect(isNonNegativeInteger(value)).toBe(expected);
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

describe('cycledIndex', () => {
  it.each([
    { index: 0, step: 1, length: 3, expected: 1 },
    { index: 2, step: 1, length: 3, expected: 0 },
    { index: 0, step: -1, length: 3, expected: 2 },
    { index: 1, step: -1, length: 3, expected: 0 },
  ])('moves $step from $index of $length to $expected', ({ index, step, length, expected }) => {
    expect(cycledIndex(index, step, length)).toBe(expected);
  });
});
