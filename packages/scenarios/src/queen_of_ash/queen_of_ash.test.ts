import { describe, expect, it } from 'vitest';
import {
  atLocation,
  cardDbWith,
  cardStats,
  checkInvariants,
  instanceId,
  investigatorId,
  newGame,
  scenario,
  skillTestSuggestion,
  zoneKey,
  type CampaignLog,
  type Command,
  type GameState,
  type InstanceId,
  type ScenarioContext,
  type Zone,
} from '@arkham/engine';
import {
  answer,
  makeCampaignLog,
  rolandMember,
  standardInvestigatorCards,
  startScenario,
  stateAfter,
} from '@arkham/engine/test/utils';
import {
  ASH_STORY,
  QUEEN_OF_ASH_CODES as codes,
  QUEEN_OF_ASH_RESOLUTIONS,
  SEWERS,
  SLUICE_CONTROL_DECISION,
  queenOfAsh,
  queenOfAshCards,
  spreadingFlames,
} from '../index';
import { rolandBanks, zealotInvestigatorCards } from '../investigators';

const ctx: ScenarioContext = {
  cards: cardDbWith(queenOfAshCards, standardInvestigatorCards),
  scenario: queenOfAsh,
};

const tank = investigatorId('tank');
const aGathering = instanceId('12169#1');
const undergroundCistern = instanceId('12174#1');
const sewerCulvert = instanceId('12182#1');
const overgrownTunnels = instanceId('12184#1');
const fire = instanceId('12129#1');

/** Card names in `zone`, top first. */
function namesIn(state: GameState, zone: Zone): string[] {
  return (state.order[zoneKey(zone)] ?? []).map(
    (id) => cardStats(ctx.cards, state.cards[id]!.code).name,
  );
}

/** Whether the card with `id` is face up. */
const revealed = (state: GameState, id: InstanceId) => state.cards[id]?.faceUp;

