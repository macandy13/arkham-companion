import { describe, expect, it } from 'vitest';
import {
  formatBoard,
  instanceId,
  investigatorId,
  mapId,
  type GameState,
  type StartScenario,
} from './index';
import {
  contextWith,
  edge,
  fixed,
  makeCard,
  makeInvestigator,
  perInvestigator,
  run,
  stateAfter,
} from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const manor = mapId('manor');
const hall = instanceId('hall');
const attic = instanceId('attic');
const ghoul = instanceId('ghoul');

const ctx = contextWith(
  makeCard({ code: 'plan', name: 'The Plan', typeCode: 'agenda', doom: fixed(2) }),
  makeCard({ code: 'search', name: 'The Search', typeCode: 'act', clues: perInvestigator(2) }),
  makeCard({ code: 'hall', name: 'Hall', typeCode: 'location' }),
  makeCard({ code: 'attic', name: 'Attic', typeCode: 'location' }),
  makeCard({ code: 'ghoul', name: 'Ghoul', typeCode: 'enemy', health: fixed(3) }),
  makeCard({ code: 'dread', name: 'Dread' }),
  makeCard({ code: 'rat', name: 'Rat', typeCode: 'enemy', victory: 1 }),
);

/**
 * Alice in the revealed Hall (3 clues) with a damaged, exhausted Ghoul engaged
 * and Dread in her threat area and attached to the Hall; Bob next door in the unrevealed Attic, which
 * only connects one way back to the Hall. The Plan holds 1 of its 2 doom.
 */
const start: StartScenario = {
  type: 'StartScenario',
  scenarioId: 'format',
  difficulty: 'standard',
  seed: 1,
  shuffleEncounterDeck: false,
  investigators: [
    makeInvestigator({ id: 'alice', name: 'Alice', seat: 0, locationId: hall, clues: 1 }),
    makeInvestigator({ id: 'bob', name: 'Bob', seat: 1, locationId: attic }),
  ],
  maps: { [manor]: { name: 'Manor', connections: [edge('attic', 'hall', { oneWay: true })] } },
  cards: [
    { id: instanceId('plan'), code: 'plan', zone: { kind: 'agendaDeck' }, tokens: { doom: 1 } },
    { id: instanceId('search'), code: 'search', zone: { kind: 'actDeck' } },
    {
      id: hall,
      code: 'hall',
      zone: { kind: 'location', mapId: manor },
      faceUp: true,
      tokens: { clue: 3 },
    },
    { id: attic, code: 'attic', zone: { kind: 'location', mapId: manor } },
    { id: ghoul, code: 'ghoul', zone: { kind: 'engaged', investigatorId: alice } },
    { id: instanceId('dread'), code: 'dread', zone: { kind: 'threatArea', investigatorId: alice } },
    { id: instanceId('dread3'), code: 'dread', zone: { kind: 'attachedTo', hostId: hall } },
    { id: instanceId('rat'), code: 'rat', zone: { kind: 'victoryDisplay' } },
    { id: instanceId('dread2'), code: 'dread', zone: { kind: 'encounterDiscard' } },
    { id: instanceId('rat2'), code: 'rat', zone: { kind: 'encounterDeck' } },
    { id: instanceId('rat3'), code: 'rat', zone: { kind: 'setAside' } },
  ],
};

function startedBoard(): GameState {
  return stateAfter(
    ctx,
    run(ctx, [start]).state,
    { type: 'DamageEnemy', enemyId: ghoul, amount: 2 },
    { type: 'ExhaustEnemy', enemyId: ghoul },
  );
}

describe('formatBoard', () => {
  it('lists the agenda, act, locations, investigators and piles by card name', () => {
    expect(formatBoard(ctx, startedBoard())).toMatchInlineSnapshot(`
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
        Alice – Hall; damage 0/8, horror 0/6, 1 clues, 5 resources; threat area: Dread
        Bob – Attic; damage 0/8, horror 0/6, 0 clues, 5 resources; threat area: none
      Encounter deck: 1 cards; discard: 1 cards, top: Dread
      Set aside: 1 cards
      Victory display: Rat
      Pending decisions: none"
    `);
  });

  it('lists pending decisions with their options', () => {
    const state = stateAfter(
      ctx,
      startedBoard(),
      { type: 'PlaceDoom', amount: 1 },
      { type: 'CheckDoomThreshold' },
    );

    expect(formatBoard(ctx, state).split('\n').slice(-2)).toMatchInlineSnapshot(`
      [
        "Pending decisions:",
        "  Advance agenda The Plan yes / no [confirm]",
      ]
    `);
  });

  it('shows the turn in progress with its actions and the turns taken', () => {
    const state = stateAfter(
      ctx,
      startedBoard(),
      { type: 'NextPhase' },
      { type: 'StartTurn', investigatorId: bob },
      { type: 'EndTurn', investigatorId: bob },
      { type: 'StartTurn', investigatorId: alice },
      { type: 'TakeAction', investigatorId: alice, action: 'draw' },
    );

    expect(formatBoard(ctx, state).split('\n').slice(0, 3)).toMatchInlineSnapshot(`
      [
        "Round 1, investigation phase",
        "Turn: Alice, actions 1/3",
        "Turns taken: Bob",
      ]
    `);
  });

  it('shows the phase steps left while a decision holds up the mythos phase', () => {
    const state = stateAfter(
      ctx,
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

    expect(formatBoard(ctx, state).split('\n').slice(0, 2)).toMatchInlineSnapshot(`
      [
        "Round 2, mythos phase",
        "Steps left: 1.4 (Alice), 1.4 (Bob)",
      ]
    `);
  });

  it('shows an encounter card whose revelation is still being resolved', () => {
    const state = stateAfter(ctx, startedBoard(), {
      type: 'MoveCard',
      cardId: instanceId('dread2'),
      to: { kind: 'resolving' },
    });

    expect(formatBoard(ctx, state)).toContain('discard: 0 cards\nResolving: Dread\n');
  });

  it('marks a hidden map, an empty map and a missing agenda and act', () => {
    const { state } = run(ctx, [
      {
        type: 'StartScenario',
        scenarioId: 'empty',
        difficulty: 'standard',
        seed: 1,
        investigators: [makeInvestigator({ id: 'bob', name: 'Bob' })],
        maps: { [manor]: { name: 'Manor', visible: false } },
        cards: [],
      },
    ]);

    expect(formatBoard(ctx, state)).toMatchInlineSnapshot(`
      "Round 0, setup phase
      Agenda: none
      Act: none
      Map Manor (hidden):
        no locations
      Investigators:
        Bob – nowhere; damage 0/8, horror 0/6, 0 clues, 5 resources; threat area: none
      Encounter deck: 0 cards; discard: 0 cards
      Set aside: 0 cards
      Victory display: none
      Pending decisions: none"
    `);
  });
});
