import { describe, expect, it } from 'vitest';
import {
  blankEnemy,
  blankInvestigator,
  byCode,
  byId,
  byName,
  cardCode,
  describeMatcher,
  fuzzy,
  instanceId,
  investigatorCode,
  investigatorId,
  matchingCards,
  matchingInvestigators,
  newGame,
} from './index';

const ghoul_a = instanceId('ghoul_a');
const ghoul_b = instanceId('ghoul_b');
const ghoul_priest = instanceId('ghoul_priest');

describe('matchingCards', () => {
  const ghoulMinion = blankEnemy('Ghoul Minion');
  const { context, state } = newGame()
    .withCard(ghoul_a, ghoulMinion, { kind: 'setAside' })
    .withCard(ghoul_b, ghoulMinion, { kind: 'setAside' })
    .withCard(ghoul_priest, blankEnemy('Ghoul Priest'), { kind: 'setAside' })
    .start();
  const cards = [state.cards[ghoul_a]!, state.cards[ghoul_b]!, state.cards[ghoul_priest]!];

  it.each([
    { matcher: byName('Ghoul Minion'), found: [ghoul_a, ghoul_b] },
    { matcher: byName('ghoul minion.'), found: [ghoul_a, ghoul_b] },
    { matcher: byName('Ghoul'), found: [] },
    { matcher: byId(ghoul_b), found: [ghoul_b] },
    { matcher: byCode(cardCode('Ghoul Priest')), found: [ghoul_priest] },
    { matcher: fuzzy('ghoul'), found: [ghoul_a, ghoul_b, ghoul_priest] },
    { matcher: fuzzy('PRIEST'), found: [ghoul_priest] },
    { matcher: fuzzy('rat'), found: [] },
  ])('finds $found with $matcher', ({ matcher, found }) => {
    const matches = matchingCards(context, cards, matcher).map((card) => card.id);

    expect(matches).toEqual(found);
  });
});

describe('matchingInvestigators', () => {
  const roland = blankInvestigator('roland', {
    name: 'Roland Banks',
    code: investigatorCode('01001'),
  });
  const daisy = blankInvestigator('daisy', {
    name: 'Daisy Walker',
    code: investigatorCode('01002'),
  });
  const seated = [roland, daisy];

  it.each([
    { matcher: byId(investigatorId('daisy')), found: ['daisy'] },
    { matcher: byName('roland banks'), found: ['roland'] },
    { matcher: byCode(investigatorCode('01002')), found: ['daisy'] },
    { matcher: fuzzy('a'), found: ['roland', 'daisy'] },
    { matcher: fuzzy('walker'), found: ['daisy'] },
  ])('finds $found with $matcher', ({ matcher, found }) => {
    expect(matchingInvestigators(seated, matcher).map((inv) => inv.id)).toEqual(found);
  });
});

describe('describeMatcher', () => {
  it.each([
    { matcher: byName('Hallway'), text: 'named "Hallway"' },
    { matcher: byId(instanceId('study')), text: 'with id study' },
    { matcher: byCode(cardCode('01111')), text: 'with code 01111' },
    { matcher: fuzzy('hall'), text: 'with text "hall"' },
  ])('describes $matcher as $text', ({ matcher, text }) => {
    expect(describeMatcher(matcher)).toBe(text);
  });
});
