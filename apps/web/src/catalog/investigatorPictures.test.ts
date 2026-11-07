import { describe, expect, it } from 'vitest';
import { type CardCatalog, type InvestigatorDef, toCardCode } from '@arkham/carddata';
import { investigatorPictures } from './investigatorPictures';

/** An investigator `code` of the core set, with the card picture `imageSrc` when given. */
function investigator(code: string, imageSrc?: string): InvestigatorDef {
  return {
    code: toCardCode(code),
    name: code,
    factionCode: 'guardian',
    health: 9,
    sanity: 5,
    skills: { willpower: 3, intellect: 3, combat: 4, agility: 2 },
    packCode: 'core',
    cyclePosition: 1,
    parallel: false,
    chapter: 1,
    imageSrc,
  };
}

describe('investigatorPictures', () => {
  it('maps each investigator with a card picture to it and leaves out the rest', () => {
    const catalog: CardCatalog = {
      packs: [],
      investigators: [investigator('01001', '/bundles/cards/01001.png'), investigator('90001')],
    };

    expect([...investigatorPictures(catalog)]).toEqual([['01001', '/bundles/cards/01001.png']]);
  });
});
