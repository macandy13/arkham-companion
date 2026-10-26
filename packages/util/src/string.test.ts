import { describe, expect, it } from 'vitest';
import { camelCaseToWords, escapeRegExp, numberedDuplicates, stripTrailingDot } from './index';

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

describe('escapeRegExp', () => {
  it.each([
    ['a host', 'https://arkhamdb.com', 'https://arkhamdbXcom'],
    ['a base path', '/arkham-companion/', '/arkham-companion'],
    ['every special character', '.*+?^${}()|[]\\', ''],
  ])('matches %s literally: %s', (_, text, lookAlike) => {
    const pattern = new RegExp(`^${escapeRegExp(text)}$`);
    expect(pattern.test(text)).toBe(true);
    expect(pattern.test(lookAlike)).toBe(false);
  });
});

describe('numberedDuplicates', () => {
  it.each([
    {
      name: 'numbers each copy of a repeated text in order',
      texts: ['Cellar', 'Hallway', 'Cellar'],
      expected: ['Cellar 1', 'Hallway', 'Cellar 2'],
    },
    {
      name: 'keeps texts that occur once',
      texts: ['Attic', 'Cellar'],
      expected: ['Attic', 'Cellar'],
    },
    {
      name: 'numbers each repeated text on its own',
      texts: ['Ghoul', 'Rat', 'Ghoul', 'Rat'],
      expected: ['Ghoul 1', 'Rat 1', 'Ghoul 2', 'Rat 2'],
    },
    { name: 'keeps an empty list', texts: [], expected: [] },
  ])('$name', ({ texts, expected }) => {
    expect(numberedDuplicates(texts)).toEqual(expected);
  });
});
