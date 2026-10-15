import { describe, expect, it } from 'vitest';
import {
  checkInvariants,
  compileSetup,
  instanceId,
  investigatorId,
  mapId,
  neighbours,
  type Command,
  type EngineContext,
  type GameState,
} from '@arkham/engine';
import {
  codesIn,
  makeDefinition,
  makeSetupOptions,
  runFrom,
  startScenario,
} from '@arkham/engine/test/utils';
import {
  GATHERING_CODES as codes,
  theGathering,
  theGatheringCards,
  theGatheringHouse,
} from '../index';

const ctx: EngineContext = { cards: theGatheringCards };
const study = mapId('study');

describe('The Gathering setup', () => {
  it('puts the three agendas and three acts into their decks in stage order', () => {
    const state = startScenario(ctx, theGathering, { playerCount: 2 });

    expect(codesIn(state, { kind: 'agendaDeck' })).toEqual(['01105', '01106', '01107']);
    expect(codesIn(state, { kind: 'actDeck' })).toEqual(['01108', '01109', '01110']);
  });

  it('starts the investigators in the revealed Study with two clues per investigator', () => {
    const state = startScenario(ctx, theGathering, { playerCount: 3 });

    expect(codesIn(state, { kind: 'location', mapId: study })).toEqual([codes.study]);
    expect(state.investigators.map((inv) => inv.locationId)).toEqual([
      '01111#1',
      '01111#1',
      '01111#1',
    ]);
    expect(state.cards[instanceId('01111#1')]).toMatchObject({ faceUp: true, tokens: { clue: 6 } });
  });

  it('sets aside the other four locations, the Ghoul Priest and Lita Chantler', () => {
    const state = startScenario(ctx, theGathering);

    expect(codesIn(state, { kind: 'setAside' })).toEqual([
      '01112',
      '01113',
      '01114',
      '01115',
      '01116',
      '01117',
    ]);
  });

  it('shuffles the remaining 26 enemies and treacheries of the six sets into the encounter deck', () => {
    const state = startScenario(ctx, theGathering);

    const deck = codesIn(state, { kind: 'encounterDeck' }).sort();

    expect(deck).toEqual([
      '01118',
      '01119',
      ...['01159', '01159', '01159'],
      ...['01160', '01160', '01160'],
      '01161',
      ...['01162', '01162', '01162'],
      ...['01163', '01163', '01163'],
      ...['01164', '01164'],
      ...['01165', '01165'],
      ...['01166', '01166', '01166'],
      ...['01167', '01167'],
      ...['01168', '01168'],
    ]);
  });

  it.each([
    ['easy', 16],
    ['standard', 16],
    ['hard', 17],
    ['expert', 18],
  ] as const)('uses the %s chaos bag of %i tokens', (difficulty, size) => {
    const state = startScenario(ctx, theGathering, { difficulty });

    expect(state.chaosBag).toEqual(theGathering.chaosBag[difficulty]);
    expect(state.chaosBag).toHaveLength(size);
  });

  it.each([
    { playerCount: 1, seed: 1 },
    { playerCount: 2, seed: -7 },
    { playerCount: 3, seed: 2 ** 31 - 1 },
    { playerCount: 4, seed: 0 },
  ])(
    'sets up a consistent state for $playerCount investigators (seed $seed)',
    ({ playerCount, seed }) => {
      const state = startScenario(ctx, theGathering, { playerCount, seed });

      expect(checkInvariants(state)).toEqual([]);
      expect(codesIn(state, { kind: 'encounterDeck' })).toHaveLength(26);
    },
  );
});

describe('The Gathering reference card', () => {
  it('gives the cultist and tablet modifiers per side and leaves the variable ones open', () => {
    const { easyStandard, hardExpert } = theGathering.reference;

    expect([
      easyStandard.skull?.modifier,
      easyStandard.cultist?.modifier,
      easyStandard.tablet?.modifier,
    ]).toEqual([undefined, -1, -2]);
    expect([
      hardExpert.skull?.modifier,
      hardExpert.cultist?.modifier,
      hardExpert.tablet?.modifier,
    ]).toEqual([-2, undefined, -4]);
  });

  it('uses no elder thing effect', () => {
    expect(theGathering.reference.easyStandard.elderThing).toBeUndefined();
    expect(theGathering.reference.hardExpert.elderThing).toBeUndefined();
  });
});

