import { describe, expect, it } from 'vitest';
import {
  blankEnemy,
  blankLocation,
  decisionId,
  engagedWith,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  type CardStats,
  type Command,
  type EngineContext,
  type GameState,
  type InstanceId,
  type Zone,
} from './index';
import { investigatorOf, stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const study = instanceId('study');
const enemy = instanceId('enemy');

/**
 * Three enemies that each deal 1 damage and 2 horror: a retaliate ghoul (3
 * health, so a hit for 1 does not defeat it), an alert ghoul and a plain
 * ghoul without either keyword.
 */
const retaliateGhoul = blankEnemy({
  code: 'retaliate_ghoul',
  fight: 4,
  health: fixed(3),
  damage: 1,
  horror: 2,
  keywords: [{ name: 'retaliate' }],
});
const alertGhoul = blankEnemy({
  code: 'alert_ghoul',
  evade: 4,
  damage: 1,
  horror: 2,
  keywords: [{ name: 'alert' }],
});
const plainGhoul = blankEnemy({ code: 'plain_ghoul', fight: 4, evade: 4, damage: 1, horror: 2 });

const aliceAndBobInStudy = newGame()
  .withLocation(study, blankLocation({ code: 'study' }))
  .withInvestigator(alice, { locationId: study })
  .withInvestigator(bob, { locationId: study });

/** Alice and bob in the study, with `card` as the enemy in `zone`; still in setup. */
function inStudyWith(card: CardStats, zone: Zone) {
  return aliceAndBobInStudy.withCard(enemy, card, zone).start();
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

function exhausted(context: EngineContext, state: GameState, enemyId: InstanceId): GameState {
  return stateAfter(context, state, { type: 'ExhaustEnemy', enemyId });
}

describe('retaliate', () => {
  it('asks alice to resolve the attack of the ready retaliate enemy she failed to hit', () => {
    const { context, state } = inStudyWith(retaliateGhoul, engagedWith(alice));

    const after = stateAfter(context, state, aliceFights, answer(fightTest, 'fail'));

    expect(after.pending).toEqual([attackOnAlice('retaliate', 'decision.attackCancelled')]);
  });

  it('deals the attack and leaves the enemy ready', () => {
    const { context, state } = inStudyWith(retaliateGhoul, engagedWith(alice));

    const after = stateAfter(
      context,
      state,
      aliceFights,
      answer(fightTest, 'fail'),
      answer(`retaliate:${enemy}`, 'attack'),
    );

    expect(wounds(after, alice)).toEqual({ damage: 1, horror: 2 });
    expect(after.cards[enemy]?.exhausted).toBe(false);
  });

  it('deals nothing when the players cancel the attack', () => {
    const { context, state } = inStudyWith(retaliateGhoul, engagedWith(alice));

    const after = stateAfter(
      context,
      state,
      aliceFights,
      answer(fightTest, 'fail'),
      answer(`retaliate:${enemy}`, 'skip'),
    );

    expect(wounds(after, alice)).toEqual({ damage: 0, horror: 0 });
  });

  it('first deals the failed attack to bob, who is engaged with the enemy, then attacks alice', () => {
    const { context, state } = inStudyWith(retaliateGhoul, engagedWith(bob));

    const after = stateAfter(
      context,
      state,
      aliceFights,
      answer(fightTest, 'fail'),
      answer(`retaliate:${enemy}`, 'attack'),
    );

    expect(wounds(after, bob)).toEqual({ damage: 1, horror: 0 });
    expect(wounds(after, alice)).toEqual({ damage: 1, horror: 2 });
  });

  it.each([
    { name: 'a passed attack', card: retaliateGhoul, exhaust: false, result: 'pass' },
    {
      name: 'an exhausted retaliate enemy',
      card: retaliateGhoul,
      exhaust: true,
      result: 'fail',
    },
    { name: 'an enemy without retaliate', card: plainGhoul, exhaust: false, result: 'fail' },
  ])('does not attack after $name', ({ card, exhaust, result }) => {
    const { context, state: started } = inStudyWith(card, engagedWith(alice));
    const state = exhaust ? exhausted(context, started, enemy) : started;

    const after = stateAfter(context, state, aliceFights, answer(fightTest, result));

    expect(after.pending).toEqual([]);
  });
});

describe('alert', () => {
  it('asks alice to resolve the attack of the alert enemy she failed to evade', () => {
    const { context, state } = inStudyWith(alertGhoul, engagedWith(alice));

    const after = stateAfter(context, state, aliceEvades, answer(evadeTest, 'fail'));

    expect(after.pending).toEqual([attackOnAlice('alert', 'decision.attackCancelled')]);
  });

  it('deals the attack, and the enemy stays ready and engaged with alice', () => {
    const { context, state } = inStudyWith(alertGhoul, engagedWith(alice));

    const after = stateAfter(
      context,
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
    { name: 'a passed evasion', card: alertGhoul, exhaust: false, result: 'pass' },
    { name: 'an exhausted alert enemy', card: alertGhoul, exhaust: true, result: 'fail' },
    { name: 'an enemy without alert', card: plainGhoul, exhaust: false, result: 'fail' },
  ])('does not attack after $name', ({ card, exhaust, result }) => {
    const { context, state: started } = inStudyWith(card, engagedWith(alice));
    const state = exhaust ? exhausted(context, started, enemy) : started;

    const after = stateAfter(context, state, aliceEvades, answer(evadeTest, result));

    expect(after.pending).toEqual([]);
  });
});
