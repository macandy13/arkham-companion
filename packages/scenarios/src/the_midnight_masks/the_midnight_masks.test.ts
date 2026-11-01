import { describe, expect, it } from 'vitest';
import {
  campaign,
  cardDbWith,
  cardStats,
  emptyState,
  execute,
  investigatorCode,
  instanceId,
  zoneKey,
  investigatorId,
  mapId,
  scenario,
  skillTestSuggestion,
  type CampaignLog,
  type Command,
  type Difficulty,
  type GameState,
  type CardCode,
  type InstanceId,
  type ResolutionId,
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
  GATHERING_CODES,
  MIDNIGHT_MASKS_CODES as codes,
  MIDNIGHT_MASKS_RESOLUTIONS,
  ZEALOT_STORY,
  theMidnightMasksResolutions,
  theMidnightMasks,
  theMidnightMasksCards,
} from '../index';
import { rolandBanks, zealotInvestigatorCards } from '../investigators';

const ctx: ScenarioContext = {
  cards: cardDbWith(theMidnightMasksCards, standardInvestigatorCards),
  scenario: theMidnightMasks,
};
const arkham = mapId('arkham');
const rivertown = instanceId(`${codes.rivertown}#1`);
const yourHouse = instanceId(`${codes.yourHouse}#1`);

/** Names of the cards in `cardIds`, in order. */
function namesOf(state: GameState, cardIds: readonly InstanceId[]): string[] {
  return cardIds.map((id) => cardStats(ctx.cards, state.cards[id]!.code).name);
}

/** Names of the cards in `zone`, in zone order. */
function namesIn(state: GameState, zone: Zone): string[] {
  return namesOf(state, state.order[zoneKey(zone)] ?? []);
}

