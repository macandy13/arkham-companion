import { describe, expect, it } from 'vitest';
import {
  apply,
  emptyState,
  instanceId,
  investigatorId,
  replay,
  type Event,
  type QueuedStep,
} from './index';

describe('stored queue (GameMeta.queue)', () => {
  const alice = investigatorId('alice');
  const moveToCellar: QueuedStep = {
    kind: 'action',
    command: { type: 'MoveInvestigator', investigatorId: alice, to: instanceId('cellar') },
  };
  const surgeDraw: QueuedStep = {
    kind: 'surge',
    draw: { type: 'DrawEncounter', investigatorId: alice },
  };
  const moveQueued: Event = { type: 'StepsQueued', steps: [moveToCellar] };
  const surgeQueued: Event = { type: 'StepsQueued', steps: [surgeDraw] };

  it('puts newly queued steps in front of the ones already waiting', () => {
    const state = replay([moveQueued, surgeQueued], emptyState());

    expect(state.meta.queue).toEqual([surgeDraw, moveToCellar]);
  });

  it('takes the first step off the queue once it resumes, and the queue once it is empty', () => {
    const queued = replay([moveQueued, surgeQueued], emptyState());

    const afterSurge = apply(queued, { type: 'StepResumed' });
    const afterMove = apply(afterSurge, { type: 'StepResumed' });

    expect(afterSurge.meta.queue).toEqual([moveToCellar]);
    expect(afterMove.meta).not.toHaveProperty('queue');
  });

  it('takes a dropped held action off the queue', () => {
    const queued = replay([moveQueued], emptyState());

    const dropped = apply(queued, {
      type: 'ActionDropped',
      command: moveToCellar.command,
      reason: { code: 'investigatorNotActive', investigatorId: alice },
    });

    expect(dropped.meta).not.toHaveProperty('queue');
  });
});
