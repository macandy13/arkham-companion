import { describe, expect, it } from 'vitest';
import {
  cardDbWith,
  cardStats,
  instanceId,
  investigatorId,
  mapId,
  scenario,
  skillTestSuggestion,
  type CampaignLog,
  type Command,
  type Difficulty,
  type GameState,
  type ScenarioContext,
} from '@arkham/engine';
import {
  codesIn,
  makeCampaignLog,
  rolandMember,
  standardInvestigatorCards,
  startScenario,
  stateAfter,
} from '@arkham/engine/test/utils';
import { theGatheringCards, theMidnightMasks, theMidnightMasksCardDefs } from '../index';
import { rolandBanks, zealotInvestigatorCards } from '../investigators';

const ctx: ScenarioContext = {
  cards: cardDbWith(
    cardDbWith(theGatheringCards, theMidnightMasksCardDefs),
    standardInvestigatorCards,
  ),
  scenario: theMidnightMasks,
};
const arkham = mapId('arkham');

/** Names of the cards in `cardIds`, in order. */
function namesOf(state: GameState, cardIds: readonly string[]): string[] {
  return cardIds.map((id) => cardStats(ctx.cards, state.cards[instanceId(id)]!.code).name);
}

describe('The Midnight Masks setup', () => {
  it('puts the two agendas and the act into their decks', () => {
    const state = startScenario(ctx);

    expect(codesIn(state, { kind: 'agendaDeck' })).toEqual(['01121a', '01122']);
    expect(codesIn(state, { kind: 'actDeck' })).toEqual(['01123']);
  });

  it.each([1, 2, 3, 4, 5, 6])(
    'puts one Downtown, one Southside and the six other locations into play with seed %i',
    (seed) => {
      const state = startScenario(ctx, { seed });

      const locations = codesIn(state, { kind: 'location', mapId: arkham });

      expect(
        namesOf(
          state,
          locations.map((code) => `${code}#1`),
        ).sort(),
      ).toEqual([
        'Downtown',
        'Easttown',
        'Graveyard',
        'Miskatonic University',
        'Northside',
        'Rivertown',
        'Southside',
        "St. Mary's Hospital",
      ]);
    },
  );

  it('starts the investigators in the revealed Rivertown in a standalone game, Your House burned', () => {
    const state = startScenario(ctx, { playerCount: 2 });

    expect(state.investigators.map((inv) => inv.locationId)).toEqual(['01125#1', '01125#1']);
    expect(state.cards[instanceId('01125#1')]).toMatchObject({ faceUp: true, tokens: { clue: 2 } });
  });

  it('sets aside the five cultists of the Cultist deck and The Masked Hunter', () => {
    const state = startScenario(ctx);

    expect(codesIn(state, { kind: 'setAside' })).toEqual([
      '01137',
      '01138',
      '01139',
      '01140',
      '01141',
      '01121b',
    ]);
  });

  it.each([
    { players: 1, acolytes: [] },
    { players: 2, acolytes: ['Southside'] },
    { players: 3, acolytes: ['Southside', 'Downtown'] },
    { players: 4, acolytes: ['Southside', 'Downtown', 'Graveyard'] },
  ])('spawns Acolytes at $acolytes with $players investigator(s)', ({ players, acolytes }) => {
    const state = startScenario(ctx, { playerCount: players });

    const spawnedAt = Object.values(state.cards).flatMap((card) =>
      card.code === '01169' && card.zone.kind === 'atLocation' ? [card.zone.locationId] : [],
    );

    expect(namesOf(state, spawnedAt)).toEqual(acolytes);
  });

  it('shuffles the rest of the five gathered sets into the encounter deck, without the Ghoul Priest', () => {
    const state = startScenario(ctx, { playerCount: 4 });

    const deck = codesIn(state, { kind: 'encounterDeck' }).sort();

    expect(deck).toEqual([
      ...['01135', '01135', '01135'],
      ...['01136', '01136'],
      ...['01167', '01167'],
      ...['01168', '01168'],
      '01170',
      ...['01171', '01171'],
      ...['01172', '01172'],
      ...['01173', '01173'],
      ...['01174', '01174'],
    ]);
  });
});

describe('The Midnight Masks setup in the campaign', () => {
  /** The scenario with The Gathering's investigators, whom the campaign seats. */
  const zealotCtx = { ...ctx, cards: cardDbWith(ctx.cards, zealotInvestigatorCards) };
  const rolandSeat = { id: investigatorId('roland'), code: rolandBanks.code };
  /** Roland alone before The Midnight Masks, with `story` in the log. */
  const logWith = (story: CampaignLog['story']) =>
    makeCampaignLog({
      investigators: [rolandMember],
      story,
      scenarioIds: [theMidnightMasks.id],
      position: 0,
    });

  it('starts at Your House, next to Rivertown, while it still stands', () => {
    const command = scenario.compileSetup(zealotCtx, {
      seed: 1,
      investigators: [rolandSeat],
      campaign: logWith({ houseStillStanding: { kind: 'flag', value: true } }),
    });

    expect(command.investigators[0]?.locationId).toBe('01124#1');
    expect(command.maps?.[arkham]?.connections).toContainEqual({
      from: instanceId('01125#1'),
      to: instanceId('01124#1'),
      oneWay: false,
    });
  });

  it.each([
    { alive: true, priests: 1 },
    { alive: false, priests: 0 },
  ])('shuffles $priests Ghoul Priest in when alive is $alive', ({ alive, priests }) => {
    const command = scenario.compileSetup(zealotCtx, {
      seed: 1,
      investigators: [rolandSeat],
      campaign: logWith({ ghoulPriestStillAlive: { kind: 'flag', value: alive } }),
    });

    expect(
      command.cards.filter((card) => card.zone.kind === 'encounterDeck' && card.code === '01116'),
    ).toHaveLength(priests);
  });
});

describe('The Midnight Masks skull token', () => {
  const acolyteAtSouthside = instanceId('01169#1');
  const acolyteAtDowntown = instanceId('01169#2');
  const agenda = instanceId('01121a#1');
  const doom = (cardId: typeof agenda, delta: number): Command => ({
    type: 'ManualAdjust',
    adjustment: { kind: 'tokens', cardId, token: 'doom', delta },
  });

  /** The skull's change to a willpower test in Rivertown, at three investigators and `difficulty`. */
  function skullWith(difficulty: Difficulty, ...adjustments: Command[]): number {
    const state = stateAfter(
      ctx,
      startScenario(ctx, { playerCount: 3, difficulty }),
      ...adjustments,
    );
    const test = {
      investigatorId: state.investigators[0]!.id,
      skill: 'willpower',
      difficulty: 3,
      locationId: instanceId('01125#1'),
    } as const;
    const suggestion = skillTestSuggestion(ctx, state, test, { tokens: ['skull'] });
    return suggestion.trace.find((step) => step.source.kind === 'chaosToken')?.change ?? 0;
  }

  it.each([
    { difficulty: 'standard', skull: -2, counts: 'the most doom on one Cultist' },
    { difficulty: 'hard', skull: -4, counts: 'all doom in play, agenda included' },
  ] as const)('is $skull on $difficulty: $counts', ({ difficulty, skull }) => {
    expect(
      skullWith(
        difficulty,
        doom(acolyteAtSouthside, 2),
        doom(acolyteAtDowntown, 1),
        doom(agenda, 1),
      ),
    ).toBe(skull);
  });

  it('is 0 on Standard with no doom on a Cultist', () => {
    expect(skullWith('standard', doom(agenda, 1))).toBe(0);
  });
});
