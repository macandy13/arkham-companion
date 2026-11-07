import { describe, expect, it } from 'vitest';
import { type InvestigatorDef, toCardCode } from '@arkham/carddata';
import { investigatorCode } from '@arkham/engine';
import { chosenInvestigators, seatsFor } from './seating';

function makeDef(code: string, name: string, health: number, sanity: number): InvestigatorDef {
  return {
    code: toCardCode(code),
    name,
    factionCode: 'neutral',
    health,
    sanity,
    skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
    packCode: 'p',
    cyclePosition: 1,
    parallel: false,
    chapter: 1,
  };
}

describe('chosenInvestigators', () => {
  const catalog = [makeDef('a', 'Alder', 6, 8), makeDef('b', 'Birch', 9, 5)];

  it('lists the chosen cards in the given order with their printed stats', () => {
    const chosen = chosenInvestigators(catalog, [toCardCode('b'), toCardCode('a')]);

    expect(chosen.map((card) => [card.code, card.name, card.health, card.sanity])).toEqual([
      ['b', 'Birch', 9, 5],
      ['a', 'Alder', 6, 8],
    ]);
  });

  it('skips codes the catalog does not know', () => {
    const chosen = chosenInvestigators(catalog, [toCardCode('gone'), toCardCode('a')]);

    expect(chosen.map((card) => card.code)).toEqual(['a']);
  });

  it("keeps the picture of the card's front, when the catalog has one", () => {
    const withPicture = { ...makeDef('c', 'Cedar', 7, 7), imageSrc: '/bundles/cards/c.png' };

    const [cedar, alder] = chosenInvestigators(
      [withPicture, ...catalog],
      [toCardCode('c'), toCardCode('a')],
    );

    expect(cedar?.imageSrc).toBe('/bundles/cards/c.png');
    expect(alder).not.toHaveProperty('imageSrc');
  });
});

describe('seatsFor', () => {
  it('seats each card under its own code', () => {
    const alder = {
      code: investigatorCode('a'),
      name: 'Alder',
      health: 6,
      sanity: 8,
      skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
    };

    expect(seatsFor([alder])).toEqual([{ id: 'a', code: toCardCode('a') }]);
  });
});
