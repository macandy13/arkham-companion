import { describe, expect, it } from 'vitest';
import {
  blankAgenda,
  blankEnemy,
  blankLocation,
  blankTreachery,
  cardCode,
  checkInvariants,
  fixed,
  handle,
  instanceId,
  investigatorId,
  mapId,
  mapLocations,
  newGame,
  emptyState,
  zoneKey,
  type Command,
  type StartScenario,
  type Zone,
} from './index';
import { rejectionFrom, rejectionOf, run } from '../test/utils';

const main = mapId('main');
const setAside: Zone = { kind: 'setAside' };
const encounterDeck: Zone = { kind: 'encounterDeck' };
const alice = investigatorId('alice');
const study = instanceId('study');
const ghoul = instanceId('ghoul');
const rat = instanceId('rat');
const dread = instanceId('dread');
const omen = instanceId('omen');
const studyCard = blankLocation('study');
const dreadCard = blankTreachery('dread');
const omenCard = blankTreachery('omen');

/**
 * Alice and the revealed study; the encounter deck holds ghoul, rat, dread
 * and omen in that order, top first, and the agenda deck one agenda.
 */
const table = newGame()
  .withSeed(1234)
  .withLocation(study, studyCard, { revealed: true })
  .withInvestigator(alice)
  .withCard(ghoul, blankEnemy('ghoul'), encounterDeck)
  .withCard(rat, blankEnemy('rat'), encounterDeck)
  .withCard(dread, dreadCard, encounterDeck)
  .withCard(omen, omenCard, encounterDeck)
  .withAgenda(instanceId('plan'), blankAgenda('plan', fixed(3)));
const context = table.context();
const start = table.startCommand();

