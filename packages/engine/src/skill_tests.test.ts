import { describe, expect, it } from 'vitest';
import {
  decisionId,
  instanceId,
  investigatorId,
  skillTestDecision,
  type Command,
  type GameState,
  type StartingCard,
  type Zone,
} from './index';
import {
  contextWith,
  edge,
  fixed,
  makeCard,
  makeInvestigator,
  rejectionFrom,
  startBoard,
  stateAfter,
} from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const study = instanceId('study');
const hallway = instanceId('hallway');
const ghoul = instanceId('ghoul');

/**
 * The study (shroud 3, 2 clues) next to the bare hallway (shroud 1, no
 * clues); a ghoul (fight 4, evade 2, 3 health) and a massive ghoul (evade 5).
 */
const ctx = contextWith(
  makeCard({ code: 'study', name: 'Study', typeCode: 'location', shroud: 3, clues: fixed(2) }),
  makeCard({ code: 'hallway', name: 'Hallway', typeCode: 'location', shroud: 1 }),
  makeCard({ code: 'ghoul', typeCode: 'enemy', fight: 4, evade: 2, health: fixed(3) }),
  makeCard({ code: 'massive_ghoul', typeCode: 'enemy', evade: 5, keywords: [{ name: 'massive' }] }),
  makeCard({ code: 'chilling_treachery', revelationTest: { skill: 'willpower', difficulty: 4 } }),
  makeCard({ code: 'plain_treachery' }),
);

const engagedWith = (investigator: typeof alice): Zone => ({
  kind: 'engaged',
  investigatorId: investigator,
});
const at = (locationId: typeof study): Zone => ({ kind: 'atLocation', locationId });

/** Alice in the revealed study (2 clues), with `cards` besides; still in setup, so no turn is needed. */
function aliceInStudyWith(cards: StartingCard[] = []): GameState {
  const board = startBoard(ctx, {
    maps: {
      main: {
        locations: { study: 'study', hallway: 'hallway' },
        connections: [edge('study', 'hallway')],
      },
    },
    investigators: [makeInvestigator({ id: 'alice', locationId: study })],
    cards,
    shuffleEncounterDeck: false,
  });
  return stateAfter(ctx, board, { type: 'RevealLocation', locationId: study });
}

function answered(
  state: GameState,
  decision: string,
  optionId: string,
  amount?: number,
): GameState {
  return stateAfter(ctx, state, {
    type: 'ResolveDecision',
    decisionId: decisionId(decision),
    optionId,
    ...(amount === undefined ? {} : { amount }),
  });
}

