import { describe, expect, it } from 'vitest';
import {
  instanceId,
  investigatorId,
  lastingEffectId,
  type Command,
  type GameState,
  type LastingEffect,
} from './index';
import {
  contextWith,
  makeCard,
  makeInvestigator,
  rejectionFrom,
  startBoard,
  stateAfter,
} from '../test/utils';

const alice = investigatorId('alice');
const study = instanceId('study');
const ctx = contextWith(makeCard({ code: 'study', typeCode: 'location', shroud: 2 }));

/** Alice alone in the study, in setup. */
function aliceInStudy(): GameState {
  return startBoard(ctx, {
    maps: { house: { locations: { study: 'study' } } },
    investigators: [makeInvestigator({ id: 'alice', locationId: study })],
  });
}

/** "Your skills get +1 until the end of the round", from a card. */
const steadyNerves: LastingEffect = {
  id: lastingEffectId('steady_nerves'),
  label: 'Steady Nerves',
  until: 'endOfRound',
  appliesTo: { investigatorId: alice },
  modifier: { target: 'skill', amount: 1 },
};
const addSteadyNerves: Command = { type: 'AddLastingEffect', effect: steadyNerves };

describe('AddLastingEffect', () => {
  it('puts the effect into play', () => {
    const state = stateAfter(ctx, aliceInStudy(), addSteadyNerves);

    expect(state.lastingEffects).toEqual([steadyNerves]);
  });

  it('rejects an id that is already in effect', () => {
    const state = stateAfter(ctx, aliceInStudy(), addSteadyNerves);

    expect(rejectionFrom(ctx, state, addSteadyNerves)).toEqual({
      code: 'duplicateLastingEffect',
      effectId: 'steady_nerves',
    });
  });

  it.each([0, 0.5])('rejects a modifier of %s', (amount) => {
    const effect: LastingEffect = { ...steadyNerves, modifier: { target: 'skill', amount } };

    expect(rejectionFrom(ctx, aliceInStudy(), { type: 'AddLastingEffect', effect })).toEqual({
      code: 'invalidModifierAmount',
      amount,
    });
  });
});

describe('EndLastingEffect', () => {
  it('ends an effect before the round does', () => {
    const state = stateAfter(ctx, aliceInStudy(), addSteadyNerves, {
      type: 'EndLastingEffect',
      effectId: steadyNerves.id,
    });

    expect(state.lastingEffects).toEqual([]);
  });

  it('rejects an effect that is not in effect', () => {
    expect(
      rejectionFrom(ctx, aliceInStudy(), {
        type: 'EndLastingEffect',
        effectId: steadyNerves.id,
      }),
    ).toEqual({ code: 'unknownLastingEffect', effectId: 'steady_nerves' });
  });
});

describe('expiry at the end of the round', () => {
  /** Round 1 from setup to the enemy phase: investigation with Alice's (empty) turn, then the enemy phase. */
  const toEnemyPhase: Command[] = [
    { type: 'NextPhase' },
    { type: 'StartTurn', investigatorId: alice },
    { type: 'EndTurn', investigatorId: alice },
    { type: 'NextPhase' },
  ];

  it('keeps an end-of-round effect through the enemy phase', () => {
    const state = stateAfter(ctx, aliceInStudy(), addSteadyNerves, ...toEnemyPhase);

    expect(state.meta.phase).toBe('enemy');
    expect(state.lastingEffects).toEqual([steadyNerves]);
  });

  it('ends it in upkeep step 4.6, when the round ends', () => {
    const state = stateAfter(ctx, aliceInStudy(), addSteadyNerves, ...toEnemyPhase, {
      type: 'NextPhase',
    });

    expect(state.meta.phase).toBe('upkeep');
    expect(state.meta.steps).toEqual([]);
    expect(state.lastingEffects).toEqual([]);
  });
});