describe('StartScenario', () => {
  it('creates card instances and shuffles the encounter deck reproducibly', () => {
    const shuffled = table.withShuffledEncounterDeck();
    const { state, events } = run(context, [shuffled.startCommand()]);
    expect(events.map((e) => e.type)).toEqual(['ScenarioStarted', 'DeckShuffled']);
    expect(Object.keys(state.cards)).toHaveLength(6);
    expect(state.cards[study]?.faceUp).toBe(true);
    expect(state.meta.playerCount).toBe(1);
    expect(state.meta.leadInvestigator).toBe(alice);
    const deck = state.order[zoneKey(encounterDeck)];
    expect(deck?.slice().sort()).toEqual([dread, ghoul, omen, rat]);
    expect(shuffled.start().state).toEqual(state);
    expect(checkInvariants(state)).toEqual([]);
  });

  it('can skip the shuffle', () => {
    const { state, events } = run(context, [{ ...start, shuffleEncounterDeck: false }]);
    expect(events).toHaveLength(1);
    expect(state.order[zoneKey(encounterDeck)]).toEqual([ghoul, rat, dread, omen]);
  });

  it('rejects unknown references and duplicate ids', () => {
    const twice = instanceId('twice');
    expect(
      rejectionOf(() =>
        newGame()
          .withCard(dread, dreadCard, { kind: 'atLocation', locationId: instanceId('nope') })
          .start(),
      ),
    ).toMatchObject({ code: 'unknownCard', cardId: 'nope' });
    expect(
      rejectionOf(() =>
        newGame()
          .withCard(dread, dreadCard, { kind: 'location', mapId: mapId('nope') })
          .start(),
      ),
    ).toMatchObject({ code: 'unknownMap', mapId: 'nope' });
    expect(
      rejectionOf(() =>
        newGame().withCard(twice, dreadCard, setAside).withCard(twice, omenCard, setAside).start(),
      ),
    ).toMatchObject({ code: 'duplicateCard', cardId: 'twice' });
  });

  it('rejects card codes the card db does not know', () => {
    const command: StartScenario = {
      ...start,
      cards: [{ code: cardCode('missing'), zone: setAside }],
    };

    const rejection = rejectionOf(() => handle(context, emptyState(), command));

    expect(rejection).toEqual({ code: 'unknownCardCode', cardCode: 'missing' });
  });

  it('starts cards with their given tokens', () => {
    const { state } = newGame().withLocation(study, studyCard, { clues: 2 }).start();

    expect(state.cards[study]?.tokens).toEqual({ clue: 2 });
  });

  it('rejects negative or fractional starting tokens', () => {
    const game = newGame().withCard(study, studyCard, setAside, { tokens: { doom: -1 } });

    const rejection = rejectionOf(() => game.start());

    expect(rejection).toEqual({
      code: 'invalidStartingTokens',
      cardId: 'study',
      token: 'doom',
      amount: -1,
    });
  });

  it('puts each map with its connections on the board and investigators at their location', () => {
    const other = instanceId('other');
    const game = newGame()
      .withMap(main, { name: 'Main' })
      .withLocation(study, studyCard)
      .withLocation(other, blankLocation('other'))
      .withConnection(study, other, { oneWay: true })
      .withInvestigator(alice, { locationId: study });

    const { state } = game.start();

    expect(state.board.maps[main]).toEqual({
      name: 'Main',
      visible: true,
      connections: [{ from: study, to: other, oneWay: true }],
    });
    expect(mapLocations(state, main)).toEqual([study, other]);
    expect(state.investigators[0]?.locationId).toBe(study);
  });

  it('lists no locations for an unknown map', () => {
    const { state } = table.start();

    expect(mapLocations(state, mapId('elsewhere'))).toEqual([]);
  });

  it('rejects a connection to a card that is not a location', () => {
    const aside = instanceId('aside');
    const game = newGame()
      .withLocation(study, studyCard)
      .withCard(aside, dreadCard, setAside)
      .withConnection(study, aside);

    const rejection = rejectionOf(() => game.start());

    expect(rejection).toEqual({ code: 'notALocation', cardId: 'aside' });
  });

  it('accepts a connection to a location on another map and stores it on the declaring map', () => {
    const dream = mapId('dream');
    const far = instanceId('far');
    const game = newGame()
      .withLocation(study, studyCard)
      .withLocation(far, blankLocation('far'), { map: dream })
      .withConnection(study, far);

    const { state } = game.start();

    expect(state.board.maps[main]?.connections).toEqual([{ from: study, to: far, oneWay: false }]);
    expect(state.board.maps[dream]?.connections).toEqual([]);
  });

  it('rejects an investigator placed at an unknown card', () => {
    const game = newGame()
      .withLocation(study, studyCard)
      .withInvestigator(alice, { locationId: instanceId('nowhere') });

    const rejection = rejectionOf(() => game.start());

    expect(rejection).toEqual({ code: 'unknownCard', cardId: 'nowhere' });
  });
});

