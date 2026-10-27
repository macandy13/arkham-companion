import { describe, expect, it } from 'vitest';
import {
  advanceBySpendingClues,
  attachedTo,
  blankAct,
  blankAgenda,
  blankEnemy,
  blankLocation,
  blankTreachery,
  engagedWith,
  fixed,
  formatBoard,
  instanceId,
  investigatorId,
  mapId,
  newGame,
  perInvestigator,
  threatAreaOf,
  type GameState,
} from './index';
import { stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const manor = mapId('manor');
const hall = instanceId('hall');
const attic = instanceId('attic');
const ghoul = instanceId('ghoul');

/** Every card has a printed name, since the board lists cards by name. */
const planCard = blankAgenda('plan', fixed(2), { name: 'The Plan' });
/** Needs 2 clues per investigator, so 4 with Alice and Bob. */
const searchCard = blankAct('search', {
  name: 'The Search',
  actions: [advanceBySpendingClues(perInvestigator(2))],
});
const hallCard = blankLocation('hall', { name: 'Hall' });
const atticCard = blankLocation('attic', { name: 'Attic' });
/** 3 health, so it survives the 2 damage the board shows. */
const ghoulCard = blankEnemy('ghoul', { name: 'Ghoul', health: fixed(3) });
const dreadCard = blankTreachery('dread', { name: 'Dread' });
const ratCard = blankEnemy('rat', { name: 'Rat', victory: 1 });

/**
 * Alice (intellect 4) in the revealed Hall (3 clues, no shroud) with a damaged, exhausted Ghoul engaged
 * and Dread in her threat area and attached to the Hall; Bob next door in the unrevealed Attic, which
 * only connects one way back to the Hall. The Plan holds 1 of its 2 doom.
 */
const { context, state: startState } = newGame()
  .withMap(manor, { name: 'Manor' })
  .withLocation(hall, hallCard, { revealed: true, clues: 3, map: manor })
  .withLocation(attic, atticCard, { map: manor })
  .withConnection(attic, hall, { oneWay: true })
  .withInvestigator(alice, {
    name: 'Alice',
    locationId: hall,
    clues: 1,
    skills: { willpower: 3, intellect: 4, combat: 2, agility: 1 },
  })
  .withInvestigator(bob, { name: 'Bob', locationId: attic })
  .withCard(instanceId('plan'), planCard, { kind: 'agendaDeck' }, { tokens: { doom: 1 } })
  .withCard(instanceId('search'), searchCard, { kind: 'actDeck' })
  .withCard(ghoul, ghoulCard, engagedWith(alice))
  .withCard(instanceId('dread'), dreadCard, threatAreaOf(alice))
  .withCard(instanceId('attached_dread'), dreadCard, attachedTo(hall))
  .withCard(instanceId('rat'), ratCard, { kind: 'victoryDisplay' })
  .withCard(instanceId('discarded_dread'), dreadCard, { kind: 'encounterDiscard' })
  .withCard(instanceId('rat_in_deck'), ratCard, { kind: 'encounterDeck' })
  .withCard(instanceId('set_aside_rat'), ratCard, { kind: 'setAside' })
  .start();

function startedBoard(): GameState {
  return stateAfter(
    context,
    startState,
    { type: 'DamageEnemy', enemyId: ghoul, amount: 2 },
    { type: 'ExhaustEnemy', enemyId: ghoul },
  );
}

describe('formatBoard', () => {
  it('lists the agenda, act, locations, investigators and piles by card name', () => {
    expect(formatBoard(context, startedBoard())).toMatchInlineSnapshot(`
      "Round 0, setup phase
      Agenda: The Plan – doom 1/2
      Act: The Search – needs 4 clues
      Map Manor:
        Hall [hall] – revealed, 3 clues
          investigators: Alice
          Ghoul [ghoul] – 2 damage, exhausted, engaged with Alice
          attached: Dread
          connects to: none
        Attic [attic] – unrevealed
          investigators: Bob
          connects to: Hall
      Investigators:
        Alice – Hall; damage 0/8, horror 0/6, 1 clues, 5 resources, actions left 3; threat area: Dread
        Bob – Attic; damage 0/8, horror 0/6, 0 clues, 5 resources, actions left 3; threat area: none
      Encounter deck: 1 cards; discard: 1 cards, top: Dread
      Set aside: 1 cards
      Victory display: Rat
      Pending decisions: none"
    `);
  });

  it('lists pending decisions with their options', () => {
    const state = stateAfter(
      context,
      startedBoard(),
      { type: 'PlaceDoom', amount: 1 },
      { type: 'CheckDoomThreshold' },
    );

    expect(formatBoard(context, state).split('\n').slice(-2)).toMatchInlineSnapshot(`
      [
        "Pending decisions:",
        "  Advance agenda The Plan yes / no [confirm]",
      ]
    `);
  });

  it('shows the suggested values of a pending skill test', () => {
    const state = stateAfter(context, startedBoard(), {
      type: 'Investigate',
      investigatorId: alice,
    });

    expect(formatBoard(context, state).split('\n').slice(-3)).toMatchInlineSnapshot(`
      [
        "Pending decisions:",
        "  Investigate Hall: intellect (0) pass ×1 (1–3) / fail [skillTestResult]",
        "    suggested: skill 4 vs difficulty 0 (pass)",
      ]
    `);
  });

  it('tells two decisions apart that read the same by their subject', () => {
    const cellar = instanceId('cellar');
    const twoGhouls = newGame()
      .withLocation(hall, hallCard, { revealed: true })
      .withLocation(cellar, blankLocation('cellar', { name: 'Cellar' }))
      .withConnection(hall, cellar)
      .withInvestigator(alice, { locationId: hall })
      .withCard(instanceId('first_ghoul'), ghoulCard, engagedWith(alice))
      .withCard(instanceId('second_ghoul'), ghoulCard, engagedWith(alice))
      .withTurnOf(alice)
      .start();

    const moved = stateAfter(twoGhouls.context, twoGhouls.state, {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: cellar,
      asAction: true,
    });

    expect(formatBoard(twoGhouls.context, moved).split('\n').slice(-3)).toMatchInlineSnapshot(`
      [
        "Pending decisions:",
        "  [first_ghoul] Attack of opportunity by Ghoul: attack damage ×0 (0+) horror ×0 (0+) / does not provoke [confirm]",
        "  [second_ghoul] Attack of opportunity by Ghoul: attack damage ×0 (0+) horror ×0 (0+) / does not provoke [confirm]",
      ]
    `);
  });

  it('shows the turn in progress, the turns taken and the actions left', () => {
    const state = stateAfter(
      context,
      startedBoard(),
      { type: 'NextPhase' },
      { type: 'StartTurn', investigatorId: bob },
      { type: 'EndTurn', investigatorId: bob },
      { type: 'StartTurn', investigatorId: alice },
      { type: 'AdjustActions', investigatorId: alice, delta: -1 },
    );

    expect(formatBoard(context, state).split('\n').slice(0, 3)).toMatchInlineSnapshot(`
      [
        "Round 1, investigation phase",
        "Turn: Alice",
        "Turns taken: Bob",
      ]
    `);
    expect(formatBoard(context, state)).toContain('5 resources, actions left 2;');
  });

  it('shows the phase steps left while a decision holds up the mythos phase', () => {
    const state = stateAfter(
      context,
      startedBoard(),
      { type: 'NextPhase' },
      { type: 'StartTurn', investigatorId: alice },
      { type: 'EndTurn', investigatorId: alice },
      { type: 'StartTurn', investigatorId: bob },
      { type: 'EndTurn', investigatorId: bob },
      { type: 'NextPhase' },
      { type: 'NextPhase' },
      { type: 'NextPhase' },
    );

    expect(formatBoard(context, state).split('\n').slice(0, 2)).toMatchInlineSnapshot(`
      [
        "Round 2, mythos phase",
        "Steps left: drawEncounterCard (Alice), drawEncounterCard (Bob)",
      ]
    `);
  });

  it('shows an encounter card whose revelation is still being resolved', () => {
    const state = stateAfter(context, startedBoard(), {
      type: 'MoveCard',
      cardId: instanceId('discarded_dread'),
      to: { kind: 'resolving' },
    });

    expect(formatBoard(context, state)).toContain('discard: 0 cards\nResolving: Dread\n');
  });

  it('marks a hidden map, an empty map and a missing agenda and act', () => {
    const empty = newGame()
      .withMap(manor, { name: 'Manor', visible: false })
      .withInvestigator(bob, { name: 'Bob' })
      .start();

    expect(formatBoard(empty.context, empty.state)).toMatchInlineSnapshot(`
      "Round 0, setup phase
      Agenda: none
      Act: none
      Map Manor (hidden):
        no locations
      Investigators:
        Bob – nowhere; damage 0/8, horror 0/6, 0 clues, 5 resources, actions left 3; threat area: none
      Encounter deck: 0 cards; discard: 0 cards
      Set aside: 0 cards
      Victory display: none
      Pending decisions: none"
    `);
  });
});
