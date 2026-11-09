import { describe, expect, it } from 'vitest';
import {
  blankAct,
  blankEnemy,
  blankLocation,
  inVictoryDisplay,
  instanceId,
  investigatorId,
  newGame,
  trait,
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

describe('inVictoryDisplay', () => {
  const elite = trait('Elite');
  const act = instanceId('act');
  const eliteSuspect = blankEnemy('elite_suspect', { traits: [elite] });
  /** Alice in the study; one Elite suspect is in the victory display. */
  const table = newGame()
    .withAct(act, blankAct('act'))
    .withLocation(study, blankLocation('study'))
    .withInvestigator(alice, { locationId: study })
    .withCard(instanceId('defeated_suspect'), eliteSuspect, victoryDisplay);

  it.each([
    { beneathAct: 'a face-up suspect', faceUp: true, count: 2 },
    { beneathAct: 'a facedown suspect', faceUp: false, count: 1 },
  ])('counts $count Elite cards with $beneathAct beneath the act', ({ faceUp, count }) => {
    const { context, state } = table
      .withCard(
        instanceId('questioned_suspect'),
        eliteSuspect,
        { kind: 'beneath', hostId: act },
        {
          faceUp,
        },
      )
      .start();

    expect(inVictoryDisplay(context, state, { trait: elite, beneathAct: true })).toHaveLength(
      count,
    );
  });
});
