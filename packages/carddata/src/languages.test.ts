import { describe, expect, it } from 'vitest';
import { arkhamDbHost, isCardLanguage } from './languages';

describe('card languages', () => {
  it.each([
    { lang: 'en', host: 'https://arkhamdb.com' },
    { lang: 'de', host: 'https://de.arkhamdb.com' },
    { lang: 'fr', host: 'https://fr.arkhamdb.com' },
  ] as const)('serves $lang cards from $host', ({ lang, host }) => {
    expect(arkhamDbHost(lang)).toBe(host);
  });

  it.each([
    { value: 'ko', known: true },
    { value: 'nl', known: false },
  ])('knows $value as a card language: $known', ({ value, known }) => {
    expect(isCardLanguage(value)).toBe(known);
  });
});
