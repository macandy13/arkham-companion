import { describe, expect, it } from 'vitest';
import {
  atLocation,
  blankEnemy,
  blankLocation,
  cardName,
  type CardPlaceView,
  engagedWith,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  takeHorror,
  takeOneClue,
} from '@arkham/engine';
import { pileAdjustment, type PileMove } from '../encounter/cardMoves';
import { type GameActions, type How } from './gameActions';
import { actionsOn } from './gameActions.test_support';

const study = instanceId('study');
const hall = instanceId('hall');
const ghoul = instanceId('ghoul');
const lurker = instanceId('lurker');
const alder = investigatorId('alder');
const brook = investigatorId('brook');

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
    { verb: 'the resource action', act: (actions) => actions.takeResource(), left: 2 },
    { verb: 'the draw action', act: (actions) => actions.drawCard(), left: 2 },
    { verb: 'the play action', act: (actions) => actions.playCard(), left: 2 },
    { verb: 'fight', act: (actions) => actions.fight(ghoul), left: 2 },
    { verb: 'evade', act: (actions) => actions.evade(ghoul), left: 2 },
    { verb: 'engage', act: (actions) => actions.engage(lurker), left: 2 },
    { verb: 'a free fight', act: (actions) => actions.fight(ghoul, 'free'), left: 3 },
    { verb: 'a free evade', act: (actions) => actions.evade(ghoul, 'free'), left: 3 },
    { verb: 'a move', act: (actions) => actions.move(hall), left: 2 },
    { verb: 'a free move', act: (actions) => actions.move(hall, 'free'), left: 3 },
    {
      verb: 'the pawn drag',
      act: (actions) =>
        actions.perform({ type: 'MoveInvestigator', investigatorId: alder, to: hall }),
      left: 3,
    },
    {
      verb: 'engaging by card (with brook)',
      act: (actions) => actions.engage(ghoul, { byCard: brook }),
      left: 3,
    },
  ])('$verb leaves alder $left of three actions', async ({ act, left }) => {
    const table = aldersTurn();

    await act(actionsOn(table));

    expect(table.board.investigator(alder)).toMatchObject({ actions: left });
  });

  it.each([
    { kind: 'a card action', cost: {}, left: 2 },
    { kind: 'a free card action', cost: { free: true as const }, left: 3 },
    { kind: 'a card action costing two actions', cost: { actions: 2 }, left: 1 },
  ])('$kind leaves alder $left of three actions', async ({ cost, left }) => {
    const scare = { effects: [takeHorror(1)], ...cost };
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study', { actions: [scare] }), { revealed: true })
        .withInvestigator(alder, { locationId: study })
        .withTurnOf(alder),
    );

    await actionsOn(table).useCardAction(study, 0);

    expect(table.board.investigator(alder)).toMatchObject({ horror: 1, actions: left });
  });

  it.each<{ how: How; attacks: string[] }>([
    { how: 'action', attacks: ['ghoul'] },
    { how: 'free', attacks: [] },
    { how: { byCard: alder }, attacks: [] },
  ])('a move as $how provokes attacks of opportunity from $attacks', async ({ how, attacks }) => {
    const table = aldersTurn();

    await actionsOn(table).move(hall, how);

    expect(table.board.decisions.map(({ about }) => about)).toEqual(attacks);
  });

  describe('a move by card', () => {
    const attic = instanceId('attic');
    /** Alder's turn in the Study, Brook there with a lurker engaged; the Attic connects to nothing. */
    const brookBesideTheLoneAttic = () =>
      PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'), { revealed: true })
          .withLocation(attic, blankLocation('attic'), { revealed: true })
          .withInvestigator(alder, { locationId: study })
          .withInvestigator(brook, { locationId: study })
          .withCard(lurker, blankEnemy('lurker'), engagedWith(brook))
          .withTurnOf(alder),
      );

    it("moves brook to the unconnected attic on alder's turn, with no action and no attack, her lurker along", async () => {
      const table = brookBesideTheLoneAttic();

      await actionsOn(table).move(attic, { byCard: brook });

      expect(table.board.locationOf(brook)).toBe(attic);
      expect(table.board.investigator(alder)).toMatchObject({ actions: 3 });
      expect(table.board.decisions).toEqual([]);
      expect(table.board.enemiesEngagedWith(brook).map(({ id }) => id)).toEqual([lurker]);
    });
  });

  describe('a test by card', () => {
    /** Alder's turn in the Study; Brook in the Hall, a ghoul there engaged with nobody. */
    const brookInTheHallOnAldersTurn = () =>
      PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'), { revealed: true })
          .withLocation(hall, blankLocation('hall'), { revealed: true })
          .withConnection(study, hall)
          .withInvestigator(alder, { locationId: study })
          .withInvestigator(brook, { locationId: hall })
          .withCard(ghoul, blankEnemy('ghoul'), atLocation(hall))
          .withTurnOf(alder),
      );

    it.each([
      { kind: 'investigate', tester: alder, target: hall, test: 'intellect', about: 'hall' },
      { kind: 'fight', tester: alder, target: ghoul, test: 'combat', about: 'ghoul' },
      { kind: 'evade', tester: brook, target: ghoul, test: 'agility', about: 'ghoul' },
    ] as const)(
      '$kind by $tester at the $about asks a $test test and leaves alder 3 actions',
      async ({ kind, tester, target, test, about }) => {
        const table = brookInTheHallOnAldersTurn();
        const actions = actionsOn(table);

        await actions[kind](target, { byCard: tester });

        expect(table.board.decisions).toMatchObject([
          { for: tester, action: kind, about: cardName(about), test: { skill: test } },
        ]);
        expect(table.board.investigator(alder)).toMatchObject({ actions: 3 });
      },
    );
  });

  it.each<{ move: PileMove; place: CardPlaceView }>([
    { move: { to: 'discard' }, place: { kind: 'encounterDiscard' } },
    { move: { to: 'setAside' }, place: { kind: 'setAside' } },
    {
      move: { to: 'threatArea', investigator: brook },
      place: { kind: 'threatArea', investigator: brook },
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

    await actionsOn(table).correct(pileAdjustment(card, move));

    expect(table.board.placeOf(card)).toEqual(place);
  });

  it('gives alder, at 2 resources, the resource of the resource action once the ghoul has attacked', async () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withInvestigator(alder, { locationId: study, resources: 2 })
        .withCard(ghoul, blankEnemy('ghoul'), engagedWith(alder))
        .withTurnOf(alder),
    );
    const actions = actionsOn(table);

    await actions.takeResource();
    const attacks = table.board.decisions.map(({ about }) => about);
    const resourcesDuringAttack = table.board.investigator(alder).resources;
    await actions.answer('attack');

    expect(attacks).toEqual(['ghoul']);
    expect(resourcesDuringAttack).toBe(2);
    expect(table.board.investigator(alder)).toMatchObject({ resources: 3, actions: 2 });
  });

  it("gives brook a clue from the study on alder's turn, as a clue dragged onto their pawn", async () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true, clues: 2 })
        .withInvestigator(alder, { locationId: study })
        .withInvestigator(brook, { locationId: study })
        .withTurnOf(alder),
    );

    await actionsOn(table).perform(takeOneClue(study, brook));

    expect(table.board.investigator(brook).clues).toBe(1);
    expect(table.board.investigator(alder)).toMatchObject({ clues: 0, actions: 3 });
  });

  it('performs card effects in order: damage, then defeat, of the ghoul', async () => {
    const table = aldersTurn();

    await actionsOn(table).perform(
      { type: 'DamageEnemy', enemyId: ghoul, amount: 1 },
      { type: 'DefeatEnemy', enemyId: ghoul },
    );

    expect(table.board.enemies.map(({ name }) => name)).toEqual(['lurker']);
    expect(table.board.investigator(alder)).toMatchObject({ actions: 3 });
  });

  it('corrects the clues on the study and the hall, discovering nothing', async () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true, clues: 2 })
        .withLocation(hall, blankLocation('hall'), { revealed: true })
        .withInvestigator(alder, { locationId: study }),
    );

    await actionsOn(table).correct(
      { kind: 'tokens', cardId: study, token: 'clue', delta: -1 },
      { kind: 'tokens', cardId: hall, token: 'clue', delta: 1 },
    );

    expect(table.board.location(study).clues).toBe(1);
    expect(table.board.location(hall).clues).toBe(1);
    expect(table.board.investigator(alder).clues).toBe(0);
  });
});
