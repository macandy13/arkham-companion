import { describe, expect, it } from 'vitest';
import { cardDbFrom } from './cards';
import { cardCode, investigatorCode } from './ids';
import {
  investigatorCard,
  investigatorCardStats,
  type InvestigatorCard,
} from './investigator_cards';

describe('investigatorCard', () => {
  const roland: InvestigatorCard = {
    code: investigatorCode('01001'),
    name: 'Roland Banks',
    health: 9,
    sanity: 5,
    skills: { willpower: 3, intellect: 3, combat: 4, agility: 2 },
  };

  it('reads back an investigator put into the card db', () => {
    const cards = cardDbFrom([investigatorCardStats(roland)]);

    expect(investigatorCard(cards, roland.code)).toEqual(roland);
  });

  it('returns undefined for a code the card db lacks', () => {
    expect(investigatorCard(cardDbFrom([]), roland.code)).toBeUndefined();
  });

  it('returns undefined for a card that is not an investigator', () => {
    const study = {
      code: cardCode('01111'),
      name: 'Study',
      typeCode: 'location' as const,
      traits: [],
    };

    expect(investigatorCard(cardDbFrom([study]), investigatorCode('01111'))).toBeUndefined();
  });

  it('returns undefined for an investigator card without sanity or skills', () => {
    const withoutSanity = { ...investigatorCardStats(roland), sanity: undefined };

    expect(investigatorCard(cardDbFrom([withoutSanity]), roland.code)).toBeUndefined();
  });
});