describe('Queen of Ash setup', () => {
  it('puts the three agendas and the two acts into their decks in stage order', () => {
    const state = startScenario(ctx);

    expect(namesIn(state, { kind: 'agendaDeck' })).toEqual([
      'A Gathering',
      'A Ritual',
      'Brethren of Ash',
    ]);
    expect(namesIn(state, { kind: 'actDeck' })).toEqual(['Search the Sewers', 'Stop the Rite']);
  });

  it('puts Underground Cistern, the five Sewer Tunnels and Sewer Culvert into play', () => {
    const state = startScenario(ctx);

    const inPlay = namesIn(state, { kind: 'location', mapId: SEWERS });
    expect(inPlay.filter((name) => name === 'Sewer Tunnels')).toHaveLength(5);
    expect(inPlay).toContain('Underground Cistern');
    expect(inPlay).toContain('Sewer Culvert');
    expect(inPlay).not.toContain('Sluice Control');
  });

  it('starts the investigators at Sewer Culvert, revealed, with the tunnels and the cistern unrevealed', () => {
    const state = startScenario(ctx, { playerCount: 2 });

    expect(state.investigators.map((inv) => inv.locationId)).toEqual([sewerCulvert, sewerCulvert]);
    expect(revealed(state, sewerCulvert)).toBe(true);
    expect(revealed(state, overgrownTunnels)).toBe(false);
    expect(revealed(state, undergroundCistern)).toBe(false);
  });

  it('connects Sewer Culvert to a Sewer Tunnels location after it is revealed, as its text says', () => {
    const toTunnels: Command = {
      type: 'MoveInvestigator',
      investigatorId: tank,
      to: overgrownTunnels,
    };
    const backToCulvert: Command = {
      type: 'MoveInvestigator',
      investigatorId: tank,
      to: sewerCulvert,
    };

    const state = stateAfter(ctx, startScenario(ctx), toTunnels, backToCulvert, toTunnels);

    expect(state.investigators[0]?.locationId).toBe(overgrownTunnels);
  });

  it.each([
    { playerCount: 1, doom: 1 },
    { playerCount: 3, doom: 2 },
  ])(
    "places Intro 3's doom on A Gathering, $doom doom for $playerCount investigators",
    ({ playerCount, doom }) => {
      const state = startScenario(ctx, { playerCount });

      expect(state.cards[aGathering]?.tokens.doom).toBe(doom);
    },
  );

  it('sets Sluice Control, the Fire! copies, both Collectors, Elokoss, her knight, her herald and the Servant of Flame aside', () => {
    const state = startScenario(ctx);

    expect(namesIn(state, { kind: 'setAside' }).sort()).toEqual([
      'Collector',
      'Collector',
      'Elokoss',
      'Fire!',
      'Fire!',
      'Fire!',
      'Fire!',
      'Fire!',
      'Herald of Flame',
      "Queen's Knight",
      'Servant of Flame',
      'Sluice Control',
    ]);
  });

  it('shuffles the other enemies and treacheries of the sets into the encounter deck', () => {
    const state = startScenario(ctx);

    const deck = namesIn(state, { kind: 'encounterDeck' });

    expect(deck).not.toContain('Fire!');
    expect(deck).not.toContain('Elokoss');
    expect(deck).not.toContain('Servant of Flame');
    expect(deck).toContain('Zealot');
    expect(deck).toContain('Cantor of Flame');
    expect(deck).toContain('Putrid Vapors');
  });

  it.each([
    { difficulty: 'easy', added: ['elderThing'] },
    { difficulty: 'standard', added: ['elderThing', 'tablet'] },
    { difficulty: 'hard', added: ['elderThing', 'tablet', 'skull'] },
    { difficulty: 'expert', added: ['elderThing', 'tablet', 'cultist', 'skull'] },
  ] as const)(
    "uses Spreading Flames' bag with 2 cultist tokens and the intro's $added on $difficulty",
    ({ difficulty, added }) => {
      const state = startScenario(ctx, { difficulty });

      expect(state.chaosBag).toEqual([
        ...spreadingFlames.chaosBag[difficulty],
        'cultist',
        'cultist',
        ...added,
      ]);
    },
  );

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

describe('Queen of Ash setup in the campaign', () => {
  const campaignCtx: ScenarioContext = {
    cards: cardDbWith(queenOfAshCards, zealotInvestigatorCards),
    scenario: queenOfAsh,
  };
  /** Roland alone before Queen of Ash, with `story` in the log. */
  const logWith = (story: CampaignLog['story']) =>
    makeCampaignLog({
      investigators: [rolandMember],
      story,
      scenarioIds: [queenOfAsh.id],
      position: 0,
    });
  /** The setup for Roland with the log's flag `key` set to `value`. */
  const setupWith = (key: string, value: boolean) =>
    scenario.compileSetup(campaignCtx, {
      seed: 1,
      investigators: [{ id: investigatorId('roland'), code: rolandBanks.code }],
      campaign: logWith({ [key]: { kind: 'flag', value } }),
    });

  it.each([
    { discovered: true, doom: undefined },
    { discovered: false, doom: 1 },
  ])(
    "places Intro 3's doom on A Gathering: $doom, when the cult's whereabouts were discovered: $discovered",
    ({ discovered, doom }) => {
      const command = setupWith(ASH_STORY.discoveredTheCultsWhereabouts, discovered);

      expect(command.cards.find((card) => card.id === aGathering)?.tokens?.doom).toBe(doom);
    },
  );

  it.each([
    { scoured: true, clues: 1 },
    { scoured: false, clues: 0 },
  ])(
    'gives Roland $clues clue to begin with when they scoured Arkham for answers: $scoured',
    ({ scoured, clues }) => {
      const command = setupWith(ASH_STORY.scouredArkhamForAnswers, scoured);

      expect(command.investigators[0]?.clues).toBe(clues);
    },
  );

  it.each([
    { stirred: true, cultists: 1 },
    { stirred: false, cultists: 0 },
  ])(
    'spawns $cultists Cultist enemy at a Sewer Tunnels location when they stirred up trouble: $stirred',
    ({ stirred, cultists }) => {
      const command = setupWith(ASH_STORY.stirredUpTrouble, stirred);

      const at = command.cards.flatMap(({ zone }) =>
        zone.kind === 'atLocation' ? [command.cards.find(({ id }) => id === zone.locationId)] : [],
      );
      expect(at.map((location) => location && cardStats(ctx.cards, location.code).name)).toEqual(
        Array<string>(cultists).fill('Sewer Tunnels'),
      );
    },
  );

  it.each([
    { killed: true, servants: 0 },
    { killed: false, servants: 1 },
  ])(
    'puts $servants Servant of Flame into the game when they killed it: $killed',
    ({ killed, servants }) => {
      const command = setupWith(ASH_STORY.killedTheServantOfFlame, killed);

      expect(command.cards.filter((card) => card.code === codes.servantOfFlame)).toHaveLength(
        servants,
      );
    },
  );
});

describe('Queen of Ash reference card', () => {
  it('gives the cultist and elder thing modifiers per side and leaves the skull and tablet open', () => {
    const { easyStandard, hardExpert } = queenOfAsh.reference;

    expect([
      easyStandard.skull?.modifier,
      easyStandard.cultist?.modifier,
      easyStandard.tablet?.modifier,
      easyStandard.elderThing?.modifier,
    ]).toEqual([undefined, -2, undefined, -3]);
    expect([
      hardExpert.skull?.modifier,
      hardExpert.cultist?.modifier,
      hardExpert.tablet?.modifier,
      hardExpert.elderThing?.modifier,
    ]).toEqual([undefined, -3, undefined, -5]);
  });
});

describe('Queen of Ash skull and tablet tokens', () => {
  /** Tank's intellect test where she stands against difficulty 2, revealing `token`. */
  function tokenValue(state: GameState, token: 'skull' | 'tablet'): number {
    const test = {
      investigatorId: tank,
      skill: 'intellect',
      difficulty: 2,
      locationId: state.investigators[0]?.locationId,
    } as const;
    const suggestion = skillTestSuggestion(ctx, state, test, { tokens: [token] });
    return suggestion.trace.find((step) => step.source.kind === 'chaosToken')?.change ?? 0;
  }

  it.each([
    { difficulty: 'standard', fireInPlay: false, value: 0 },
    { difficulty: 'standard', fireInPlay: true, value: -1 },
    { difficulty: 'hard', fireInPlay: true, value: -2 },
  ] as const)(
    'makes the skull $value on $difficulty, a Fire! attached to Sewer Culvert: $fireInPlay',
    ({ difficulty, fireInPlay, value }) => {
      const started = startScenario(ctx, { difficulty });
      const state = fireInPlay
        ? stateAfter(ctx, started, {
            type: 'MoveCard',
            cardId: fire,
            to: { kind: 'attachedTo', hostId: sewerCulvert },
          })
        : started;

      expect(tokenValue(state, 'skull')).toBe(value);
    },
  );

  it.each([
    { difficulty: 'easy', at: 'Sewer Tunnels', location: overgrownTunnels, value: -2 },
    { difficulty: 'easy', at: 'Underground Cistern', location: undergroundCistern, value: -4 },
    { difficulty: 'expert', at: 'Sewer Tunnels', location: overgrownTunnels, value: -4 },
  ] as const)(
    'makes the tablet $value on $difficulty at $at',
    ({ difficulty, location, value }) => {
      const state = stateAfter(ctx, startScenario(ctx, { difficulty }), {
        type: 'MoveInvestigator',
        investigatorId: tank,
        to: location,
        ignoreConnections: true,
      });

      expect(tokenValue(state, 'tablet')).toBe(value);
    },
  );
});

describe('Queen of Ash agendas and acts', () => {
  const seeker = investigatorId('seeker');
  const aRitual = instanceId('12170#1');
  const brethrenOfAsh = instanceId('12171#1');
  const searchTheSewers = instanceId('12172#1');
  const stopTheRite = instanceId('12173#1');
  const elokoss = instanceId('12179#1');
  const servantOfFlame = instanceId('12180#1');
  const sluiceControl = instanceId('12175#1');
  const atCistern = { kind: 'atLocation', locationId: undergroundCistern } as const;
  const advanceAgenda: Command = { type: 'AdvanceAgenda' };
  const tankEntersCistern: Command = {
    type: 'MoveInvestigator',
    investigatorId: tank,
    to: undergroundCistern,
    ignoreConnections: true,
  };
  /** The tank and the seeker after A Gathering advanced and both passed its willpower test. */
  const afterAGathering = () =>
    stateAfter(
      ctx,
      startScenario(ctx, { playerCount: 2 }),
      advanceAgenda,
      answer('test:12169#1', 'pass'),
      answer('test:12169#1', 'pass'),
    );

  it('spawns the set-aside Servant of Flame at Underground Cistern as A Gathering advances', () => {
    const state = afterAGathering();

    expect(state.cards[servantOfFlame]?.zone).toEqual(atCistern);
    expect(state.agenda.current).toBe(aRitual);
  });

  it('tests the willpower (4) of each investigator as A Gathering advances, 1 horror on a fail', () => {
    const tested = stateAfter(ctx, startScenario(ctx, { playerCount: 2 }), advanceAgenda);

    const state = stateAfter(
      ctx,
      tested,
      answer('test:12169#1', 'fail'),
      answer('test:12169#1', 'pass'),
    );

    expect(tested.pending).toMatchObject([
      { decider: { investigatorId: tank }, skillTest: { skill: 'willpower', difficulty: 4 } },
    ]);
    expect(state.investigators.map((inv) => [inv.id, inv.sanity.horror])).toEqual([
      [tank, 1],
      [seeker, 0],
    ]);
  });

  it('reveals Underground Cistern with Elokoss there and makes Brethren of Ash act and agenda as A Ritual advances during act 1', () => {
    const state = stateAfter(ctx, afterAGathering(), advanceAgenda);

    expect(revealed(state, undergroundCistern)).toBe(true);
    expect(state.cards[elokoss]?.zone).toEqual(atCistern);
    expect([state.agenda.current, state.act.current]).toEqual([brethrenOfAsh, brethrenOfAsh]);
    expect(state.cards[searchTheSewers]?.zone).toEqual({ kind: 'outOfGame' });
    expect(state.cards[stopTheRite]?.zone).toEqual({ kind: 'outOfGame' });
  });

  it('makes Brethren of Ash act and agenda without a second Elokoss as A Ritual advances during act 2', () => {
    const state = stateAfter(ctx, afterAGathering(), tankEntersCistern, advanceAgenda);

    expect(Object.values(state.cards).filter((card) => card.code === codes.elokoss)).toHaveLength(
      1,
    );
    expect([state.agenda.current, state.act.current]).toEqual([brethrenOfAsh, brethrenOfAsh]);
  });

  it.each([
    { act: 'Brethren of Ash', before: [advanceAgenda] },
    { act: 'Stop the Rite', before: [tankEntersCistern] },
  ])('ends in Resolution 1 when Elokoss is defeated during $act', ({ before }) => {
    const state = stateAfter(ctx, afterAGathering(), ...before, {
      type: 'DefeatEnemy',
      enemyId: elokoss,
    });

    expect(state.meta.resolution).toBe(QUEEN_OF_ASH_RESOLUTIONS.elokossDefeated);
  });

  it('advances Search the Sewers when the tank enters Underground Cistern: Elokoss, a Fire! there, Sluice Control into play and the rest shuffled in', () => {
    const state = stateAfter(ctx, startScenario(ctx), tankEntersCistern);

    expect(state.act.current).toBe(stopTheRite);
    expect(state.cards[elokoss]?.zone).toEqual(atCistern);
    expect(state.cards[fire]?.zone).toEqual({ kind: 'attachedTo', hostId: undergroundCistern });
    expect(state.cards[sluiceControl]?.zone).toEqual({ kind: 'location', mapId: SEWERS });
    expect(namesIn(state, { kind: 'setAside' }).sort()).toEqual([
      'Collector',
      'Collector',
      'Servant of Flame',
    ]);
    expect(namesIn(state, { kind: 'encounterDeck' })).toEqual(
      expect.arrayContaining(['Fire!', "Queen's Knight", 'Herald of Flame']),
    );
  });

  it.each([
    {
      skill: 'agility',
      result: 'pass',
      ends: 'Resolution 3',
      resolution: QUEEN_OF_ASH_RESOLUTIONS.ritualFlooded,
    },
    {
      skill: 'combat',
      result: 'pass',
      ends: 'Resolution 3',
      resolution: QUEEN_OF_ASH_RESOLUTIONS.ritualFlooded,
    },
    { skill: 'agility', result: 'fail', ends: 'nothing', resolution: undefined },
  ] as const)(
    'ends $ends when the tank resolves a Sluice Control $skill test (5): $result',
    ({ skill, result, resolution }) => {
      const atSluice = stateAfter(ctx, startScenario(ctx), tankEntersCistern, {
        type: 'MoveInvestigator',
        investigatorId: tank,
        to: sluiceControl,
        ignoreConnections: true,
      });
      const chosen = stateAfter(
        ctx,
        atSluice,
        { type: 'NextPhase' },
        { type: 'StartTurn', investigatorId: tank },
        { type: 'UseCardAction', investigatorId: tank, cardId: sluiceControl, action: 0 },
        answer(SLUICE_CONTROL_DECISION, skill),
      );

      const state = stateAfter(ctx, chosen, answer('test:12175#1', result));

      expect(chosen.pending).toMatchObject([{ skillTest: { skill, difficulty: 5 } }]);
      expect(state.meta.resolution).toBe(resolution);
    },
  );
});

describe('Stop the Rite', () => {
  const nextPhase: Command = { type: 'NextPhase' };
  const alice = investigatorId('alice');
  const zealot = instanceId('zealot');
  const cistern = instanceId('underground_cistern');
  const tunnels = instanceId('overgrown_tunnels');
  const culvert = instanceId('sewer_culvert');

  it('moves each Cultist enemy one location toward Underground Cistern as the round ends', () => {
    const { context, state: started } = newGame()
      .withAct(instanceId('stop_the_rite'), cardStats(ctx.cards, codes.stopTheRite))
      .withLocation(cistern, cardStats(ctx.cards, codes.undergroundCistern), { revealed: true })
      .withLocation(tunnels, cardStats(ctx.cards, codes.overgrownTunnels), { revealed: true })
      .withLocation(culvert, cardStats(ctx.cards, codes.sewerCulvert), { revealed: true })
      .withConnection(cistern, tunnels)
      .withConnection(tunnels, culvert)
      .withInvestigator(alice, { locationId: culvert })
      .withCard(zealot, cardStats(ctx.cards, codes.zealot), atLocation(culvert))
      .withTurnOf(alice)
      .start();
    let state = stateAfter(context, started, { type: 'EndTurn', investigatorId: alice });
    const roundBefore = state.meta.round;
    while (state.meta.round === roundBefore) state = stateAfter(context, state, nextPhase);

    expect(state.cards[zealot]?.zone).toEqual(atLocation(tunnels));
  });
});
