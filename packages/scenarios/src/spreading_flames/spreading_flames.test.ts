import { describe, expect, it } from 'vitest';
import {
  cardDbWith,
  cardStats,
  checkInvariants,
  instanceId,
  investigatorId,
  neighbours,
  skillTestSuggestion,
  zoneKey,
  type Command,
  type GameState,
  type ScenarioContext,
} from '@arkham/engine';
import {
  codesIn,
  standardInvestigatorCards,
  startScenario,
  stateAfter,
} from '@arkham/engine/test/utils';
import {
  CAMPUS,
  SPREADING_FLAMES_CODES as codes,
  spreadingFlames,
  spreadingFlamesCards,
} from '../index';

const ctx: ScenarioContext = {
  cards: cardDbWith(spreadingFlamesCards, standardInvestigatorCards),
  scenario: spreadingFlames,
};

const yourFriendsRoom = instanceId('12113#1');
const servantOfFlame = instanceId('12114#1');
const miskatonicQuad = instanceId('12116#1');
const dormitories = instanceId('12117#1');
const scienceHall = instanceId('12118#1');
const warrenObservatory = instanceId('12119#1');
const orneLibrary = instanceId('12120#1');
const tank = investigatorId('tank');

/** Card names in the encounter discard, top first. */
function discardNames(state: GameState): string[] {
  return (state.order[zoneKey({ kind: 'encounterDiscard' })] ?? []).map(
    (id) => cardStats(ctx.cards, state.cards[id]!.code).name,
  );
}

describe('Spreading Flames setup', () => {
  it('puts the three agendas and four acts into their decks in stage order', () => {
    const state = startScenario(ctx, { playerCount: 2 });

    expect(codesIn(state, { kind: 'agendaDeck' })).toEqual(['12106', '12107', '12108']);
    expect(codesIn(state, { kind: 'actDeck' })).toEqual(['12109', '12110', '12111', '12112']);
  });

  it("starts the investigators in the revealed Your Friend's Room with two clues per investigator", () => {
    const state = startScenario(ctx, { playerCount: 3 });

    expect(codesIn(state, { kind: 'location', mapId: CAMPUS })).toEqual([codes.yourFriendsRoom]);
    expect(state.investigators.map((inv) => inv.locationId)).toEqual([
      yourFriendsRoom,
      yourFriendsRoom,
      yourFriendsRoom,
    ]);
    expect(state.cards[yourFriendsRoom]).toMatchObject({ faceUp: true, tokens: { clue: 6 } });
  });

  it('sets aside the five other locations, Dr. Henry Armitage, the Servant of Flame and the five Fire!', () => {
    const state = startScenario(ctx);

    expect(codesIn(state, { kind: 'setAside' })).toEqual([
      '12117',
      '12116',
      '12118',
      '12119',
      '12120',
      '12115',
      '12114',
      ...['12129', '12129', '12129', '12129', '12129'],
    ]);
  });

  it('shuffles the other 24 enemies and treacheries of the nine sets into the encounter deck', () => {
    const state = startScenario(ctx);

    const deck = codesIn(state, { kind: 'encounterDeck' }).sort();

    expect(deck).toEqual([
      ...['12121', '12121'],
      ...['12122', '12122'],
      ...['12123', '12123', '12123'],
      ...['12124', '12124', '12124'],
      ...['12125', '12125'],
      ...['12126', '12126'],
      ...['12127', '12127'],
      ...['12128', '12128'],
      ...['12130', '12130'],
      ...['12131', '12131'],
      ...['12132', '12132'],
    ]);
  });

  it.each([
    ['easy', 16],
    ['standard', 16],
    ['hard', 17],
    ['expert', 18],
  ] as const)('uses the %s chaos bag of %i tokens', (difficulty, size) => {
    const state = startScenario(ctx, { difficulty });

    expect(state.chaosBag).toEqual(spreadingFlames.chaosBag[difficulty]);
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
      const state = startScenario(ctx, { playerCount, seed });

      expect(checkInvariants(state)).toEqual([]);
    },
  );
});

describe('Spreading Flames reference card', () => {
  it('gives the tablet and elder thing modifiers per side and leaves the skull open', () => {
    const { easyStandard, hardExpert } = spreadingFlames.reference;

    expect([
      easyStandard.skull?.modifier,
      easyStandard.tablet?.modifier,
      easyStandard.elderThing?.modifier,
    ]).toEqual([undefined, -1, -3]);
    expect([
      hardExpert.skull?.modifier,
      hardExpert.tablet?.modifier,
      hardExpert.elderThing?.modifier,
    ]).toEqual([undefined, -2, -4]);
  });
});

