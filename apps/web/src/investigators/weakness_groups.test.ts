import { describe, expect, it } from 'vitest';
import { toCardCode, type WeaknessDef } from '@arkham/carddata';
import { weaknessGroups } from './weakness_groups';

const roland = toCardCode('roland');

/** A treachery weakness named `name`, neither basic nor anyone's signature unless `fields` say so. */
const weakness = (name: string, fields: Partial<WeaknessDef> = {}): WeaknessDef => ({
  code: toCardCode(name),
  name,
  typeCode: 'treachery',
  basic: false,
  traits: [],
  keywords: [],
  entersThreatArea: false,
  ...fields,
});

const rolandsGrudge = weakness('Grudge', { signatureOf: [roland] });
const dread = weakness('Dread', { basic: true });
const amnesia = weakness('Amnesia', { basic: true });
const daisysTome = weakness('Tome', { signatureOf: [toCardCode('daisy')] });
const all = [daisysTome, amnesia, rolandsGrudge, dread];

const names = (groups: ReturnType<typeof weaknessGroups>) =>
  groups.map(({ group, cards }) => ({ group, cards: cards.map((card) => card.name) }));

describe('weaknessGroups', () => {
  it('lists their own first, then the basic ones, then the others, each by name', () => {
    expect(names(weaknessGroups(all, roland, ''))).toEqual([
      { group: 'theirs', cards: ['Grudge'] },
      { group: 'basic', cards: ['Amnesia', 'Dread'] },
      { group: 'others', cards: ['Tome'] },
    ]);
  });

  it('keeps the names that contain the search, whatever their case, and drops empty groups', () => {
    expect(names(weaknessGroups(all, roland, ' dRe '))).toEqual([
      { group: 'basic', cards: ['Dread'] },
    ]);
  });
});
