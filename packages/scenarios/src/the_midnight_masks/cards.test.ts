import { describe, expect, it } from 'vitest';
import { cardCode, encounterSetCode, resolveValue, type CardStats } from '@arkham/engine';
import { theMidnightMasksCardDefs, theMidnightMasksCards } from './cards';

/** The card with `code`, failing the test if the data has none. */
function cardOf(code: string): CardStats {
  const card = theMidnightMasksCards.get(cardCode(code));
  if (!card) throw new Error(`no card ${code}`);
  return card;
}

describe('The Midnight Masks card data', () => {
  it.each([
    {
      code: '01121a',
      name: 'Predator or Prey?',
      front: '/bundles/cards/01121a.png',
      back: '/bundles/cards/01121b.png',
    },
    {
      code: '01125',
      name: 'Rivertown',
      front: '/bundles/cards/01125.png',
      back: '/bundles/cards/01125b.png',
    },
    {
      code: '01121b',
      name: 'The Masked Hunter',
      front: '/bundles/cards/01121b.png',
      back: undefined,
    },
    { code: '01137', name: '"Wolf-Man" Drew', front: '/bundles/cards/01137.png', back: undefined },
  ])('names the ArkhamDB pictures of $name', ({ code, front, back }) => {
    const card = cardOf(code);

    expect(card.imageSrc).toBe(front);
    expect(card.backImageSrc).toBe(back);
  });

  it.each([
    { set: 'arkham', copies: 6 },
    { set: 'cultists', copies: 5 },
    { set: 'pentagram', copies: 6 },
    { set: 'nightgaunts', copies: 4 },
    { set: 'locked_doors', copies: 2 },
  ])('has the $copies enemy and treachery copies of encounter set $set', ({ set, copies }) => {
    const encounterCards = theMidnightMasksCardDefs.filter(
      (card) =>
        card.encounterCode === encounterSetCode(set) &&
        (card.typeCode === 'enemy' || card.typeCode === 'treachery'),
    );

    expect(encounterCards.reduce((sum, card) => sum + (card.quantity ?? 1), 0)).toBe(copies);
  });

  it.each([
    { code: '01121b', name: 'The Masked Hunter', keywords: ['spawn', 'prey', 'hunter'] },
    { code: '01135', name: 'Hunting Shadow', keywords: ['peril'] },
    { code: '01170', name: 'Wizard of the Order', keywords: ['spawn', 'retaliate'] },
    { code: '01172', name: 'Hunting Nightgaunt', keywords: ['hunter'] },
  ])('lists the keywords of $name', ({ code, keywords }) => {
    expect(cardOf(code).keywords?.map((keyword) => keyword.name)).toEqual(keywords);
  });

  it.each([
    { code: '01137', name: '"Wolf-Man" Drew', detail: 'Downtown' },
    { code: '01138', name: 'Herman Collins', detail: 'Graveyard' },
    { code: '01139', name: 'Peter Warren', detail: 'Miskatonic University' },
    { code: '01140', name: 'Victoria Devereux', detail: 'Northside' },
    { code: '01141', name: 'Ruth Turner', detail: "St. Mary's Hospital" },
  ])('names the spawn location of $name', ({ code, detail }) => {
    expect(cardOf(code).keywords?.find((keyword) => keyword.name === 'spawn')?.detail).toBe(detail);
  });

  it.each([
    { players: 1, health: 6 },
    { players: 4, health: 12 },
  ])(
    'gives The Masked Hunter $health health with $players investigator(s)',
    ({ players, health }) => {
      const printed = cardOf('01121b').health;

      expect(printed && resolveValue(printed, players)).toBe(health);
    },
  );
});
