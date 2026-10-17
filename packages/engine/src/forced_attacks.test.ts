import { describe, expect, it } from 'vitest';
import {
  decisionId,
  instanceId,
  investigatorId,
  type Command,
  type GameState,
  type InstanceId,
  type StartingCard,
  type Zone,
} from './index';
import {
  contextWith,
  investigatorOf,
  makeCard,
  makeInvestigator,
  startBoard,
  stateAfter,
} from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const study = instanceId('study');
const enemy = instanceId('enemy');

/**
 * The study and three enemies that each deal 1 damage and 2 horror: a
 * retaliate ghoul, an alert ghoul and a plain ghoul without either keyword.
 */
const ctx = contextWith(
  makeCard({ code: 'study', name: 'Study', typeCode: 'location' }),
  makeCard({
    code: 'retaliate_ghoul',
    typeCode: 'enemy',
    fight: 4,
    damage: 1,
    horror: 2,
    keywords: [{ name: 'retaliate' }],
  }),
  makeCard({
    code: 'alert_ghoul',
    typeCode: 'enemy',
    evade: 4,
    damage: 1,
    horror: 2,
    keywords: [{ name: 'alert' }],
  }),
  makeCard({ code: 'plain_ghoul', typeCode: 'enemy', fight: 4, evade: 4, damage: 1, horror: 2 }),
);

const engagedWith = (investigator: typeof alice): Zone => ({
  kind: 'engaged',
  investigatorId: investigator,
});

/** Alice and bob in the study, with the enemy `code` in `zone`; still in setup. */
function inStudyWith(code: string, zone: Zone): GameState {
  const card: StartingCard = { id: enemy, code, zone };
  return startBoard(ctx, {
    maps: { main: { locations: { study: 'study' }, connections: [] } },
    investigators: [
      makeInvestigator({ id: 'alice', seat: 0, locationId: study }),
      makeInvestigator({ id: 'bob', seat: 1, locationId: study }),
    ],
    cards: [card],
  });
}

function answer(decision: string, optionId: string): Command {
  return { type: 'ResolveDecision', decisionId: decisionId(decision), optionId };
}

function wounds(state: GameState, investigator: typeof alice) {
  const { health, sanity } = investigatorOf(state, investigator);
  return { damage: health.damage, horror: sanity.horror };
}

const aliceFights: Command = { type: 'Fight', investigatorId: alice, enemyId: enemy };
const aliceEvades: Command = { type: 'Evade', investigatorId: alice, enemyId: enemy };
const fightTest = `fight:${alice}:${enemy}`;
const evadeTest = `evade:${alice}:${enemy}`;

/** The attack decision `kind` of the enemy on alice, at its printed 1 damage and 2 horror. */
function attackOnAlice(kind: 'retaliate' | 'alert', skipLabel: string) {
  return {
    id: decisionId(`${kind}:${enemy}`),
    kind: 'confirm',
    subject: enemy,
    prompt: `decision.${kind}`,
    decider: { kind: 'investigator', investigatorId: alice },
    options: [
      {
        id: 'attack',
        label: 'decision.attack',
        commands: [
          { type: 'DealEnemyAttack', enemyId: enemy, investigatorId: alice, damage: 1, horror: 2 },
        ],
        amounts: { damage: { default: 1, min: 0 }, horror: { default: 2, min: 0 } },
      },
      { id: 'skip', label: skipLabel, commands: [] },
    ],
  };
}

function exhausted(state: GameState, enemyId: InstanceId): GameState {
  return stateAfter(ctx, state, { type: 'ExhaustEnemy', enemyId });
}

