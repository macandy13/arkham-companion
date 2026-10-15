import { describe, expect, it } from 'vitest';
import {
  decisionId,
  execute,
  instanceId,
  investigatorId,
  skillTestDecision,
  type Command,
  type GameState,
  type Zone,
} from './index';
import {
  contextWith,
  edge,
  fixed,
  makeCard,
  makeInvestigator,
  rejectionOf as rejectionFrom,
  runFrom,
  startBoard,
} from '../test/utils';

const alice = investigatorId('alice');
const id = instanceId;

const ctx = contextWith(
  makeCard({ code: 'LOC', typeCode: 'location', shroud: 3, clues: fixed(2) }),
  makeCard({ code: 'BARE', typeCode: 'location', shroud: 1 }),
  makeCard({ code: 'FOE', typeCode: 'enemy', fight: 4, evade: 2, health: fixed(3) }),
  makeCard({ code: 'BIG', typeCode: 'enemy', evade: 5, keywords: [{ name: 'massive' }] }),
);

/**
 * Alice at the revealed `a` (shroud 3, 2 clues); `b` (no clues) is connected;
 * `enemies` by instance ID.
 */
function started(enemies: Record<string, { code: string; zone: Zone }> = {}): GameState {
  const board = startBoard(ctx, {
    maps: { main: { locations: { a: 'LOC', b: 'BARE' }, connections: [edge('a', 'b')] } },
    investigators: [makeInvestigator({ id: 'alice', locationId: id('a') })],
    cards: enemies,
  });
  return run(board, { type: 'RevealLocation', locationId: id('a') });
}

const engaged: Zone = { kind: 'engaged', investigatorId: alice };
const at = (place: string): Zone => ({ kind: 'atLocation', locationId: id(place) });

function run(state: GameState, ...commands: Command[]): GameState {
  return runFrom(ctx, state, commands).state;
}

function answer(state: GameState, decision: string, option: string): GameState {
  return run(state, {
    type: 'ResolveDecision',
    decisionId: decisionId(decision),
    optionId: option,
  });
}

function rejectionOf(state: GameState, command: Command) {
  return rejectionFrom(() => execute(ctx, state, command));
}

describe('Investigate', () => {
  it('asks for an intellect test against the shroud of the location', () => {
    const asked = run(started(), { type: 'Investigate', investigatorId: alice });

    expect(asked.pending).toEqual([
      expect.objectContaining({
        id: 'investigate:alice',
        kind: 'skillTestResult',
        subject: 'a',
        decider: { kind: 'investigator', investigatorId: alice },
        skillTest: { skill: 'intellect', difficulty: 3 },
      }),
    ]);
  });

  it('discovers 1 clue on a pass', () => {
    const asked = run(started(), { type: 'Investigate', investigatorId: alice });

    const passed = answer(asked, 'investigate:alice', 'pass');

    expect(passed.investigators[0]?.clues).toBe(1);
    expect(passed.cards[id('a')]?.tokens.clue).toBe(1);
  });

  it('changes nothing on a fail', () => {
    const asked = run(started(), { type: 'Investigate', investigatorId: alice });

    const failed = answer(asked, 'investigate:alice', 'fail');

    expect(failed.investigators[0]?.clues).toBe(0);
    expect(failed.pending).toEqual([]);
  });

  it('accepts a pass at a location without clues', () => {
    const atB = run(started(), { type: 'MoveInvestigator', investigatorId: alice, to: id('b') });
    const asked = run(atB, { type: 'Investigate', investigatorId: alice });

    const passed = answer(asked, 'investigate:alice', 'pass');

    expect(passed.investigators[0]?.clues).toBe(0);
  });

  it('rejects an investigator who is not at a location', () => {
    const state = started();
    const nowhere = {
      ...state,
      investigators: state.investigators.map((inv) => ({ ...inv, locationId: undefined })),
    };

    expect(rejectionOf(nowhere, { type: 'Investigate', investigatorId: alice })).toEqual({
      code: 'investigatorHasNoLocation',
      investigatorId: alice,
    });
  });
});