describe('Investigate', () => {
  const investigate: Command = { type: 'Investigate', investigatorId: alice };

  it('asks alice for an intellect test against the shroud, passing for 1 to 2 clues', () => {
    const asked = stateAfter(ctx, aliceInStudyWith(), investigate);

    expect(asked.pending).toEqual([
      {
        id: 'investigate:alice',
        kind: 'skillTestResult',
        prompt: 'decision.investigate',
        subject: study,
        decider: { kind: 'investigator', investigatorId: alice },
        skillTest: { skill: 'intellect', difficulty: 3 },
        options: [
          {
            id: 'pass',
            label: 'decision.pass',
            amount: { default: 1, min: 1, max: 2 },
            commands: [
              { type: 'DiscoverClues', investigatorId: alice, locationId: study, amount: 1 },
            ],
          },
          { id: 'fail', label: 'decision.fail', commands: [] },
        ],
      },
    ]);
  });

  it('discovers 1 clue on a pass by default', () => {
    const passed = answered(
      stateAfter(ctx, aliceInStudyWith(), investigate),
      'investigate:alice',
      'pass',
    );

    expect(passed.investigators[0]!.clues).toBe(1);
    expect(passed.cards[study]!.tokens.clue).toBe(1);
  });

  it('discovers the number of clues the players confirm', () => {
    const passed = answered(
      stateAfter(ctx, aliceInStudyWith(), investigate),
      'investigate:alice',
      'pass',
      2,
    );

    expect(passed.investigators[0]!.clues).toBe(2);
    expect(passed.cards[study]!.tokens.clue ?? 0).toBe(0);
  });

  it.each([
    { name: 'more clues than the location has', amount: 3 },
    { name: 'no clue', amount: 0 },
  ])('rejects confirming $name', ({ amount }) => {
    const asked = stateAfter(ctx, aliceInStudyWith(), investigate);

    expect(
      rejectionFrom(ctx, asked, {
        type: 'ResolveDecision',
        decisionId: decisionId('investigate:alice'),
        optionId: 'pass',
        amount,
      }),
    ).toEqual({
      code: 'amountOutOfRange',
      decisionId: decisionId('investigate:alice'),
      optionId: 'pass',
      amount,
      min: 1,
      max: 2,
    });
  });

  it('rejects a count for the fail option', () => {
    const asked = stateAfter(ctx, aliceInStudyWith(), investigate);

    expect(
      rejectionFrom(ctx, asked, {
        type: 'ResolveDecision',
        decisionId: decisionId('investigate:alice'),
        optionId: 'fail',
        amount: 1,
      }),
    ).toEqual({
      code: 'amountNotAdjustable',
      decisionId: decisionId('investigate:alice'),
      optionId: 'fail',
    });
  });

  it('changes nothing on a fail', () => {
    const failed = answered(
      stateAfter(ctx, aliceInStudyWith(), investigate),
      'investigate:alice',
      'fail',
    );

    expect(failed.investigators[0]!.clues).toBe(0);
    expect(failed.cards[study]!.tokens.clue).toBe(2);
  });

  it('accepts a pass at a location without clues, which discovers nothing', () => {
    const inHallway = stateAfter(ctx, aliceInStudyWith(), {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: hallway,
    });

    const passed = answered(stateAfter(ctx, inHallway, investigate), 'investigate:alice', 'pass');

    expect(passed.investigators[0]!.clues).toBe(0);
    expect(passed.pending).toEqual([]);
  });

  it('rejects an investigator who is not at a location', () => {
    const nowhere = startBoard(ctx, {
      maps: { main: { locations: { study: 'study' } } },
      investigators: [makeInvestigator({ id: 'alice' })],
    });

    expect(rejectionFrom(ctx, nowhere, investigate)).toEqual({
      code: 'investigatorHasNoLocation',
      investigatorId: alice,
    });
  });
});

describe('Fight', () => {
  const fight: Command = { type: 'Fight', investigatorId: alice, enemyId: ghoul };

  it('asks alice for a combat test against the fight value, passing for the basic 1 damage or more', () => {
    const asked = stateAfter(
      ctx,
      aliceInStudyWith([{ id: ghoul, code: 'ghoul', zone: engagedWith(alice) }]),
      fight,
    );

    expect(asked.pending[0]).toMatchObject({
      id: 'fight:alice:ghoul',
      prompt: 'decision.fight',
      subject: ghoul,
      skillTest: { skill: 'combat', difficulty: 4 },
      options: [
        {
          id: 'pass',
          amount: { default: 1, min: 1 },
          commands: [{ type: 'DamageEnemy', enemyId: ghoul, amount: 1 }],
        },
        { id: 'fail', commands: [] },
      ],
    });
  });

  it('deals 1 damage on a pass by default', () => {
    const asked = stateAfter(
      ctx,
      aliceInStudyWith([{ id: ghoul, code: 'ghoul', zone: engagedWith(alice) }]),
      fight,
    );

    const passed = answered(asked, 'fight:alice:ghoul', 'pass');

    expect(passed.cards[ghoul]!.tokens.damage).toBe(1);
  });

  it('deals the damage of the weapon used by default', () => {
    const asked = stateAfter(
      ctx,
      aliceInStudyWith([{ id: ghoul, code: 'ghoul', zone: engagedWith(alice) }]),
      {
        ...fight,
        damage: 2,
      },
    );

    const passed = answered(asked, 'fight:alice:ghoul', 'pass');

    expect(passed.cards[ghoul]!.tokens.damage).toBe(2);
  });

  it('deals the damage the players confirm, which can defeat the enemy', () => {
    const asked = stateAfter(
      ctx,
      aliceInStudyWith([{ id: ghoul, code: 'ghoul', zone: engagedWith(alice) }]),
      fight,
    );

    const passed = answered(asked, 'fight:alice:ghoul', 'pass', 3);

    expect(passed.cards[ghoul]!.zone).toEqual({ kind: 'encounterDiscard' });
  });

  it('can attack an unengaged enemy at the location', () => {
    const asked = stateAfter(
      ctx,
      aliceInStudyWith([{ id: ghoul, code: 'ghoul', zone: engagedWith(alice) }]),
      { type: 'DisengageEnemy', enemyId: ghoul },
      fight,
    );

    expect(asked.pending.map((decision) => decision.id)).toEqual(['fight:alice:ghoul']);
  });

  it('rejects an enemy at another location', () => {
    const state = aliceInStudyWith([{ id: ghoul, code: 'ghoul', zone: at(hallway) }]);

    expect(rejectionFrom(ctx, state, fight)).toEqual({
      code: 'investigatorNotAtLocation',
      investigatorId: alice,
      locationId: hallway,
    });
  });

  it('rejects an enemy that is not in play', () => {
    const state = aliceInStudyWith([{ id: ghoul, code: 'ghoul', zone: { kind: 'encounterDeck' } }]);

    expect(rejectionFrom(ctx, state, fight)).toEqual({ code: 'enemyNotInPlay', cardId: ghoul });
  });

  it('rejects a damage amount that is not positive', () => {
    const state = aliceInStudyWith([{ id: ghoul, code: 'ghoul', zone: engagedWith(alice) }]);

    expect(rejectionFrom(ctx, state, { ...fight, damage: 0 })).toEqual({
      code: 'invalidTokenDelta',
      delta: 0,
    });
  });
});