describe('The Midnight Masks setup', () => {
  it('puts the two agendas and the act into their decks', () => {
    const state = startScenario(ctx);

    expect(namesIn(state, { kind: 'agendaDeck' })).toEqual([
      'Predator or Prey?',
      'Time Is Running Short',
    ]);
    expect(namesIn(state, { kind: 'actDeck' })).toEqual(['Uncovering the Conspiracy']);
  });

  it.each([1, 2, 3, 4, 5, 6])(
    'puts one Downtown, one Southside and the six other locations into play with seed %i',
    (seed) => {
      const state = startScenario(ctx, { seed });

      expect(namesIn(state, { kind: 'location', mapId: arkham }).sort()).toEqual([
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

    expect(state.investigators.map((inv) => inv.locationId)).toEqual([rivertown, rivertown]);
    expect(state.cards[rivertown]).toMatchObject({ faceUp: true, tokens: { clue: 2 } });
  });

  it('shuffles the five cultists into the Cultist deck and sets aside The Masked Hunter', () => {
    const state = startScenario(ctx);

    expect(namesIn(state, { kind: 'scenarioDeck', deck: 'cultist' }).sort()).toEqual([
      '"Wolf-Man" Drew',
      'Herman Collins',
      'Peter Warren',
      'Ruth Turner',
      'Victoria Devereux',
    ]);
    expect(namesIn(state, { kind: 'setAside' })).toEqual(['The Masked Hunter']);
  });

  it.each([
    { players: 1, acolytes: [] },
    { players: 2, acolytes: ['Southside'] },
    { players: 3, acolytes: ['Southside', 'Downtown'] },
    { players: 4, acolytes: ['Southside', 'Downtown', 'Graveyard'] },
  ])(
    'spawns Acolytes with 1 doom at $acolytes with $players investigator(s)',
    ({ players, acolytes }) => {
      const state = startScenario(ctx, { playerCount: players });

      const spawned = Object.values(state.cards).filter(
        (card) => card.code === codes.acolyte && card.zone.kind === 'atLocation',
      );

      expect(
        namesOf(
          state,
          spawned.map((card) => (card.zone.kind === 'atLocation' ? card.zone.locationId : card.id)),
        ),
      ).toEqual(acolytes);
      expect(spawned.map((card) => card.tokens.doom)).toEqual(acolytes.map(() => 1));
    },
  );

  it('shuffles the rest of the five gathered sets into the encounter deck, without the Ghoul Priest', () => {
    const state = startScenario(ctx, { playerCount: 4 });

    const deck = namesIn(state, { kind: 'encounterDeck' }).sort();

    expect(deck).toEqual([
      ...['Crypt Chill', 'Crypt Chill'],
      ...['False Lead', 'False Lead'],
      ...['Hunting Nightgaunt', 'Hunting Nightgaunt'],
      ...['Hunting Shadow', 'Hunting Shadow', 'Hunting Shadow'],
      ...['Locked Door', 'Locked Door'],
      ...['Mysterious Chanting', 'Mysterious Chanting'],
      ...['Obscuring Fog', 'Obscuring Fog'],
      ...['On Wings of Darkness', 'On Wings of Darkness'],
      'Wizard of the Order',
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

    expect(command.investigators[0]?.locationId).toBe(yourHouse);
    expect(command.maps?.[arkham]?.connections).toContainEqual({
      from: rivertown,
      to: yourHouse,
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
      command.cards.filter(
        (card) => card.zone.kind === 'encounterDeck' && card.code === GATHERING_CODES.ghoulPriest,
      ),
    ).toHaveLength(priests);
  });
});

describe('The Midnight Masks skull token', () => {
  /** The Acolytes three investigators start with, each with the 1 doom it spawned with. */
  const acolyteAtSouthside = instanceId(`${codes.acolyte}#1`);
  const acolyteAtDowntown = instanceId(`${codes.acolyte}#2`);
  const agenda = instanceId(`${codes.predatorOrPrey}#1`);
  const doom = (cardId: InstanceId, delta: number): Command => ({
    type: 'ManualAdjust',
    adjustment: { kind: 'tokens', cardId, token: 'doom', delta },
  });

  /** The skull's change to a willpower test in Rivertown, at `playerCount` investigators and `difficulty`. */
  function skullWith(
    playerCount: number,
    difficulty: Difficulty,
    ...adjustments: Command[]
  ): number {
    const state = stateAfter(ctx, startScenario(ctx, { playerCount, difficulty }), ...adjustments);
    const test = {
      investigatorId: state.investigators[0]!.id,
      skill: 'willpower',
      difficulty: 3,
      locationId: rivertown,
    } as const;
    const suggestion = skillTestSuggestion(ctx, state, test, { tokens: ['skull'] });
    return suggestion.trace.find((step) => step.source.kind === 'chaosToken')?.change ?? 0;
  }

  it.each([
    { difficulty: 'standard', skull: -3, counts: 'the most doom on one Cultist, 1 + 2' },
    {
      difficulty: 'hard',
      skull: -6,
      counts: 'all doom in play, 3 + 2 on Acolytes and 1 on the agenda',
    },
  ] as const)('is $skull on $difficulty: $counts', ({ difficulty, skull }) => {
    expect(
      skullWith(
        3,
        difficulty,
        doom(acolyteAtSouthside, 2),
        doom(acolyteAtDowntown, 1),
        doom(agenda, 1),
      ),
    ).toBe(skull);
  });

  it('is 0 on Standard with one investigator, so no Acolyte, and doom only on the agenda', () => {
    expect(skullWith(1, 'standard', doom(agenda, 1))).toBe(0);
  });
});

describe('The Midnight Masks resolutions', () => {
  const tank = investigatorCode('tank');
  const toVictoryDisplay = (code: CardCode): Command => ({
    type: 'ManualAdjust',
    adjustment: {
      kind: 'moveCard',
      cardId: instanceId(`${code}#1`),
      to: { kind: 'victoryDisplay' },
    },
  });
  /** Drew and Herman (Victory 1 each) interrogated, the other three cultists still in the Cultist deck. */
  const twoInterrogated = (resolution: ResolutionId) =>
    stateAfter(
      ctx,
      startScenario(ctx),
      toVictoryDisplay(codes.wolfManDrew),
      toVictoryDisplay(codes.hermanCollins),
      { type: 'EndScenario', resolution },
    );
  const list = (...entries: string[]) => ({ kind: 'list', entries }) as const;

  it('records R1 at agenda 1: the interrogated cultists, the rest and The Masked Hunter got away', () => {
    const ended = twoInterrogated(MIDNIGHT_MASKS_RESOLUTIONS.conspiracyUncovered);

    expect(campaign.proposeResolution(ctx, ended, theMidnightMasksResolutions)).toEqual([
      {
        kind: 'command',
        command: {
          type: 'RecordStory',
          key: ZEALOT_STORY.cultistsWeInterrogated,
          value: list('"Wolf-Man" Drew', 'Herman Collins'),
        },
      },
      {
        kind: 'command',
        command: {
          type: 'RecordStory',
          key: ZEALOT_STORY.cultistsWhoGotAway,
          value: list('Peter Warren', 'Victoria Devereux', 'Ruth Turner', 'The Masked Hunter'),
        },
      },
      { kind: 'command', command: { type: 'AwardXp', code: tank, amount: 2 } },
      { kind: 'byHand', textKey: 'scenario.theMidnightMasks.resolution.upgradeDecks' },
    ]);
  });

  it('records R2 as past midnight, The Masked Hunter not got away while still set aside', () => {
    const ended = twoInterrogated(MIDNIGHT_MASKS_RESOLUTIONS.pastMidnight);

    expect(campaign.proposeResolution(ctx, ended, theMidnightMasksResolutions)).toEqual([
      {
        kind: 'command',
        command: {
          type: 'RecordStory',
          key: ZEALOT_STORY.cultistsWeInterrogated,
          value: list('"Wolf-Man" Drew', 'Herman Collins'),
        },
      },
      {
        kind: 'command',
        command: {
          type: 'RecordStory',
          key: ZEALOT_STORY.cultistsWhoGotAway,
          value: list('Peter Warren', 'Victoria Devereux', 'Ruth Turner'),
        },
      },
      {
        kind: 'command',
        command: {
          type: 'RecordStory',
          key: ZEALOT_STORY.itIsPastMidnight,
          value: { kind: 'flag', value: true },
        },
      },
      { kind: 'command', command: { type: 'AwardXp', code: tank, amount: 2 } },
      { kind: 'byHand', textKey: 'scenario.theMidnightMasks.resolution.upgradeDecks' },
    ]);
  });

  it.each([
    {
      place: 'in play',
      to: { kind: 'atLocation', locationId: rivertown },
      key: 'cultistsWhoGotAway',
    },
    {
      place: 'in the victory display',
      to: { kind: 'victoryDisplay' },
      key: 'cultistsWeInterrogated',
    },
  ] as const)('lists The Masked Hunter $place at R2 under $key', ({ to, key }) => {
    const ended = stateAfter(
      ctx,
      startScenario(ctx),
      {
        type: 'ManualAdjust',
        adjustment: { kind: 'moveCard', cardId: instanceId(`${codes.theMaskedHunter}#1`), to },
      },
      { type: 'EndScenario', resolution: MIDNIGHT_MASKS_RESOLUTIONS.pastMidnight },
    );

    const recorded = campaign
      .proposeResolution(ctx, ended, theMidnightMasksResolutions)
      ?.flatMap((change) =>
        change.kind === 'command' && change.command.type === 'RecordStory' ? [change.command] : [],
      )
      .find((command) => command.key === ZEALOT_STORY[key]);

    expect(recorded?.value).toMatchObject({
      entries: expect.arrayContaining(['The Masked Hunter']),
    });
  });

  it('reads no resolution as R1', () => {
    expect(theMidnightMasksResolutions.none).toBe(
      theMidnightMasksResolutions.byId[MIDNIGHT_MASKS_RESOLUTIONS.conspiracyUncovered],
    );
  });

  it('crosses out "the Ghoul Priest is still alive" once he is in the victory display', () => {
    const zealotCtx = { ...ctx, cards: cardDbWith(ctx.cards, zealotInvestigatorCards) };
    const started = execute(
      zealotCtx,
      emptyState(),
      scenario.compileSetup(zealotCtx, {
        seed: 1,
        investigators: [{ id: investigatorId('roland'), code: rolandBanks.code }],
        campaign: makeCampaignLog({
          investigators: [rolandMember],
          story: { ghoulPriestStillAlive: { kind: 'flag', value: true } },
          scenarioIds: [theMidnightMasks.id],
          position: 0,
        }),
      }),
    ).state;
    const ended = stateAfter(zealotCtx, started, toVictoryDisplay(GATHERING_CODES.ghoulPriest), {
      type: 'EndScenario',
      resolution: MIDNIGHT_MASKS_RESOLUTIONS.conspiracyUncovered,
    });

    const proposal = campaign.proposeResolution(zealotCtx, ended, theMidnightMasksResolutions);

    // The Ghoul Priest's Victory 2 is the only experience.
    expect(proposal).toContainEqual({
      kind: 'command',
      command: {
        type: 'RecordStory',
        key: ZEALOT_STORY.ghoulPriestStillAlive,
        value: { kind: 'flag', value: false },
      },
    });
    expect(proposal).toContainEqual({
      kind: 'command',
      command: { type: 'AwardXp', code: rolandBanks.code, amount: 2 },
    });
  });
});