describe('ManualAdjust', () => {
  it('moves a card between zones and to a given index', () => {
    const { state } = run(context, [
      start,
      {
        type: 'ManualAdjust',
        adjustment: {
          kind: 'moveCard',
          cardId: ghoul,
          to: { kind: 'atLocation', locationId: study },
        },
      },
      {
        type: 'ManualAdjust',
        adjustment: {
          kind: 'moveCard',
          cardId: omen,
          to: encounterDeck,
          index: 0,
        },
      },
    ]);
    expect(state.cards[ghoul]?.zone).toEqual({ kind: 'atLocation', locationId: study });
    expect(state.order[zoneKey(encounterDeck)]).toEqual([omen, rat, dread]);
    expect(checkInvariants(state)).toEqual([]);
  });

  it('removes empty zones from the order map', () => {
    const { state } = run(context, [
      start,
      {
        type: 'ManualAdjust',
        adjustment: { kind: 'moveCard', cardId: study, to: { kind: 'outOfGame' } },
      },
    ]);
    expect(state.order[zoneKey({ kind: 'location', mapId: main })]).toBeUndefined();
  });

  it('rejects placing a card on itself or creating a hosting cycle', () => {
    const { state } = run(context, [
      start,
      {
        type: 'ManualAdjust',
        adjustment: {
          kind: 'moveCard',
          cardId: ghoul,
          to: { kind: 'attachedTo', hostId: study },
        },
      },
    ]);
    expect(
      rejectionOf(() =>
        handle(context, state, {
          type: 'ManualAdjust',
          adjustment: {
            kind: 'moveCard',
            cardId: study,
            to: { kind: 'attachedTo', hostId: study },
          },
        }),
      ),
    ).toMatchObject({ code: 'hostingCycle', cardId: 'study', hostId: 'study' });
    expect(
      rejectionOf(() =>
        handle(context, state, {
          type: 'ManualAdjust',
          adjustment: {
            kind: 'moveCard',
            cardId: study,
            to: { kind: 'attachedTo', hostId: ghoul },
          },
        }),
      ),
    ).toMatchObject({ code: 'hostingCycle', cardId: 'study', hostId: 'ghoul' });
  });

  it('rejects out-of-range indices', () => {
    const { state } = table.start();
    expect(
      rejectionOf(() =>
        handle(context, state, {
          type: 'ManualAdjust',
          adjustment: {
            kind: 'moveCard',
            cardId: ghoul,
            to: encounterDeck,
            index: 4,
          },
        }),
      ),
    ).toMatchObject({ code: 'indexOutOfRange', index: 4, max: 3 });
  });

  it('changes tokens and never lets them go negative', () => {
    const add: Command = {
      type: 'ManualAdjust',
      adjustment: { kind: 'tokens', cardId: study, token: 'clue', delta: 2 },
    };
    const { state } = run(context, [start, add]);
    expect(state.cards[study]?.tokens.clue).toBe(2);
    expect(
      rejectionOf(() =>
        handle(context, state, {
          type: 'ManualAdjust',
          adjustment: { kind: 'tokens', cardId: study, token: 'clue', delta: -3 },
        }),
      ),
    ).toMatchObject({ code: 'negativeTokens', current: 2, delta: -3 });
    const back = run(context, [
      start,
      add,
      {
        type: 'ManualAdjust',
        adjustment: { kind: 'tokens', cardId: study, token: 'clue', delta: -2 },
      },
    ]).state;
    expect(back.cards[study]?.tokens).toEqual({});
  });

  it.each([0, 1.5])('rejects a token delta of %s', (delta) => {
    expect(
      rejectionOf(() =>
        handle(context, table.start().state, {
          type: 'ManualAdjust',
          adjustment: { kind: 'tokens', cardId: study, token: 'clue', delta },
        }),
      ),
    ).toMatchObject({ code: 'invalidTokenDelta', delta });
  });

  it('rejects unknown cards', () => {
    expect(
      rejectionOf(() =>
        handle(context, table.start().state, {
          type: 'ManualAdjust',
          adjustment: { kind: 'tokens', cardId: instanceId('nope'), token: 'doom', delta: 1 },
        }),
      ),
    ).toMatchObject({ code: 'unknownCard', cardId: 'nope' });
  });
});

describe('MoveCard', () => {
  it('moves a card to the end of the destination zone', () => {
    const { state, events } = run(context, [
      start,
      { type: 'MoveCard', cardId: rat, to: { kind: 'encounterDiscard' } },
    ]);

    expect(events.at(-1)).toEqual({
      type: 'CardMoved',
      cardId: rat,
      from: encounterDeck,
      to: { kind: 'encounterDiscard' },
    });
    expect(state.order[zoneKey({ kind: 'encounterDiscard' })]).toEqual([rat]);
    expect(checkInvariants(state)).toEqual([]);
  });

  it('rejects a destination on an unknown map, like a manual move', () => {
    const { state } = table.start();
    const elsewhere = mapId('elsewhere');

    const rejection = rejectionFrom(context, state, {
      type: 'MoveCard',
      cardId: study,
      to: { kind: 'location', mapId: elsewhere },
    });

    expect(rejection).toEqual({ code: 'unknownMap', mapId: elsewhere });
  });

  it('rejects an unknown card', () => {
    const { state } = table.start();
    const missing = instanceId('missing');

    const rejection = rejectionFrom(context, state, {
      type: 'MoveCard',
      cardId: missing,
      to: { kind: 'outOfGame' },
    });

    expect(rejection).toEqual({ code: 'unknownCard', cardId: missing });
  });
});
