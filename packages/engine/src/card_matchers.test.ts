import { describe, expect, it } from 'vitest';
import {
  blankEnemy,
  blankInvestigator,
  byAny,
  byCode,
  byId,
  byName,
  cardCode,
  cardMatcher,
  describeMatcher,
  enemyMatcher,
  enemyMatching,
  instanceId,
  investigatorCode,
  investigatorId,
  investigatorMatcher,
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
    { matcher: byAny('ghoul_b'), found: [ghoul_b] },
    { matcher: byAny('Ghoul Priest'), found: [ghoul_priest] },
    { matcher: byAny('ghoul minion.'), found: [ghoul_a, ghoul_b] },
    { matcher: byAny('Ghoul'), found: [] },
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
    { matcher: byAny('daisy'), found: ['daisy'] },
    { matcher: byAny('01001'), found: ['roland'] },
    { matcher: byAny('Daisy Walker'), found: ['daisy'] },
    { matcher: byAny('Walker'), found: [] },
  ])('finds $found with $matcher', ({ matcher, found }) => {
    expect(matchingInvestigators(seated, matcher).map((inv) => inv.id)).toEqual(found);
  });
});

describe('describeMatcher', () => {
  it.each([
    { matcher: byName('Hallway'), text: 'named "Hallway"' },
    { matcher: byId(instanceId('study')), text: 'with id study' },
    { matcher: byCode(cardCode('01111')), text: 'with code 01111' },
    { matcher: byAny('hall'), text: 'with id, code or name "hall"' },
    { matcher: enemyMatching(byName('Rat')), text: 'named "Rat"' },
    {
      matcher: enemyMatching(byName('Rat'), {
        engagedWith: investigatorId('daisy'),
        at: instanceId('study'),
      }),
      text: 'named "Rat" engaged with an investigator with id daisy at a location with id study',
    },
  ])('describes $matcher as $text', ({ matcher, text }) => {
    expect(describeMatcher(matcher)).toBe(text);
  });
});

describe('cardMatcher', () => {
  it.each([
    { ref: ghoul_a, matcher: byId(ghoul_a) },
    { ref: byId(ghoul_b), matcher: byId(ghoul_b) },
    { ref: byName('Ghoul Minion'), matcher: byName('Ghoul Minion') },
    { ref: byAny('ghoul_a'), matcher: byAny('ghoul_a') },
  ])('turns $ref into $matcher', ({ ref, matcher }) => {
    expect(cardMatcher(ref)).toEqual(matcher);
  });
});

describe('investigatorMatcher', () => {
  const daisy = investigatorId('daisy');

  it.each([
    { ref: daisy, matcher: byId(daisy) },
    { ref: byId(daisy), matcher: byId(daisy) },
    { ref: byName('Daisy Walker'), matcher: byName('Daisy Walker') },
    { ref: byAny('daisy'), matcher: byAny('daisy') },
  ])('turns $ref into $matcher', ({ ref, matcher }) => {
    expect(investigatorMatcher(ref)).toEqual(matcher);
  });
});

describe('enemyMatcher', () => {
  it.each([
    { ref: ghoul_a, matcher: byId(ghoul_a) },
    { ref: byName('Ghoul Minion'), matcher: byName('Ghoul Minion') },
    { ref: enemyMatching(ghoul_b), matcher: enemyMatching(ghoul_b) },
  ])('turns $ref into $matcher', ({ ref, matcher }) => {
    expect(enemyMatcher(ref)).toEqual(matcher);
  });
});
