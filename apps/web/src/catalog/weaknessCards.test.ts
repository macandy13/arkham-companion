import { describe, expect, it } from 'vitest';
import { toCardCode, type WeaknessDef } from '@arkham/carddata';
import { putIntoThreatArea, whenRevealed } from '@arkham/engine';
import { catalogWeaknessCards, weaknessCardStats } from './weaknessCards';

/** A catalog weakness with no other property than the ones a test sets. */
const weakness = (fields: Partial<WeaknessDef>): WeaknessDef => ({
  code: toCardCode('9101'),
  name: 'Fake Weakness',
  typeCode: 'treachery',
  basic: true,
  traits: [],
  keywords: [],
  entersThreatArea: false,
  ...fields,
});

describe('weaknessCardStats', () => {
  it('gives an enemy its stats and keywords', () => {
    const stalker = weakness({
      name: 'Fake Stalker',
      typeCode: 'enemy',
      traits: ['Humanoid'],
      fight: 4,
      evade: 3,
      health: 3,
      damage: 1,
      horror: 0,
      keywords: [{ name: 'hunter' }],
    });

    expect(weaknessCardStats(stalker)).toEqual({
      code: '9101',
      name: 'Fake Stalker',
      typeCode: 'enemy',
      traits: ['Humanoid'],
      fight: 4,
      evade: 3,
      health: { fixed: 3, perInvestigator: 0 },
      damage: 1,
      horror: 0,
      keywords: [{ name: 'hunter' }],
    });
  });

  it('scales health printed per investigator', () => {
    const horde = weakness({ typeCode: 'enemy', health: 2, healthPerInvestigator: true });

    expect(weaknessCardStats(horde).health).toEqual({ fixed: 0, perInvestigator: 2 });
  });

  it.each([
    {
      name: 'puts a threat-area treachery into play there',
      entersThreatArea: true,
      abilities: [whenRevealed(putIntoThreatArea())],
    },
    {
      name: 'leaves any other revelation to the players',
      entersThreatArea: false,
      abilities: undefined,
    },
  ])('$name', ({ entersThreatArea, abilities }) => {
    expect(weaknessCardStats(weakness({ entersThreatArea })).abilities).toEqual(abilities);
  });
});

describe('catalogWeaknessCards', () => {
  it('has none for a catalog cached before it held weaknesses', () => {
    expect(catalogWeaknessCards({ investigators: [], packs: [] })).toEqual([]);
  });
});
