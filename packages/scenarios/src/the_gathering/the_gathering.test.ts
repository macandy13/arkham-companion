import { describe, expect, it } from 'vitest';
import {
  cardDbWith,
  checkInvariants,
  scenario,
  instanceId,
  investigatorId,
  mapId,
  neighbours,
  cardStats,
  skillTestSuggestion,
  matchesEncounter,
  trait,
  zoneKey,
  type CardCode,
  type Command,
  type Zone,
  type ScenarioContext,
  type GameState,
} from '@arkham/engine';
import {
  codesIn,
  makeDefinition,
  makeSetupOptions,
  runFrom,
  standardInvestigatorCards,
  startScenario,
  stateAfter,
} from '@arkham/engine/test/utils';
import {
  BURN_THE_HOUSE_DECISION,
  GATHERING_CODES as codes,
  theGathering,
  theGatheringCards,
  theGatheringHouse,
} from '../index';

const ctx: ScenarioContext = {
  cards: cardDbWith(theGatheringCards, standardInvestigatorCards),
  scenario: theGathering,
};

/** Card names in `zone`, top first. */
function namesIn(state: GameState, zone: Zone): string[] {
  return (state.order[zoneKey(zone)] ?? []).map(
    (id) => cardStats(ctx.cards, state.cards[id]!.code).name,
  );
}

const study = mapId('study');

