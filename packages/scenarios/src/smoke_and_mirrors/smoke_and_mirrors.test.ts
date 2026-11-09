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
  ARKHAM,
  ASH_STORY,
  SMOKE_AND_MIRRORS_CODES as codes,
  smokeAndMirrors,
  smokeAndMirrorsCards,
  spreadingFlames,
} from '../index';
import { rolandBanks, zealotInvestigatorCards } from '../investigators';

const ctx: ScenarioContext = {
  cards: cardDbWith(smokeAndMirrorsCards, standardInvestigatorCards),
  scenario: smokeAndMirrors,
};

const tank = investigatorId('tank');
const arkhamAlive = instanceId('12134#1');
const augursOfFlame = instanceId('12136#1');
const northside = instanceId('12149#1');
const miskatonicUniversityInFlames = instanceId('12155#1');
const miskatonicUniversityQuietCampus = instanceId('12156#1');

/** Card names in `zone`, top first. */
function namesIn(state: GameState, zone: Zone): string[] {
  return (state.order[zoneKey(zone)] ?? []).map(
    (id) => cardStats(ctx.cards, state.cards[id]!.code).name,
  );
}

/** The cards beneath `location`, top first. */
function idsBeneath(state: GameState, location: InstanceId): InstanceId[] {
  return state.order[zoneKey({ kind: 'beneath', hostId: location })] ?? [];
}

/** `amount` clues for the investigator, as discovering them would give. */
function cluesFor(amount: number): Command {
  return { type: 'AdjustInvestigator', investigatorId: tank, stat: 'clues', delta: amount };
}

