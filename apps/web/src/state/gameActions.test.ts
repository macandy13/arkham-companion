import { describe, expect, it } from 'vitest';
import {
  blankEnemy,
  blankLocation,
  blankTreachery,
  cardName,
  engagedWith,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  type CardPlaceView,
} from '@arkham/engine';
import type { CardMove } from '../encounter/cardMoves';
import { gameActions, type ActionCost, type GameActions } from './gameActions';

const study = instanceId('study');
const hall = instanceId('hall');
const ghoul = instanceId('ghoul');
const lurker = instanceId('lurker');
const alder = investigatorId('alder');
const brook = investigatorId('brook');

/** Actions that play on `table`, as the store's play on the open game; undo and adjusting do nothing. */
const actionsOn = (table: PlayTable) =>
  gameActions(
    async (step) => step(table),
    async () => {},
    {
      start: async () => {},
      finish: async () => {},
      cancel: async () => {},
    },
  );

describe('gameActions', () => {
  /**
   * Alder's turn in the Study, next to the Hall, with a ghoul (3 health) engaged with Alder and a lurker
   * engaged with Brook there, for Alder to engage.
   */
  const aldersTurn = () =>
    PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withConnection(study, hall)
        .withInvestigator(alder, { locationId: study })
        .withCard(ghoul, blankEnemy('ghoul', { health: fixed(3) }), engagedWith(alder))
        .withInvestigator(brook, { locationId: study })
        .withCard(lurker, blankEnemy('lurker'), engagedWith(brook))
        .withTurnOf(alder),
    );

  it.each<{ verb: string; act: (actions: GameActions) => Promise<void>; left: number }>([
    { verb: 'investigate', act: (actions) => actions.investigate(), left: 2 },
    { verb: 'fight', act: (actions) => actions.fight(ghoul), left: 2 },
    { verb: 'evade', act: (actions) => actions.evade(ghoul), left: 2 },
    { verb: 'engage', act: (actions) => actions.engage(lurker), left: 2 },
    { verb: 'a free fight', act: (actions) => actions.fight(ghoul, 'free'), left: 3 },
    { verb: 'a free evade', act: (actions) => actions.evade(ghoul, 'free'), left: 3 },
    { verb: 'a move', act: (actions) => actions.moveTo(hall, 'action'), left: 2 },
    { verb: 'a free move (the pawn drag)', act: (actions) => actions.moveTo(hall), left: 3 },
  ])('$verb leaves alder $left of three actions', async ({ act, left }) => {
    const table = aldersTurn();

    await act(actionsOn(table));

    expect(table.board.investigator(alder)).toMatchObject({ actions: left });
  });

  it.each<{ cost: ActionCost; attacks: string[] }>([
    { cost: 'action', attacks: ['ghoul'] },
    { cost: 'free', attacks: [] },
  ])('a move as $cost provokes attacks of opportunity from $attacks', async ({ cost, attacks }) => {
    const table = aldersTurn();

    await actionsOn(table).moveTo(hall, cost);

    expect(table.board.decisions.map(({ about }) => about)).toEqual(attacks);
  });

  it('draws the top encounter card for an investigator outside the mythos phase', async () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withInvestigator(alder, { locationId: study })
        .withInvestigator(brook, { locationId: study })
        .withCard(instanceId('top_card'), blankTreachery('top_card'), { kind: 'encounterDeck' })
        .withCard(instanceId('next_card'), blankTreachery('next_card'), { kind: 'encounterDeck' })
        .withTurnOf(alder),
    );

    await actionsOn(table).drawEncounter(brook);

    expect(table.board.encounter.discard.map(({ name }) => name)).toEqual(['top_card']);
    expect(table.board.encounter.deckCount).toBe(1);
  });

  it.each<{ move: CardMove; place: CardPlaceView }>([
    { move: { to: 'discard' }, place: { kind: 'encounterDiscard' } },
    { move: { to: 'setAside' }, place: { kind: 'setAside' } },
    {
      move: { to: 'threatArea', investigator: brook },
      place: { kind: 'threatArea', investigator: brook },
    },
    {
      move: { to: 'location', location: hall },
      place: { kind: 'atLocation', location: cardName('hall') },
    },
    {
      move: { to: 'location', location: study, engagedWith: alder },
      place: { kind: 'engaged', investigator: alder },
    },
  ])('puts an encounter card by hand: $move.to', async ({ move, place }) => {
    const card = instanceId('drawn');
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withInvestigator(alder, { locationId: study })
        .withInvestigator(brook, { locationId: study })
        .withCard(card, blankEnemy('drawn'), { kind: 'encounterDeck' }),
    );

    await actionsOn(table).moveEncounterCard(card, move);

    expect(table.board.placeOf(card)).toEqual(place);
  });

  it('takes a clue from the study without a test', async () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true, clues: 2 })
        .withInvestigator(alder, { locationId: study })
        .withTurnOf(alder),
    );

    await actionsOn(table).takeClue(study);

    expect(table.board.investigator(alder)).toMatchObject({ clues: 1, actions: 3 });
    expect(table.board.location(study).clues).toBe(1);
  });

  it.each<{ effect: string; act: (actions: GameActions) => Promise<void>; ghoul: object }>([
    {
      effect: 'damage',
      act: (actions) => actions.damageEnemy(ghoul, 1),
      ghoul: { at: 'study', engagedWith: alder, damage: 1 },
    },
    {
      effect: 'disengage',
      act: (actions) => actions.disengageEnemy(ghoul),
      ghoul: { at: 'study' },
    },
  ])('a card effect can $effect the ghoul', async ({ act, ghoul: expected }) => {
    const table = aldersTurn();

    await act(actionsOn(table));

    expect(table.board.enemies.find(({ name }) => name === 'ghoul')).toEqual({
      name: 'ghoul',
      health: 3,
      ...expected,
    });
  });

  it('a card effect can defeat the ghoul', async () => {
    const table = aldersTurn();

    await actionsOn(table).defeatEnemy(ghoul);

    expect(table.board.enemies.map(({ name }) => name)).toEqual(['lurker']);
  });
});
