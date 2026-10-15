import { describe, expect, it } from 'vitest';
import { stripTrailingDot } from './index';

describe('stripTrailingDot', () => {
  it.each([
    { name: 'removes a trailing dot', text: 'Attic.', expected: 'Attic' },
    { name: 'removes only one of several trailing dots', text: 'Wait..', expected: 'Wait.' },
    { name: 'keeps a dot inside the text', text: 'St. Mary', expected: 'St. Mary' },
    { name: 'keeps text without a dot', text: 'Attic', expected: 'Attic' },
    { name: 'keeps whitespace after the dot', text: 'Attic. ', expected: 'Attic. ' },
    { name: 'keeps case', text: 'ATTIC.', expected: 'ATTIC' },
    { name: 'turns a lone dot into an empty string', text: '.', expected: '' },
    { name: 'keeps an empty string', text: '', expected: '' },
  ])('$name', ({ text, expected }) => {
    expect(stripTrailingDot(text)).toEqual(expected);
  });
});