describe('The Gathering setup', () => {
  it('puts the three agendas and three acts into their decks in stage order', () => {
    const state = startScenario(ctx, { playerCount: 2 });

    expect(codesIn(state, { kind: 'agendaDeck' })).toEqual(['01105', '01106', '01107']);
    expect(codesIn(state, { kind: 'actDeck' })).toEqual(['01108', '01109', '01110']);
  });

  it('starts the investigators in the revealed Study with two clues per investigator', () => {
    const state = startScenario(ctx, { playerCount: 3 });

    expect(codesIn(state, { kind: 'location', mapId: study })).toEqual([codes.study]);
    expect(state.investigators.map((inv) => inv.locationId)).toEqual([
      '01111#1',
      '01111#1',
      '01111#1',
    ]);
    expect(state.cards[instanceId('01111#1')]).toMatchObject({ faceUp: true, tokens: { clue: 6 } });
  });

  it('sets aside the other four locations, the Ghoul Priest and Lita Chantler', () => {
    const state = startScenario(ctx);

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
    const state = startScenario(ctx);

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
    const state = startScenario(ctx, { difficulty });

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
      const state = startScenario(ctx, { playerCount, seed });

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

describe('The Gathering skull token', () => {
  const studyCard = instanceId('01111#1');
  const icyGhoul = instanceId('01119#1');
  const fleshEater = instanceId('01118#1');
  const tank = investigatorId('tank');

  /** Tank's intellect 2 test in the Study against difficulty 2, with the skull revealed. */
  function skullInStudy(state: GameState): number {
    const test = {
      investigatorId: tank,
      skill: 'intellect',
      difficulty: 2,
      locationId: studyCard,
    } as const;
    const suggestion = skillTestSuggestion(ctx, state, test, { tokens: ['skull'] });
    return suggestion.trace.find((step) => step.source.kind === 'chaosToken')?.change ?? 0;
  }

  it('is -X on Standard, X being the Ghoul enemies at the location, engaged ones included', () => {
    const twoGhouls = stateAfter(
      ctx,
      startScenario(ctx, { playerCount: 2 }),
      {
        type: 'ManualAdjust',
        adjustment: {
          kind: 'moveCard',
          cardId: icyGhoul,
          to: { kind: 'engaged', investigatorId: tank },
        },
      },
      {
        type: 'ManualAdjust',
        adjustment: {
          kind: 'moveCard',
          cardId: fleshEater,
          to: { kind: 'atLocation', locationId: studyCard },
        },
      },
    );

    expect(skullInStudy(twoGhouls)).toBe(-2);
  });

  it('is 0 on Standard with no Ghoul at the location', () => {
    expect(skullInStudy(startScenario(ctx, { playerCount: 2 }))).toBe(0);
  });
});

describe('The Gathering house (after act 1)', () => {
  it('connects the Hallway to the Attic, the Cellar and the Parlor', () => {
    const def = makeDefinition({ setup: [theGatheringHouse] });

    const command = scenario.compileSetup({ ...ctx, scenario: def }, makeSetupOptions());

    expect(command.maps?.[mapId('house')]?.connections).toEqual([
      { from: '01112#1', to: '01113#1', oneWay: false },
      { from: '01112#1', to: '01114#1', oneWay: false },
      { from: '01112#1', to: '01115#1', oneWay: false },
    ]);
  });
});

describe('The Gathering act 1 reverse side', () => {
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
    return startScenario(ctx, { playerCount: 2 });
  }

  it('puts the house into play with the Hallway connected to the other three rooms', () => {
    const state = stateAfter(ctx, startTwoPlayer(), ...advanceTrapped);

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
    const state = stateAfter(ctx, startTwoPlayer(), ...advanceTrapped);

    expect(state.investigators.map((inv) => inv.locationId)).toEqual([hallway, hallway]);
    expect(state.cards[hallway]?.faceUp).toBe(true);
    expect(codesIn(state, { kind: 'location', mapId: study })).toEqual([]);
    expect(state.cards[studyCard]?.zone).toEqual({ kind: 'outOfGame' });
  });

  it('discards the enemies in the Study, engaged ones included', () => {
    const fleshEater = instanceId('01118#1');
    const icyGhoul = instanceId('01119#1');
    const withEnemies = stateAfter(
      ctx,
      startTwoPlayer(),
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
    );

    const state = stateAfter(ctx, withEnemies, ...advanceTrapped);

    expect(codesIn(state, { kind: 'encounterDiscard' })).toEqual(['01118', '01119']);
  });

  it('resolves before act 2 becomes current', () => {
    const { events } = runFrom(ctx, startTwoPlayer(), advanceTrapped);

    expect(events.slice(-3)).toMatchObject([
      { type: 'CardMoved', cardId: studyCard, to: { kind: 'outOfGame' } },
      { type: 'CardMoved', cardId: '01108#1', to: { kind: 'outOfGame' } },
      { type: 'CurrentCardChanged', deck: 'act', cardId: '01109#1' },
    ]);
  });
});

describe('The Gathering enemies', () => {
  const fleshEater = instanceId('01118#1');
  const priest = instanceId('01116#1');
  const attic = instanceId('01113#1');
  const hallway = instanceId('01112#1');
  const tank = investigatorId('tank');
  const seeker = investigatorId('seeker');
  const studyCard = instanceId('01111#1');
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
  const start = () => startScenario(ctx, { playerCount: 2 });

  it('discards the Flesh-Eater while the Attic is not in play', () => {
    const { state } = runFrom(ctx, start(), [
      { type: 'SpawnEnemy', enemyId: fleshEater, investigatorId: tank },
    ]);

    expect(state.cards[fleshEater]?.zone).toEqual({ kind: 'encounterDiscard' });
  });

  it('spawns the Flesh-Eater at the Attic once the house is in play', () => {
    const { state } = runFrom(ctx, start(), [
      ...advanceTrapped,
      { type: 'SpawnEnemy', enemyId: fleshEater, investigatorId: tank },
    ]);

    expect(state.cards[fleshEater]?.zone).toEqual({ kind: 'atLocation', locationId: attic });
  });

  it('lets the hunting Ghoul Priest walk to the Hallway and ask whom to engage', () => {
    const { state } = runFrom(ctx, start(), [
      ...advanceTrapped,
      { type: 'SpawnEnemy', enemyId: priest, at: attic },
      { type: 'MoveHunters' },
    ]);

    // Prey "Highest [combat]" needs investigator card data, so the players choose.
    expect(state.cards[priest]?.zone).toEqual({ kind: 'atLocation', locationId: hallway });
    expect(state.pending).toMatchObject([{ kind: 'chooseInvestigator', subject: priest }]);
    expect(checkInvariants(state)).toEqual([]);
  });
});

describe('The Gathering acts 2 and 3', () => {
  const hallway = instanceId('01112#1');
  const attic = instanceId('01113#1');
  const parlor = instanceId('01115#1');
  const priest = instanceId('01116#1');
  const lita = instanceId('01117#1');
  const fleshEater = instanceId('01118#1');
  const theBarrier = instanceId('01109#1');
  const whatHaveYouDone = instanceId('01110#1');
  const tank = investigatorId('tank');

  /**
   * Two investigators; act 1 (house into play, everyone to the Hallway) and act 2 advance without paying.
   * Act 2 stays current until its reverse side has resolved, the Ghoul Priest's prey question included.
   */
  function act2WaitingForPrey(): GameState {
    return stateAfter(
      ctx,
      startScenario(ctx, { playerCount: 2 }),
      { type: 'AdvanceAct' },
      { type: 'AdvanceAct' },
    );
  }

  /** `state` with the Ghoul Priest's prey question answered: it engages `investigator`. */
  function priestEngages(state: GameState, investigator: typeof tank): GameState {
    const preyQuestion = state.pending.find((decision) => decision.subject === priest);
    return stateAfter(ctx, state, {
      type: 'ResolveDecision',
      decisionId: preyQuestion!.id,
      optionId: investigator,
    });
  }

  it('reveals the Parlor, puts Lita Chantler there and spawns the Ghoul Priest in the Hallway', () => {
    const state = act2WaitingForPrey();

    expect(state.cards[parlor]?.faceUp).toBe(true);
    expect(state.cards[lita]?.zone).toEqual({ kind: 'atLocation', locationId: parlor });
    // In the Hallway with both investigators; its prey (highest combat) is the players' call.
    expect(state.pending).toMatchObject([{ kind: 'chooseInvestigator', subject: priest }]);
    expect(codesIn(state, { kind: 'atLocation', locationId: hallway })).toEqual([
      codes.ghoulPriest,
    ]);
    expect(state.act.current).toBe(theBarrier);
    expect(priestEngages(state, tank).act.current).toBe(whatHaveYouDone);
    expect(checkInvariants(state)).toEqual([]);
  });

  it('advances act 3 when the Ghoul Priest is defeated and asks the lead whether to burn the house', () => {
    const asked = stateAfter(ctx, priestEngages(act2WaitingForPrey(), tank), {
      type: 'DefeatEnemy',
      enemyId: priest,
    });

    expect(asked.act.current).toBe(whatHaveYouDone);
    expect(asked.pending).toMatchObject([
      {
        id: BURN_THE_HOUSE_DECISION,
        kind: 'chooseOption',
        decider: { kind: 'lead' },
        options: [{ id: 'burn' }, { id: 'spare' }],
      },
    ]);
  });

  it.each([
    ['burn', 'R1'],
    ['spare', 'R2'],
  ])('ends the scenario with the lead choosing to %s the house (%s)', (optionId, resolution) => {
    const asked = stateAfter(ctx, priestEngages(act2WaitingForPrey(), tank), {
      type: 'DefeatEnemy',
      enemyId: priest,
    });

    const ended = stateAfter(ctx, asked, {
      type: 'ResolveDecision',
      decisionId: BURN_THE_HOUSE_DECISION,
      optionId,
    });

    expect(ended.meta).toMatchObject({ ended: true, resolution });
    expect(ended.act.current).toBeUndefined();
  });

  it('does not advance act 3 when another enemy is defeated', () => {
    // In the empty Attic, so it engages nobody.
    const withFleshEater = stateAfter(ctx, priestEngages(act2WaitingForPrey(), tank), {
      type: 'SpawnEnemy',
      enemyId: fleshEater,
      at: attic,
    });

    const state = stateAfter(ctx, withFleshEater, { type: 'DefeatEnemy', enemyId: fleshEater });

    expect(state.act.current).toBe(whatHaveYouDone);
  });
});

describe('The Gathering agendas 2 and 3', () => {
  const tank = investigatorId('tank');
  const seeker = investigatorId('seeker');
  const fleshEater = instanceId('01118#1');
  const ratSwarm = instanceId('01159#1');
  const priest = instanceId('01116#1');
  const theyreGettingOut = instanceId('01107#1');
  const secondGhoulMinion = instanceId('01160#2');
  const ghoulEnemy = { trait: trait('Ghoul'), typeCode: 'enemy' } as const;
  const isGhoulEnemy = (code: CardCode) => matchesEncounter(cardStats(ctx.cards, code), ghoulEnemy);
  const toDiscard = (cardId: typeof fleshEater): Command => ({
    type: 'ManualAdjust',
    adjustment: { kind: 'moveCard', cardId, to: { kind: 'encounterDiscard' } },
  });

  /** Two investigators (seed 1), the Flesh-Eater and a Swarm of Rats in the discard, agenda 1 advanced. */
  function atAgenda2(): GameState {
    return stateAfter(
      ctx,
      startScenario(ctx, { playerCount: 2 }),
      { type: 'AdvanceAct' },
      toDiscard(fleshEater),
      toDiscard(ratSwarm),
      { type: 'AdvanceAgenda' },
    );
  }

  it('shuffles the discard back and makes the lead draw the first Ghoul enemy', () => {
    const { state, events } = runFrom(ctx, atAgenda2(), [{ type: 'AdvanceAgenda' }]);

    const drawn = events.find((event) => event.type === 'EncounterCardDrawn');
    expect(drawn).toMatchObject({ investigatorId: tank, cardId: secondGhoulMinion });
    expect(state.cards[secondGhoulMinion]?.zone).toEqual({
      kind: 'engaged',
      investigatorId: tank,
    });
    // The three cards turned over above it; the Flesh-Eater and the rats went back into the deck.
    expect(namesIn(state, { kind: 'encounterDiscard' })).toEqual([
      'Crypt Chill',
      'Crypt Chill',
      'Ancient Evils',
    ]);
    expect(state.cards[fleshEater]?.zone).toEqual({ kind: 'encounterDeck' });
    expect(state.cards[ratSwarm]?.zone).toEqual({ kind: 'encounterDeck' });
    expect(state.agenda.current).toBe(theyreGettingOut);
  });

  it('only shuffles when no Ghoul enemy is left among the encounter cards', () => {
    const ghoulEnemies = Object.values(atAgenda2().cards).filter((card) => isGhoulEnemy(card.code));
    const noGhouls = stateAfter(
      ctx,
      atAgenda2(),
      ...ghoulEnemies.map((card): Command => ({
        type: 'ManualAdjust',
        adjustment: { kind: 'moveCard', cardId: card.id, to: { kind: 'outOfGame' } },
      })),
    );

    const { events } = runFrom(ctx, noGhouls, [{ type: 'AdvanceAgenda' }]);

    expect(events.map((event) => event.type)).toContain('DeckShuffled');
    expect(events.map((event) => event.type)).not.toContain('EncounterCardDrawn');
  });

  it('traps the investigators (R3) when agenda 3 advances before act 3', () => {
    const atAgenda3 = stateAfter(ctx, atAgenda2(), { type: 'AdvanceAgenda' });

    const ended = stateAfter(ctx, atAgenda3, { type: 'AdvanceAgenda' });

    expect(ended.meta).toMatchObject({ ended: true, resolution: 'R3' });
  });

  it('defeats every investigator who has not resigned when agenda 3 advances at act 3', () => {
    const atAct3 = stateAfter(ctx, atAgenda2(), { type: 'AdvanceAgenda' }, { type: 'AdvanceAct' });
    const preyQuestion = atAct3.pending.find((decision) => decision.subject === priest);
    const priestOnTank = stateAfter(ctx, atAct3, {
      type: 'ResolveDecision',
      decisionId: preyQuestion!.id,
      optionId: tank,
    });

    const { state, events } = runFrom(ctx, priestOnTank, [{ type: 'AdvanceAgenda' }]);

    expect(events.filter((event) => event.type === 'InvestigatorDefeated')).toEqual([
      { type: 'InvestigatorDefeated', investigatorId: seeker, cause: 'cardEffect' },
      { type: 'InvestigatorDefeated', investigatorId: tank, cause: 'cardEffect' },
    ]);
    expect(state.meta.ended).toBe(true);
    expect(state.meta.resolution).toBeUndefined();
    expect(state.pending).toEqual([]);
  });
});