describe('The Gathering house (after act 1)', () => {
  it('connects the Hallway to the Attic, the Cellar and the Parlor', () => {
    const def = makeDefinition({ setup: [theGatheringHouse] });

    const command = compileSetup(ctx, def, makeSetupOptions());

    expect(command.maps?.[mapId('house')]?.connections).toEqual([
      { from: '01112#1', to: '01113#1', oneWay: false },
      { from: '01112#1', to: '01114#1', oneWay: false },
      { from: '01112#1', to: '01115#1', oneWay: false },
    ]);
  });
});

describe('The Gathering act 1 reverse side', () => {
  const playing: EngineContext = { cards: theGatheringCards, hooks: theGathering.hooks };
  const studyCard = instanceId('01111#1');
  const hallway = instanceId('01112#1');
  const tank = investigatorId('tank');
  const seeker = investigatorId('seeker');

  /** Both investigators take the Study's 4 clues and spend 2 each to advance act 1. */
  const advanceTrapped: Command[] = [
    { type: 'DiscoverClues', investigatorId: tank, locationId: studyCard, amount: 2 },
    { type: 'DiscoverClues', investigatorId: seeker, locationId: studyCard, amount: 2 },
    {
      type: 'AdvanceAct',
      spend: [
        { investigatorId: tank, amount: 2 },
        { investigatorId: seeker, amount: 2 },
      ],
    },
  ];

  function startTwoPlayer(): GameState {
    return startScenario(playing, theGathering, { playerCount: 2 });
  }

  it('puts the house into play with the Hallway connected to the other three rooms', () => {
    const { state } = runFrom(playing, startTwoPlayer(), advanceTrapped);

    expect(codesIn(state, { kind: 'location', mapId: mapId('house') })).toEqual([
      codes.hallway,
      codes.attic,
      codes.cellar,
      codes.parlor,
    ]);
    expect(neighbours(state, hallway)).toEqual(['01113#1', '01114#1', '01115#1']);
    expect(checkInvariants(state)).toEqual([]);
  });

  it('moves every investigator to the revealed Hallway and removes the Study', () => {
    const { state } = runFrom(playing, startTwoPlayer(), advanceTrapped);

    expect(state.investigators.map((inv) => inv.locationId)).toEqual([hallway, hallway]);
    expect(state.cards[hallway]?.faceUp).toBe(true);
    expect(codesIn(state, { kind: 'location', mapId: study })).toEqual([]);
    expect(state.cards[studyCard]?.zone).toEqual({ kind: 'outOfGame' });
  });

  it('discards the enemies in the Study, engaged ones included', () => {
    const fleshEater = instanceId('01118#1');
    const icyGhoul = instanceId('01119#1');
    const withEnemies = runFrom(playing, startTwoPlayer(), [
      {
        type: 'ManualAdjust',
        adjustment: {
          kind: 'moveCard',
          cardId: fleshEater,
          to: { kind: 'atLocation', locationId: studyCard },
        },
      },
      {
        type: 'ManualAdjust',
        adjustment: {
          kind: 'moveCard',
          cardId: icyGhoul,
          to: { kind: 'engaged', investigatorId: seeker },
        },
      },
    ]).state;

    const { state } = runFrom(playing, withEnemies, advanceTrapped);

    expect(codesIn(state, { kind: 'encounterDiscard' })).toEqual(['01118', '01119']);
  });

  it('resolves before act 2 becomes current', () => {
    const { events } = runFrom(playing, startTwoPlayer(), advanceTrapped);

    expect(events.slice(-3)).toMatchObject([
      { type: 'CardMoved', cardId: studyCard, to: { kind: 'outOfGame' } },
      { type: 'CardMoved', cardId: '01108#1', to: { kind: 'outOfGame' } },
      { type: 'CurrentCardChanged', deck: 'act', cardId: '01109#1' },
    ]);
  });
});
