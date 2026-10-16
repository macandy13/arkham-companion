import { describe, expect, it } from 'vitest';
import { camelCaseToWords, stripTrailingDot } from './index';

describe('camelCaseToWords', () => {
  it.each([
    { name: 'splits at each capital', text: 'chooseHunterOrder', expected: 'choose hunter order' },
    { name: 'keeps a single word', text: 'yes', expected: 'yes' },
    { name: 'lower-cases a leading capital', text: 'Yes', expected: 'yes' },
    { name: 'keeps an empty string', text: '', expected: '' },
  ])('$name', ({ text, expected }) => {
    expect(camelCaseToWords(text)).toEqual(expected);
  });
});

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
