import { describe, expect, it } from 'vitest';
import { cardImageCaching } from './cardImageCaching';

describe('cardImageCaching', () => {
  const pattern = cardImageCaching.urlPattern;
  if (!(pattern instanceof RegExp)) throw new Error('the card picture rule matches by RegExp');

  it.each([
    ['a card picture', 'https://arkhamdb.com/bundles/cards/01104.png', true],
    ['the back of a card', 'https://arkhamdb.com/bundles/cards/01111b.png', true],
    ['ArkhamDB card data', 'https://arkhamdb.com/api/public/cards/core.json', false],
    ['the German host', 'https://de.arkhamdb.com/bundles/cards/01104.png', false],
    ['a look-alike host', 'https://arkhamdbXcom/bundles/cards/01104.png', false],
  ])('caches %s: %s → %s', (_, url, cached) => {
    expect(pattern.test(url)).toBe(cached);
  });
});
