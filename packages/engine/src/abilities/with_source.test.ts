import { describe, expect, it } from 'vitest';
import { decisionId, instanceId, investigatorId, placeDoomOn, takeHorror } from '..';
import type { Command } from '../commands';
import { withSource } from './dsl';

describe('withSource', () => {
  const hall = instanceId('hall');
  const alice = investigatorId('alice');
  const fromHall = { cardId: hall, window: 'action' } as const;

  it('stamps the card on any command, not only those the players also send', () => {
    expect(withSource(placeDoomOn(hall, 1), fromHall)).toMatchObject({ source: fromHall });
  });

  it('stamps the card on a choice and on each command of its options', () => {
    const choice: Command = {
      type: 'RequestDecision',
      decision: {
        id: decisionId('hall.choice'),
        kind: 'chooseOption',
        prompt: 'choose',
        decider: { kind: 'investigator', investigatorId: alice },
        options: [{ id: 'horror', label: 'horror', commands: [takeHorror(1, alice)] }],
      },
    };

    expect(withSource(choice, fromHall)).toMatchObject({
      source: fromHall,
      decision: { options: [{ commands: [{ type: 'TakeDamageAndHorror', source: fromHall }] }] },
    });
  });
});