describe('retaliate', () => {
  it('asks alice to resolve the attack of the ready retaliate enemy she failed to hit', () => {
    const state = inStudyWith('retaliate_ghoul', engagedWith(alice));

    const after = stateAfter(ctx, state, aliceFights, answer(fightTest, 'fail'));

    expect(after.pending).toEqual([attackOnAlice('retaliate', 'decision.attackCancelled')]);
  });

  it('deals the attack and leaves the enemy ready', () => {
    const state = inStudyWith('retaliate_ghoul', engagedWith(alice));

    const after = stateAfter(
      ctx,
      state,
      aliceFights,
      answer(fightTest, 'fail'),
      answer(`retaliate:${enemy}`, 'attack'),
    );

    expect(wounds(after, alice)).toEqual({ damage: 1, horror: 2 });
    expect(after.cards[enemy]?.exhausted).toBe(false);
  });

  it('deals nothing when the players cancel the attack', () => {
    const state = inStudyWith('retaliate_ghoul', engagedWith(alice));

    const after = stateAfter(
      ctx,
      state,
      aliceFights,
      answer(fightTest, 'fail'),
      answer(`retaliate:${enemy}`, 'skip'),
    );

    expect(wounds(after, alice)).toEqual({ damage: 0, horror: 0 });
  });

  it('first deals the failed attack to bob, who is engaged with the enemy, then attacks alice', () => {
    const state = inStudyWith('retaliate_ghoul', engagedWith(bob));

    const after = stateAfter(
      ctx,
      state,
      aliceFights,
      answer(fightTest, 'fail'),
      answer(`retaliate:${enemy}`, 'attack'),
    );

    expect(wounds(after, bob)).toEqual({ damage: 1, horror: 0 });
    expect(wounds(after, alice)).toEqual({ damage: 1, horror: 2 });
  });

  it.each([
    { name: 'a passed attack', code: 'retaliate_ghoul', exhaust: false, result: 'pass' },
    {
      name: 'an exhausted retaliate enemy',
      code: 'retaliate_ghoul',
      exhaust: true,
      result: 'fail',
    },
    { name: 'an enemy without retaliate', code: 'plain_ghoul', exhaust: false, result: 'fail' },
  ])('does not attack after $name', ({ code, exhaust, result }) => {
    const started = inStudyWith(code, engagedWith(alice));
    const state = exhaust ? exhausted(started, enemy) : started;

    const after = stateAfter(ctx, state, aliceFights, answer(fightTest, result));

    expect(after.pending).toEqual([]);
  });
});

describe('alert', () => {
  it('asks alice to resolve the attack of the alert enemy she failed to evade', () => {
    const state = inStudyWith('alert_ghoul', engagedWith(alice));

    const after = stateAfter(ctx, state, aliceEvades, answer(evadeTest, 'fail'));

    expect(after.pending).toEqual([attackOnAlice('alert', 'decision.attackCancelled')]);
  });

  it('deals the attack, and the enemy stays ready and engaged with alice', () => {
    const state = inStudyWith('alert_ghoul', engagedWith(alice));

    const after = stateAfter(
      ctx,
      state,
      aliceEvades,
      answer(evadeTest, 'fail'),
      answer(`alert:${enemy}`, 'attack'),
    );

    expect(wounds(after, alice)).toEqual({ damage: 1, horror: 2 });
    expect(after.cards[enemy]?.exhausted).toBe(false);
    expect(after.cards[enemy]?.zone).toEqual(engagedWith(alice));
  });

  it.each([
    { name: 'a passed evasion', code: 'alert_ghoul', exhaust: false, result: 'pass' },
    { name: 'an exhausted alert enemy', code: 'alert_ghoul', exhaust: true, result: 'fail' },
    { name: 'an enemy without alert', code: 'plain_ghoul', exhaust: false, result: 'fail' },
  ])('does not attack after $name', ({ code, exhaust, result }) => {
    const started = inStudyWith(code, engagedWith(alice));
    const state = exhaust ? exhausted(started, enemy) : started;

    const after = stateAfter(ctx, state, aliceEvades, answer(evadeTest, result));

    expect(after.pending).toEqual([]);
  });
});
