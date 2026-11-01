import { describe, expect, it } from 'vitest';
import {
  atLocation,
  cardCode,
  instanceId,
  investigatorId,
  newGame,
  playAreaOf,
  PlayTable,
  putIntoThreatArea,
  threatAreaOf,
  whenRevealed,
  type CardStats,
  type Command,
} from '@arkham/engine';
import { answer, cardIn, rejectionFrom, stateAfter } from '@arkham/engine/test/utils';
import { theGatheringCards } from './cards';

/** The card with `code` in the scenario's card data. */
const cardOf = (code: string): CardStats => cardIn(theGatheringCards, code);

describe('The Gathering card data', () => {
  it.each([
    {
      code: '01105',
      name: "What's Going On?!",
      front: '/bundles/cards/01105.png',
      back: '/bundles/cards/01105b.png',
    },
    {
      code: '01108',
      name: 'Trapped',
      front: '/bundles/cards/01108.png',
      back: '/bundles/cards/01108b.png',
    },
    {
      code: '01111',
      name: 'Study',
      front: '/bundles/cards/01111.png',
      back: '/bundles/cards/01111b.png',
    },
    { code: '01116', name: 'Ghoul Priest', front: '/bundles/cards/01116.png', back: undefined },
    { code: '01117', name: 'Lita Chantler', front: '/bundles/cards/01117.png', back: undefined },
    { code: '01162', name: 'Grasping Hands', front: '/bundles/cards/01162.png', back: undefined },
  ])('names the ArkhamDB pictures of $name', ({ code, front, back }) => {
    const card = theGatheringCards.get(cardCode(code));

    expect(card?.imageSrc).toBe(front);
    expect(card?.backImageSrc).toBe(back);
  });

  it.each([
    { code: '01111', name: 'Study', symbol: 'circle' },
    { code: '01112', name: 'Hallway', symbol: 'square' },
    { code: '01113', name: 'Attic', symbol: 'triangle' },
    { code: '01114', name: 'Cellar', symbol: 'plus' },
    { code: '01115', name: 'Parlor', symbol: 'diamond' },
  ])('gives $name its printed connection symbol, the $symbol', ({ code, symbol }) => {
    expect(cardOf(code).symbol).toBe(symbol);
  });

  it.each([
    { code: '01116', name: 'Ghoul Priest', keywords: ['hunter', 'prey', 'retaliate'] },
    { code: '01118', name: 'Flesh-Eater', keywords: ['spawn'] },
    { code: '01119', name: 'Icy Ghoul', keywords: ['spawn'] },
    { code: '01159', name: 'Swarm of Rats', keywords: ['hunter'] },
    { code: '01160', name: 'Ghoul Minion', keywords: [] },
    { code: '01161', name: 'Ravenous Ghoul', keywords: ['prey'] },
    { code: '01162', name: 'Grasping Hands', keywords: [] },
  ])('lists the keywords of $name', ({ code, keywords }) => {
    const names =
      theGatheringCards.get(cardCode(code))?.keywords?.map((keyword) => keyword.name) ?? [];

    expect(names).toEqual(keywords);
  });

  it.each([
    { code: '01118', name: 'Flesh-Eater', detail: 'Attic' },
    { code: '01119', name: 'Icy Ghoul', detail: 'Cellar' },
  ])('names the spawn location of $name', ({ code, detail }) => {
    const spawn = theGatheringCards.get(cardCode(code))?.keywords?.find((k) => k.name === 'spawn');

    expect(spawn?.detail).toBe(detail);
  });

  it.each([
    { code: '01164', name: 'Frozen in Fear' },
    { code: '01165', name: 'Dissonant Voices' },
  ])('puts $name into the threat area when revealed', ({ code }) => {
    expect(theGatheringCards.get(cardCode(code))?.abilities).toContainEqual(
      whenRevealed(putIntoThreatArea()),
    );
  });

  it('leaves Rotting Remains to be discarded after its revelation', () => {
    expect(theGatheringCards.get(cardCode('01163'))?.abilities).not.toContainEqual(
      whenRevealed(putIntoThreatArea()),
    );
  });
});

describe('Frozen in Fear', () => {
  const alice = investigatorId('alice');
  const parlor = instanceId('parlor');
  /** Alice in the revealed Parlor with Frozen in Fear in their threat area, on their turn. */
  const aliceFrozenInTheParlor = () =>
    PlayTable.start(
      newGame()
        .withLocation(parlor, cardOf('01115'), { revealed: true })
        .withInvestigator(alice, { locationId: parlor })
        .withCard(instanceId('frozen_in_fear'), cardOf('01164'), threatAreaOf(alice))
        .withTurnOf(alice),
    );

  it.each([
    { action: 'move', cost: 2 },
    { action: 'fight', cost: 2 },
    { action: 'evade', cost: 2 },
    { action: 'investigate', cost: 1 },
  ] as const)('makes the first $action of the round cost $cost', ({ action, cost }) => {
    expect(aliceFrozenInTheParlor().board.actionCost(alice, action)).toBe(cost);
  });

  it('makes a move after the first fight of the round cost the usual 1', () => {
    const table = aliceFrozenInTheParlor();

    table.spendActionFor(alice, 'fight');

    expect(table.board.actionCost(alice, 'move')).toBe(1);
  });
});

describe('Lita Chantler', () => {
  const alice = investigatorId('alice');
  const bob = investigatorId('bob');
  const parlor = instanceId('parlor');
  const lita = instanceId('lita_chantler');
  /** Alice and bob in the revealed Parlor; each test puts Lita Chantler in and picks the turn. */
  const aliceAndBobInTheParlor = newGame()
    .withLocation(parlor, cardOf('01115'), { revealed: true })
    .withInvestigator(alice, { locationId: parlor })
    .withInvestigator(bob, { locationId: parlor });
  const parley: Command = {
    type: 'UseCardAction',
    investigatorId: alice,
    cardId: lita,
    action: 0,
  };

  it.each([
    { result: 'pass', zone: playAreaOf(alice) },
    { result: 'fail', zone: atLocation(parlor) },
  ])(
    'lets alice Parley with an intellect (4) test; a $result leaves Lita in $zone.kind',
    ({ result, zone }) => {
      const { context, state: started } = aliceAndBobInTheParlor
        .withCard(lita, cardOf('01117'), atLocation(parlor))
        .withTurnOf(alice)
        .start();
      const tested = stateAfter(context, started, parley);

      const state = stateAfter(context, tested, answer('test:lita_chantler', result));

      expect(tested.pending).toMatchObject([{ skillTest: { skill: 'intellect', difficulty: 4 } }]);
      expect(state.cards[lita]?.zone).toEqual(zone);
    },
  );

  it('rejects a Parley from bob once alice controls Lita', () => {
    const { context, state } = aliceAndBobInTheParlor
      .withCard(lita, cardOf('01117'), playAreaOf(alice))
      .withTurnOf(bob)
      .start();

    expect(rejectionFrom(context, state, { ...parley, investigatorId: bob })).toEqual({
      code: 'cardActionUnavailable',
      cardId: lita,
      investigatorId: bob,
    });
  });
});