describe('Fight', () => {
  it('asks for a combat test against the fight value of the enemy', () => {
    const asked = run(started({ foe: { code: 'FOE', zone: engaged } }), {
      type: 'Fight',
      investigatorId: alice,
      enemyId: id('foe'),
    });

    expect(asked.pending[0]).toMatchObject({
      id: 'fight:alice:foe',
      subject: 'foe',
      skillTest: { skill: 'combat', difficulty: 4 },
    });
  });

  it('deals 1 damage on a pass', () => {
    const asked = run(started({ foe: { code: 'FOE', zone: engaged } }), {
      type: 'Fight',
      investigatorId: alice,
      enemyId: id('foe'),
    });

    const passed = answer(asked, 'fight:alice:foe', 'pass');

    expect(passed.cards[id('foe')]?.tokens.damage).toBe(1);
  });

  it('deals the damage of the weapon used, which can defeat the enemy', () => {
    const asked = run(started({ foe: { code: 'FOE', zone: engaged } }), {
      type: 'Fight',
      investigatorId: alice,
      enemyId: id('foe'),
      damage: 3,
    });

    const passed = answer(asked, 'fight:alice:foe', 'pass');

    expect(passed.cards[id('foe')]?.zone).toEqual({ kind: 'encounterDiscard' });
  });

  it('can attack an unengaged enemy at the location', () => {
    const unengaged = run(started({ foe: { code: 'FOE', zone: engaged } }), {
      type: 'DisengageEnemy',
      enemyId: id('foe'),
    });

    const asked = run(unengaged, {
      type: 'Fight',
      investigatorId: alice,
      enemyId: id('foe'),
    });

    expect(asked.pending.map((d) => d.id)).toEqual(['fight:alice:foe']);
  });

  it('rejects an enemy at another location', () => {
    expect(
      rejectionOf(started({ foe: { code: 'FOE', zone: at('b') } }), {
        type: 'Fight',
        investigatorId: alice,
        enemyId: id('foe'),
      }),
    ).toEqual({ code: 'investigatorNotAtLocation', investigatorId: alice, locationId: 'b' });
  });

  it('rejects an enemy that is not in play', () => {
    expect(
      rejectionOf(started({ foe: { code: 'FOE', zone: { kind: 'encounterDeck' } } }), {
        type: 'Fight',
        investigatorId: alice,
        enemyId: id('foe'),
      }).code,
    ).toBe('enemyNotInPlay');
  });

  it('rejects a damage amount that is not positive', () => {
    expect(
      rejectionOf(started({ foe: { code: 'FOE', zone: engaged } }), {
        type: 'Fight',
        investigatorId: alice,
        enemyId: id('foe'),
        damage: 0,
      }),
    ).toEqual({ code: 'invalidTokenDelta', delta: 0 });
  });
});

describe('Evade', () => {
  it('asks for an agility test against the evade value of the enemy', () => {
    const asked = run(started({ foe: { code: 'FOE', zone: engaged } }), {
      type: 'Evade',
      investigatorId: alice,
      enemyId: id('foe'),
    });

    expect(asked.pending[0]).toMatchObject({
      id: 'evade:alice:foe',
      skillTest: { skill: 'agility', difficulty: 2 },
    });
  });

  it('exhausts and disengages the enemy on a pass', () => {
    const asked = run(started({ foe: { code: 'FOE', zone: engaged } }), {
      type: 'Evade',
      investigatorId: alice,
      enemyId: id('foe'),
    });

    const passed = answer(asked, 'evade:alice:foe', 'pass');

    expect(passed.cards[id('foe')]).toMatchObject({ exhausted: true, zone: at('a') });
  });

  it('only disengages an enemy that is already exhausted', () => {
    const exhausted = run(started({ foe: { code: 'FOE', zone: engaged } }), {
      type: 'ExhaustEnemy',
      enemyId: id('foe'),
    });
    const asked = run(exhausted, { type: 'Evade', investigatorId: alice, enemyId: id('foe') });

    const passed = answer(asked, 'evade:alice:foe', 'pass');

    expect(passed.cards[id('foe')]).toMatchObject({ exhausted: true, zone: at('a') });
  });

  it('only exhausts a massive enemy, which stays engaged with everyone at its location', () => {
    const asked = run(started({ giant: { code: 'BIG', zone: at('a') } }), {
      type: 'Evade',
      investigatorId: alice,
      enemyId: id('giant'),
    });

    const passed = answer(asked, 'evade:alice:giant', 'pass');

    expect(passed.cards[id('giant')]).toMatchObject({ exhausted: true, zone: at('a') });
  });

  it('leaves the enemy engaged on a fail', () => {
    const asked = run(started({ foe: { code: 'FOE', zone: engaged } }), {
      type: 'Evade',
      investigatorId: alice,
      enemyId: id('foe'),
    });

    const failed = answer(asked, 'evade:alice:foe', 'fail');

    expect(failed.cards[id('foe')]).toMatchObject({ exhausted: false, zone: engaged });
  });

  it('rejects an enemy that is not engaged with the investigator', () => {
    expect(
      rejectionOf(started({ foe: { code: 'FOE', zone: at('b') } }), {
        type: 'Evade',
        investigatorId: alice,
        enemyId: id('foe'),
      }),
    ).toEqual({ code: 'notEngaged', cardId: 'foe' });
  });
});

describe('card-driven skill test', () => {
  it('applies the fail effect of a card the players resolved at the table', () => {
    const request: Command = {
      type: 'RequestDecision',
      decision: skillTestDecision(
        {
          id: decisionId('mishap'),
          prompt: 'card.mishap',
          decider: { kind: 'investigator', investigatorId: alice },
          test: { skill: 'willpower', difficulty: 3 },
        },
        {
          onPass: [],
          onFail: [{ type: 'AdjustInvestigator', investigatorId: alice, stat: 'horror', delta: 2 }],
        },
      ),
    };
    const asked = run(started(), request);

    const failed = answer(asked, 'mishap', 'fail');

    expect(failed.investigators[0]?.sanity.horror).toBe(2);
  });
});