describe('failed Fight', () => {
  /** Alice and bob (2 health left) in the study; alice fights the ghoul in `zone` for 2 damage and fails. */
  function failedFight(code: string, zone: Zone, ...before: Command[]): GameState {
    const board = startBoard(ctx, {
      maps: { main: { locations: { study: 'study' } } },
      investigators: [
        makeInvestigator({ id: 'alice', seat: 0, locationId: study }),
        makeInvestigator({ id: 'bob', seat: 1, locationId: study, health: { max: 3, damage: 1 } }),
      ],
      cards: [{ id: ghoul, code, zone }],
    });
    const asked = stateAfter(ctx, board, ...before, {
      type: 'Fight',
      investigatorId: alice,
      enemyId: ghoul,
      damage: 2,
    });
    return answered(asked, 'fight:alice:ghoul', 'fail');
  }

  it('deals the attack`s damage to the other investigator engaged with the enemy, which can defeat them', () => {
    const failed = failedFight('ghoul', engagedWith(bob));

    expect(failed.investigators[1]).toMatchObject({
      health: { max: 3, damage: 3 },
      status: 'defeated',
    });
  });

  it.each<{ name: string; code: string; zone: Zone; before: Command[] }>([
    { name: 'engaged with the fighter', code: 'ghoul', zone: engagedWith(alice), before: [] },
    {
      name: 'unengaged',
      code: 'ghoul',
      zone: engagedWith(alice),
      before: [{ type: 'DisengageEnemy', enemyId: ghoul }],
    },
    { name: 'massive', code: 'massive_ghoul', zone: at(study), before: [] },
  ])('deals no damage for an enemy that is $name', ({ code, zone, before }) => {
    const failed = failedFight(code, zone, ...before);

    expect(failed.investigators.map((inv) => [inv.id, inv.health.damage])).toEqual([
      ['alice', 0],
      ['bob', 1],
    ]);
  });
});

