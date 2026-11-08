import { describe, expect, it } from 'vitest';
import {
  campaign,
  cardDbWith,
  cardStats,
  checkInvariants,
  instanceId,
  investigatorCode,
  investigatorId,
  neighbours,
  skillTestSuggestion,
  zoneKey,
  type Command,
  type InvestigatorId,
  type Zone,
  type GameState,
  type ScenarioContext,
} from '@arkham/engine';
import {
  answer,
  codesIn,
  standardInvestigatorCards,
  startScenario,
  stateAfter,
} from '@arkham/engine/test/utils';
import {
  ASH_STORY,
  CAMPUS,
  SEARCHING_FOR_ARMITAGE_DECISION,
  STAY_OR_GO_DECISION,
  WHERE_THERES_SMOKE_DECISION,
  SPREADING_FLAMES_CODES as codes,
  spreadingFlames,
  spreadingFlamesCards,
  spreadingFlamesResolutions,
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

/** Card names in `zone`, top first. */
function namesIn(state: GameState, zone: Zone): string[] {
  return (state.order[zoneKey(zone)] ?? []).map(
    (id) => cardStats(ctx.cards, state.cards[id]!.code).name,
  );
}

/** Card names in the encounter discard, top first. */
function discardNames(state: GameState): string[] {
  return namesIn(state, { kind: 'encounterDiscard' });
}

/** Both investigators' turns, then the enemy and upkeep phases, which end round 1. */
const playRoundOne: Command[] = [
  { type: 'NextPhase' },
  { type: 'StartTurn', investigatorId: investigatorId('tank') },
  { type: 'EndTurn', investigatorId: investigatorId('tank') },
  { type: 'StartTurn', investigatorId: investigatorId('seeker') },
  { type: 'EndTurn', investigatorId: investigatorId('seeker') },
  { type: 'NextPhase' },
  { type: 'NextPhase' },
];

/** `amount` clues for the investigator, as discovering them would give. */
function cluesFor(investigator: InvestigatorId, amount: number): Command {
  return { type: 'AdjustInvestigator', investigatorId: investigator, stat: 'clues', delta: amount };
}

describe('Spreading Flames setup', () => {
  it('puts the three agendas and four acts into their decks in stage order', () => {
    const state = startScenario(ctx, { playerCount: 2 });

    expect(namesIn(state, { kind: 'agendaDeck' })).toEqual([
      'Past Curfew',
      'Lit Up',
      'Wild Flames',
    ]);
    expect(namesIn(state, { kind: 'actDeck' })).toEqual([
      "Where There's Smoke...",
      'Escape the Dorms',
      'Searching for Dr. Armitage',
      'Blaze of Glory',
    ]);
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

    expect(namesIn(state, { kind: 'setAside' })).toEqual([
      'Dormitories',
      'Miskatonic Quad',
      'Science Hall',
      'Warren Observatory',
      'Orne Library',
      'Dr. Henry Armitage',
      'Servant of Flame',
      ...['Fire!', 'Fire!', 'Fire!', 'Fire!', 'Fire!'],
    ]);
  });

  it('shuffles the other 24 enemies and treacheries of the nine sets into the encounter deck', () => {
    const state = startScenario(ctx);

    const deck = namesIn(state, { kind: 'encounterDeck' }).sort();

    expect(deck).toEqual([
      ...['Bystander', 'Bystander', 'Bystander'],
      ...['Cantor of Flame', 'Cantor of Flame'],
      ...['Cosmic Evils', 'Cosmic Evils', 'Cosmic Evils'],
      ...['Extraplanar Visions', 'Extraplanar Visions'],
      ...['Forbidden Secrets', 'Forbidden Secrets'],
      ...['Hellhound', 'Hellhound'],
      ...['Mutated Experiment', 'Mutated Experiment'],
      ...['Mutated!', 'Mutated!'],
      ...['Noxious Smoke', 'Noxious Smoke'],
      ...['Unspeakable Truths', 'Unspeakable Truths'],
      ...['Wild Compulsion', 'Wild Compulsion'],
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

  it('asks as round 1 ends once the investigators hold 2 clues each between them, wherever they are', () => {
    const state = stateAfter(
      ctx,
      startScenario(ctx, { playerCount: 2 }),
      cluesFor(tank, 4),
      ...playRoundOne,
    );

    expect(state.pending.map((decision) => decision.id)).toEqual([WHERE_THERES_SMOKE_DECISION]);
  });

  it('discards the enemies in play, engaged ones included', () => {
    const cantorOfFlame = instanceId('12121#1');
    const hellhound = instanceId('12122#1');
    const withEnemies = stateAfter(
      ctx,
      startScenario(ctx, { playerCount: 2 }),
      {
        type: 'ManualAdjust',
        adjustment: {
          kind: 'moveCard',
          cardId: cantorOfFlame,
          to: { kind: 'atLocation', locationId: yourFriendsRoom },
        },
      },
      {
        type: 'ManualAdjust',
        adjustment: {
          kind: 'moveCard',
          cardId: hellhound,
          to: { kind: 'engaged', investigatorId: tank },
        },
      },
    );

    const state = stateAfter(ctx, withEnemies, ...advanceSmoke);

    expect(discardNames(state)).toEqual(expect.arrayContaining(['Cantor of Flame', 'Hellhound']));
    expect(state.cards[cantorOfFlame]?.zone).toEqual({ kind: 'encounterDiscard' });
    expect(state.cards[hellhound]?.zone).toEqual({ kind: 'encounterDiscard' });
  });

  it('puts only the Fire! still set aside in the encounter discard after Lit Up placed four', () => {
    const fourFireDiscarded = stateAfter(
      ctx,
      startScenario(ctx, { playerCount: 2 }),
      ...['12129#1', '12129#2', '12129#3', '12129#4'].map((fire): Command => ({
        type: 'ManualAdjust',
        adjustment: {
          kind: 'moveCard',
          cardId: instanceId(fire),
          to: { kind: 'encounterDiscard' },
        },
      })),
    );

    const state = stateAfter(ctx, fourFireDiscarded, ...advanceSmoke);

    expect(codesIn(state, { kind: 'attachedTo', hostId: yourFriendsRoom })).toEqual([codes.fire]);
    expect(discardNames(state)).toEqual(['Fire!', 'Fire!', 'Fire!', 'Fire!']);
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
    expect(discardNames(state)).toEqual(['Fire!', 'Fire!', 'Fire!', 'Fire!', 'Fire!']);
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

  it.each([
    { at: 'Orne Library', location: orneLibrary, asked: [SEARCHING_FOR_ARMITAGE_DECISION] },
    { at: 'Miskatonic Quad', location: miskatonicQuad, asked: [] },
  ])(
    'asks as round 1 ends with both investigators and their 6 clues at $at: $asked',
    ({ location, asked }) => {
      const atSearching = stateAfter(
        ctx,
        startScenario(ctx, { playerCount: 2 }),
        ...advanceToSearching,
      );
      const moved = stateAfter(
        ctx,
        atSearching,
        ...[tank, investigatorId('seeker')].map((investigator): Command => ({
          type: 'MoveInvestigator',
          investigatorId: investigator,
          to: location,
          ignoreConnections: true,
        })),
        cluesFor(tank, 6),
      );

      const state = stateAfter(ctx, moved, ...playRoundOne);

      expect(state.pending.map((decision) => decision.id)).toEqual(asked);
    },
  );

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

describe('Spreading Flames act 4, Blaze of Glory, and the resolutions', () => {
  /** Acts 1 to 3 advance without paying; act 3 puts the Servant of Flame at Miskatonic Quad. */
  function atBlazeOfGlory(): GameState {
    return stateAfter(
      ctx,
      startScenario(ctx, { playerCount: 2 }),
      { type: 'AdvanceAct' },
      { type: 'AdvanceAct' },
      { type: 'AdvanceAct' },
    );
  }

  it('asks the lead to stay or go once the Servant of Flame is defeated', () => {
    const asked = stateAfter(ctx, atBlazeOfGlory(), {
      type: 'DefeatEnemy',
      enemyId: servantOfFlame,
    });

    expect(asked.pending).toMatchObject([
      {
        id: STAY_OR_GO_DECISION,
        decider: { kind: 'lead' },
        options: [{ id: 'stay' }, { id: 'go' }],
      },
    ]);
  });

  it.each([
    { option: 'stay', resolution: 'R2', saved: true, trauma: 'physical' },
    { option: 'go', resolution: 'R3', saved: false, trauma: 'mental' },
  ] as const)(
    'ends with $resolution when the lead chooses to $option, recording saved=$saved and $trauma trauma',
    ({ option, resolution, saved, trauma }) => {
      const asked = stateAfter(ctx, atBlazeOfGlory(), {
        type: 'DefeatEnemy',
        enemyId: servantOfFlame,
      });

      const ended = stateAfter(ctx, asked, answer(STAY_OR_GO_DECISION, option));
      const proposal = campaign.proposeResolution(ctx, ended, spreadingFlamesResolutions) ?? [];

      expect(ended.meta).toMatchObject({ ended: true, resolution });
      expect(proposal).toContainEqual({
        kind: 'command',
        command: {
          type: 'RecordStory',
          key: ASH_STORY.savedMiskatonicUniversity,
          value: { kind: 'flag', value: saved },
        },
      });
      expect(proposal).toContainEqual({
        kind: 'command',
        command: {
          type: 'RecordStory',
          key: ASH_STORY.defeatedTheirMaskedPursuer,
          value: { kind: 'flag', value: true },
        },
      });
      expect(proposal).toContainEqual({
        kind: 'choice',
        options: [tank, investigatorId('seeker')].map((investigator) => ({
          type: 'EarnCard',
          code: investigatorCode(investigator),
          card: codes.drHenryArmitage,
        })),
      });
      expect(proposal).toContainEqual({
        kind: 'command',
        command: { type: 'AddTrauma', code: investigatorCode(tank), kind: trauma, amount: 1 },
      });
    },
  );
});

describe('Spreading Flames without a resolution', () => {
  it('records the burned university and 1 mental trauma each once Wild Flames defeats everyone', () => {
    const ended = stateAfter(
      ctx,
      startScenario(ctx, { playerCount: 2 }),
      { type: 'AdvanceAgenda' },
      { type: 'AdvanceAgenda' },
      { type: 'AdvanceAgenda' },
    );

    const proposal = campaign.proposeResolution(ctx, ended, spreadingFlamesResolutions) ?? [];

    expect(proposal).toContainEqual({
      kind: 'command',
      command: {
        type: 'RecordStory',
        key: ASH_STORY.savedMiskatonicUniversity,
        value: { kind: 'flag', value: false },
      },
    });
    expect(proposal).toContainEqual({
      kind: 'command',
      command: { type: 'AddTrauma', code: investigatorCode(tank), kind: 'mental', amount: 1 },
    });
  });
});