describe('Spreading Flames skull token', () => {
  /** Tank's intellect 2 test in Your Friend's Room against difficulty 2, with the skull revealed. */
  function skull(state: GameState): number {
    const test = {
      investigatorId: tank,
      skill: 'intellect',
      difficulty: 2,
      locationId: yourFriendsRoom,
    } as const;
    const suggestion = skillTestSuggestion(ctx, state, test, { tokens: ['skull'] });
    return suggestion.trace.find((step) => step.source.kind === 'chaosToken')?.change ?? 0;
  }

  it.each([
    { difficulty: 'standard', advanced: 0, value: -1 },
    { difficulty: 'easy', advanced: 2, value: -3 },
    { difficulty: 'hard', advanced: 0, value: -2 },
    { difficulty: 'expert', advanced: 1, value: -3 },
  ] as const)(
    'is $value on $difficulty after $advanced acts advanced',
    ({ difficulty, advanced, value }) => {
      const advances: Command[] = Array.from({ length: advanced }, () => ({ type: 'AdvanceAct' }));
      const state = stateAfter(
        ctx,
        startScenario(ctx, { playerCount: 2, difficulty }),
        ...advances,
      );

      expect(skull(state)).toBe(value);
    },
  );
});

describe("Spreading Flames act 1, Where There's Smoke...", () => {
  const advanceSmoke: Command[] = [{ type: 'AdvanceAct' }];

  it('puts the Dormitories and Miskatonic Quad into play, connected to the room and each other', () => {
    const state = stateAfter(ctx, startScenario(ctx, { playerCount: 2 }), ...advanceSmoke);

    expect(codesIn(state, { kind: 'location', mapId: CAMPUS })).toEqual([
      codes.yourFriendsRoom,
      codes.dormitories,
      codes.miskatonicQuad,
    ]);
    expect(neighbours(ctx, state, dormitories)).toEqual([yourFriendsRoom, miskatonicQuad]);
    expect(checkInvariants(state)).toEqual([]);
  });

  it('spawns the Servant of Flame at the Dormitories', () => {
    const state = stateAfter(ctx, startScenario(ctx, { playerCount: 2 }), ...advanceSmoke);

    expect(state.cards[servantOfFlame]?.zone).toEqual({
      kind: 'atLocation',
      locationId: dormitories,
    });
  });

  it("attaches one Fire! to Your Friend's Room and puts the other four in the encounter discard", () => {
    const state = stateAfter(ctx, startScenario(ctx, { playerCount: 2 }), ...advanceSmoke);

    expect(codesIn(state, { kind: 'attachedTo', hostId: yourFriendsRoom })).toEqual([codes.fire]);
    expect(discardNames(state)).toEqual(['Fire!', 'Fire!', 'Fire!', 'Fire!']);
  });
});

describe('Spreading Flames act 2, Escape the Dorms', () => {
  const advanceToEscape: Command[] = [{ type: 'AdvanceAct' }];
  const advanceEscape: Command[] = [{ type: 'AdvanceAct' }];

  it("removes Your Friend's Room with its Fire! and puts the other three locations into play", () => {
    const atEscape = stateAfter(ctx, startScenario(ctx, { playerCount: 2 }), ...advanceToEscape);

    const state = stateAfter(ctx, atEscape, ...advanceEscape);

    expect(state.cards[yourFriendsRoom]?.zone).toEqual({ kind: 'outOfGame' });
    expect(codesIn(state, { kind: 'location', mapId: CAMPUS })).toEqual([
      codes.dormitories,
      codes.miskatonicQuad,
      codes.orneLibrary,
      codes.scienceHall,
      codes.warrenObservatory,
    ]);
    expect(neighbours(ctx, state, miskatonicQuad)).toEqual([
      dormitories,
      scienceHall,
      warrenObservatory,
      orneLibrary,
    ]);
    expect(discardNames(state)).toHaveLength(5);
  });

  it('sets the Servant of Flame aside without its damage', () => {
    const atEscape = stateAfter(ctx, startScenario(ctx, { playerCount: 2 }), ...advanceToEscape);
    const damaged = stateAfter(ctx, atEscape, {
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: servantOfFlame, token: 'damage', delta: 3 },
    });

    const state = stateAfter(ctx, damaged, ...advanceEscape);

    expect(state.cards[servantOfFlame]).toMatchObject({ zone: { kind: 'setAside' }, tokens: {} });
  });
});

describe('Spreading Flames act 3, Searching for Dr. Armitage', () => {
  const advanceToSearching: Command[] = [{ type: 'AdvanceAct' }, { type: 'AdvanceAct' }];
  const advanceSearching: Command[] = [{ type: 'AdvanceAct' }];

  it('puts the Servant of Flame at Miskatonic Quad with 3 clues per investigator on the Quad', () => {
    const atSearching = stateAfter(
      ctx,
      startScenario(ctx, { playerCount: 2 }),
      ...advanceToSearching,
    );

    const state = stateAfter(ctx, atSearching, ...advanceSearching);

    expect(state.cards[servantOfFlame]?.zone).toEqual({
      kind: 'atLocation',
      locationId: miskatonicQuad,
    });
    expect(state.cards[miskatonicQuad]?.tokens.clue).toBe(6);
  });
});