describe('Evade', () => {
  const evade: Command = { type: 'Evade', investigatorId: alice, enemyId: ghoul };

  it('asks alice for an agility test against the evade value', () => {
    const asked = stateAfter(
      ctx,
      aliceInStudyWith([{ id: ghoul, code: 'ghoul', zone: engagedWith(alice) }]),
      evade,
    );

    expect(asked.pending[0]).toMatchObject({
      id: 'evade:alice:ghoul',
      prompt: 'decision.evade',
      skillTest: { skill: 'agility', difficulty: 2 },
    });
  });

  it('exhausts and disengages the enemy on a pass', () => {
    const asked = stateAfter(
      ctx,
      aliceInStudyWith([{ id: ghoul, code: 'ghoul', zone: engagedWith(alice) }]),
      evade,
    );

    const passed = answered(asked, 'evade:alice:ghoul', 'pass');

    expect(passed.cards[ghoul]).toMatchObject({ exhausted: true, zone: at(study) });
  });

  it('only disengages an enemy that is already exhausted', () => {
    const asked = stateAfter(
      ctx,
      aliceInStudyWith([{ id: ghoul, code: 'ghoul', zone: engagedWith(alice) }]),
      { type: 'ExhaustEnemy', enemyId: ghoul },
      evade,
    );

    expect(asked.pending[0]!.options[0]!.commands).toEqual([
      { type: 'DisengageEnemy', enemyId: ghoul },
    ]);
  });

  it('only exhausts a massive enemy, which stays engaged with everyone at its location', () => {
    const asked = stateAfter(
      ctx,
      aliceInStudyWith([{ id: ghoul, code: 'massive_ghoul', zone: at(study) }]),
      evade,
    );

    const passed = answered(asked, 'evade:alice:ghoul', 'pass');

    expect(passed.cards[ghoul]).toMatchObject({ exhausted: true, zone: at(study) });
  });

  it('leaves the enemy engaged on a fail', () => {
    const asked = stateAfter(
      ctx,
      aliceInStudyWith([{ id: ghoul, code: 'ghoul', zone: engagedWith(alice) }]),
      evade,
    );

    const failed = answered(asked, 'evade:alice:ghoul', 'fail');

    expect(failed.cards[ghoul]).toMatchObject({ exhausted: false, zone: engagedWith(alice) });
  });

  it('rejects an enemy that is not engaged with the investigator', () => {
    const state = aliceInStudyWith([{ id: ghoul, code: 'ghoul', zone: at(hallway) }]);

    expect(rejectionFrom(ctx, state, evade)).toEqual({ code: 'notEngaged', cardId: ghoul });
  });
});

describe('revelation test', () => {
  const chill = instanceId('chill');
  const draw: Command = { type: 'DrawEncounter', investigatorId: alice };

  it('asks the drawer for the test of a treachery that has one', () => {
    const drawn = stateAfter(
      ctx,
      aliceInStudyWith([
        { id: chill, code: 'chilling_treachery', zone: { kind: 'encounterDeck' } },
        { id: instanceId('next_card'), code: 'plain_treachery', zone: { kind: 'encounterDeck' } },
      ]),
      draw,
    );

    expect(drawn.pending).toEqual([
      {
        id: 'revelation:chill',
        kind: 'skillTestResult',
        prompt: 'decision.revelationTest',
        subject: chill,
        decider: { kind: 'investigator', investigatorId: alice },
        skillTest: { skill: 'willpower', difficulty: 4 },
        options: [
          { id: 'pass', label: 'decision.pass', commands: [] },
          { id: 'fail', label: 'decision.fail', commands: [] },
        ],
      },
    ]);
    expect(drawn.cards[chill]!.zone).toEqual({ kind: 'encounterDiscard' });
  });

  it('leaves what failing costs to the players', () => {
    const drawn = stateAfter(
      ctx,
      aliceInStudyWith([
        { id: chill, code: 'chilling_treachery', zone: { kind: 'encounterDeck' } },
      ]),
      draw,
    );

    const failed = answered(drawn, 'revelation:chill', 'fail');

    expect(failed.pending).toEqual([]);
    expect(failed.investigators[0]).toMatchObject({ health: { damage: 0 }, sanity: { horror: 0 } });
  });

  it('asks nothing for a treachery without a test', () => {
    const drawn = stateAfter(
      ctx,
      aliceInStudyWith([
        { id: instanceId('plain'), code: 'plain_treachery', zone: { kind: 'encounterDeck' } },
      ]),
      draw,
    );

    expect(drawn.pending).toEqual([]);
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

    const failed = answered(stateAfter(ctx, aliceInStudyWith(), request), 'mishap', 'fail');

    expect(failed.investigators[0]!.sanity.horror).toBe(2);
  });
});
