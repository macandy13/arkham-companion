import { describe, expect, it } from 'vitest';
import {
  blankEnemy,
  blankLocation,
  instanceId,
  investigatorId,
  newGame,
  victoryPoints,
} from './index';

const alice = investigatorId('alice');
const study = instanceId('study');
const victoryDisplay = { kind: 'victoryDisplay' } as const;

describe('victoryPoints', () => {
  const table = newGame()
    .withLocation(study, blankLocation('study'))
    .withInvestigator(alice, { locationId: study });

  it('adds up the victory of the cards in the victory display', () => {
    const { context, state } = table
      .withCard(
        instanceId('ghoul_priest'),
        blankEnemy('ghoul_priest', { victory: 2 }),
        victoryDisplay,
      )
      .withCard(
        instanceId('ghoul_minion'),
        blankEnemy('ghoul_minion', { victory: 1 }),
        victoryDisplay,
      )
      .start();

    expect(victoryPoints(context, state)).toBe(3);
  });

  it('counts a revealed location with victory and no clues left', () => {
    const { context, state } = table
      .withLocation(instanceId('parlor'), blankLocation('parlor', { victory: 1 }), {
        revealed: true,
        clues: 0,
      })
      .start();

    expect(victoryPoints(context, state)).toBe(1);
  });

  it.each([
    ['still has clues', { revealed: true, clues: 1 }],
    ['is unrevealed', { revealed: false, clues: 0 }],
  ])('leaves out a location with victory that %s', (_, options) => {
    const { context, state } = table
      .withLocation(instanceId('parlor'), blankLocation('parlor', { victory: 1 }), options)
      .start();

    expect(victoryPoints(context, state)).toBe(0);
  });
});
