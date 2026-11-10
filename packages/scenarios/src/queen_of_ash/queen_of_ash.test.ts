import { describe, expect, it } from 'vitest';
import {
  cardDbWith,
  cardStats,
  checkInvariants,
  instanceId,
  investigatorId,
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
  makeCampaignLog,
  rolandMember,
  standardInvestigatorCards,
  startScenario,
  stateAfter,
} from '@arkham/engine/test/utils';
import {
  ASH_STORY,
  QUEEN_OF_ASH_CODES as codes,
  SEWERS,
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
