import { describe, expect, it } from 'vitest';
import {
  apply,
  emptyState,
  instanceId,
  investigatorId,
  replay,
  type DrawEncounter,
  type Event,
  type MoveInvestigator,
  type QueuedStep,
} from './index';

describe('stored queue (GameMeta.queue)', () => {
  const alice = investigatorId('alice');
  const moveToCellar: QueuedStep = {
    kind: 'command',
    command: {
      type: 'MoveInvestigator',
      investigatorId: alice,
      to: instanceId('cellar'),
    } satisfies MoveInvestigator,
  };
  const surgeDraw: QueuedStep = {
    kind: 'command',
    command: { type: 'DrawEncounter', investigatorId: alice } satisfies DrawEncounter,
  };
  const moveQueued: Event = { type: 'StepsQueued', steps: [moveToCellar] };
  const surgeQueued: Event = { type: 'StepsQueued', steps: [surgeDraw] };

  it('puts newly queued steps in front of the ones already waiting', () => {
    const state = replay([moveQueued, surgeQueued], emptyState());

    expect(state.meta.queue).toEqual([surgeDraw, moveToCellar]);
  });

  it.each<{ name: string; taken: (step: QueuedStep) => Event }>([
    { name: 'resumed', taken: () => ({ type: 'StepResumed' }) },
    {
      name: 'dropped',
      taken: (step) => ({
        type: 'ActionDropped',
        command: step.command,
        reason: { code: 'investigatorNotActive', investigatorId: alice },
      }),
    },
  ])('takes the first step off the queue once it is $name', ({ taken }) => {
    const queued = replay([moveQueued, surgeQueued], emptyState());

    const afterSurge = apply(queued, taken(surgeDraw));
    const afterMove = apply(afterSurge, taken(moveToCellar));

    expect(afterSurge.meta.queue).toEqual([moveToCellar]);
    expect(afterMove.meta).not.toHaveProperty('queue');
  });
});