describe('Smoke and Mirrors setup', () => {
  it('puts the two agendas and the act into their decks in stage order', () => {
    const state = startScenario(ctx);

    expect(namesIn(state, { kind: 'agendaDeck' })).toEqual(['Arkham Alive', 'Emergent Evils']);
    expect(namesIn(state, { kind: 'actDeck' })).toEqual(['Augurs of Flame']);
  });

  it('puts nine Arkham locations into play, one of the two Downtowns and one of the two Uptowns', () => {
    const state = startScenario(ctx);

    const inPlay = namesIn(state, { kind: 'location', mapId: ARKHAM });
    expect(inPlay).toHaveLength(9);
    expect(inPlay.filter((name) => name === 'Downtown')).toHaveLength(1);
    expect(inPlay.filter((name) => name === 'Uptown')).toHaveLength(1);
  });

  it('starts the investigators at Miskatonic University (In Flames) in a standalone game', () => {
    const state = startScenario(ctx, { playerCount: 2 });

    expect(state.investigators.map((inv) => inv.locationId)).toEqual([
      miskatonicUniversityInFlames,
      miskatonicUniversityInFlames,
    ]);
    expect(state.cards[miskatonicUniversityInFlames]?.faceUp).toBe(true);
    expect(state.cards[miskatonicUniversityQuietCampus]).toBeUndefined();
  });

  it('deals the Servant of Flame and five suspects face down beneath six locations, one each', () => {
    const state = startScenario(ctx);

    const dealt = Object.values(state.cards).filter((card) => card.zone.kind === 'beneath');
    const names = dealt.map((card) => cardStats(ctx.cards, card.code).name);
    expect(dealt.every((card) => !card.faceUp)).toBe(true);
    expect(names).toContain('Servant of Flame');
    expect(
      new Set(dealt.map((card) => card.zone.kind === 'beneath' && card.zone.hostId)).size,
    ).toBe(6);
    expect(idsBeneath(state, northside)).toHaveLength(1);
    expect(idsBeneath(state, miskatonicUniversityInFlames)).toEqual([]);
  });

  it('sets one suspect aside and every Mark of Elokoss', () => {
    const state = startScenario(ctx);

    const setAside = namesIn(state, { kind: 'setAside' });
    expect(setAside.filter((name) => name === 'Mark of Elokoss')).toHaveLength(4);
    expect(setAside).toHaveLength(5);
  });

  it.each([
    { playerCount: 1, doom: 1 },
    { playerCount: 3, doom: 3 },
  ])(
    'places $doom doom on Arkham Alive for $playerCount investigators',
    ({ playerCount, doom }) => {
      const state = startScenario(ctx, { playerCount });

      expect(state.cards[arkhamAlive]?.tokens.doom).toBe(doom);
    },
  );

  it('shuffles the other enemies and treacheries of the sets into the encounter deck', () => {
    const state = startScenario(ctx);

    const deck = namesIn(state, { kind: 'encounterDeck' });

    expect(deck).not.toContain('Mark of Elokoss');
    expect(deck).not.toContain('Servant of Flame');
    expect(deck).not.toContain('David Renfield');
    expect(deck).toContain('Arcane Lock');
    expect(deck).toContain('Crossfire');
  });

  it("uses Spreading Flames' chaos bag with 2 cultist tokens more", () => {
    const state = startScenario(ctx, { difficulty: 'hard' });

    expect(state.chaosBag).toEqual([...spreadingFlames.chaosBag.hard, 'cultist', 'cultist']);
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

describe('Smoke and Mirrors setup in the campaign', () => {
  const campaignCtx: ScenarioContext = {
    cards: cardDbWith(smokeAndMirrorsCards, zealotInvestigatorCards),
    scenario: smokeAndMirrors,
  };
  /** Roland alone before Smoke and Mirrors, with `story` in the log. */
  const logWith = (story: CampaignLog['story']) =>
    makeCampaignLog({
      investigators: [rolandMember],
      story,
      scenarioIds: [smokeAndMirrors.id],
      position: 0,
    });
  const rolandSeat = { id: investigatorId('roland'), code: rolandBanks.code };

  it.each([
    {
      story: 'saved',
      saved: true,
      university: 'Miskatonic University (Quiet Campus)',
      code: codes.miskatonicUniversityQuietCampus,
      doom: 2,
    },
    {
      story: 'burned',
      saved: false,
      university: 'Miskatonic University (In Flames)',
      code: codes.miskatonicUniversityInFlames,
      doom: 1,
    },
  ])(
    'starts at $university with $doom doom when the university $story',
    ({ saved, code, doom }) => {
      const command = scenario.compileSetup(campaignCtx, {
        seed: 1,
        investigators: [rolandSeat],
        campaign: logWith({
          [ASH_STORY.savedMiskatonicUniversity]: { kind: 'flag', value: saved },
        }),
      });

      const university = command.cards.find(
        (card) => card.id === command.investigators[0]?.locationId,
      );
      expect(university?.code).toBe(code);
      expect(command.cards.find((card) => card.id === arkhamAlive)?.tokens?.doom).toBe(doom);
    },
  );
});

describe('Smoke and Mirrors reference card', () => {
  it('gives the cultist and tablet modifiers per side and leaves the skull and elder thing open', () => {
    const { easyStandard, hardExpert } = smokeAndMirrors.reference;

    expect([
      easyStandard.skull?.modifier,
      easyStandard.cultist?.modifier,
      easyStandard.tablet?.modifier,
      easyStandard.elderThing?.modifier,
    ]).toEqual([undefined, -1, -3, undefined]);
    expect([
      hardExpert.skull?.modifier,
      hardExpert.cultist?.modifier,
      hardExpert.tablet?.modifier,
      hardExpert.elderThing?.modifier,
    ]).toEqual([undefined, -3, -4, undefined]);
  });
});

describe('Smoke and Mirrors skull and elder thing tokens', () => {
  /** Tank's intellect test at Miskatonic University against difficulty 2, revealing `token`. */
  function tokenValue(state: GameState, token: 'skull' | 'elderThing'): number {
    const test = {
      investigatorId: tank,
      skill: 'intellect',
      difficulty: 2,
      locationId: state.investigators[0]?.locationId,
    } as const;
    const suggestion = skillTestSuggestion(ctx, state, test, { tokens: [token] });
    return suggestion.trace.find((step) => step.source.kind === 'chaosToken')?.change ?? 0;
  }

  /** The card beneath Northside, put face up beneath the act, as a codex entry would. */
  function questionedSuspect(state: GameState): Command[] {
    const [suspect] = idsBeneath(state, northside);
    return [
      { type: 'MoveInvestigator', investigatorId: tank, to: northside, ignoreConnections: true },
      { type: 'DrawBeneath', investigatorId: tank },
      { type: 'MoveCard', cardId: suspect!, to: { kind: 'beneath', hostId: augursOfFlame } },
    ];
  }

  it.each([
    { difficulty: 'standard', questioned: false, value: 0 },
    { difficulty: 'standard', questioned: true, value: -1 },
    { difficulty: 'hard', questioned: false, value: -2 },
    { difficulty: 'expert', questioned: true, value: -3 },
  ] as const)(
    'makes the skull $value on $difficulty, one suspect beneath the act: $questioned',
    ({ difficulty, questioned, value }) => {
      const started = startScenario(ctx, { difficulty });
      const state = questioned ? stateAfter(ctx, started, ...questionedSuspect(started)) : started;

      expect(tokenValue(state, 'skull')).toBe(value);
    },
  );

  it.each([
    { difficulty: 'easy', clues: 3, value: -3 },
    { difficulty: 'hard', clues: 3, value: -6 },
    { difficulty: 'standard', clues: 1, value: -1 },
  ] as const)(
    'makes the elder thing $value on $difficulty with $clues clues',
    ({ difficulty, clues, value }) => {
      const state = stateAfter(ctx, startScenario(ctx, { difficulty }), cluesFor(clues));

      expect(tokenValue(state, 'elderThing')).toBe(value);
    },
  );
});

describe('Smoke and Mirrors act, Augurs of Flame', () => {
  it('spends 2 clues per investigator to draw the card beneath her location, face up', () => {
    const started = startScenario(ctx);
    const [hidden] = idsBeneath(started, northside);

    const state = stateAfter(
      ctx,
      started,
      { type: 'NextPhase' },
      { type: 'StartTurn', investigatorId: tank },
      { type: 'MoveInvestigator', investigatorId: tank, to: northside, ignoreConnections: true },
      cluesFor(2),
      { type: 'UseCardAction', investigatorId: tank, cardId: augursOfFlame, action: 0 },
    );

    expect(state.cards[hidden!]?.faceUp).toBe(true);
    expect(idsBeneath(state, northside)).toEqual([]);
    expect(state.investigators[0]?.clues).toBe(0);
  });

  it('ends the scenario in Resolution 1 once it advances', () => {
    const state = stateAfter(ctx, startScenario(ctx), { type: 'AdvanceAct' });

    expect(state.meta).toMatchObject({ ended: true, resolution: 'R1' });
  });
});

describe('Smoke and Mirrors agendas', () => {
  it('puts a Mark of Elokoss into each threat area as Arkham Alive advances', () => {
    const state = stateAfter(ctx, startScenario(ctx, { playerCount: 2 }), {
      type: 'AdvanceAgenda',
    });

    expect(namesIn(state, { kind: 'threatArea', investigatorId: tank })).toEqual([
      'Mark of Elokoss',
    ]);
    expect(
      namesIn(state, { kind: 'threatArea', investigatorId: investigatorId('seeker') }),
    ).toEqual(['Mark of Elokoss']);
  });

  it('resigns every investigator as Emergent Evils advances, ending without a resolution', () => {
    const state = stateAfter(
      ctx,
      startScenario(ctx, { playerCount: 2 }),
      { type: 'AdvanceAgenda' },
      { type: 'AdvanceAgenda' },
    );

    expect(state.investigators.map((inv) => inv.status)).toEqual(['resigned', 'resigned']);
    expect(state.meta.ended).toBe(true);
    expect(state.meta.resolution).toBeUndefined();
  });
});
