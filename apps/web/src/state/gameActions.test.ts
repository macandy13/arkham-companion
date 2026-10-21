import { describe, expect, it } from 'vitest';
import { investigatorId } from '@arkham/engine';
import { cluesInSeatOrder } from './gameActions';

describe('cluesInSeatOrder', () => {
  const roland = investigatorId('roland');
  const daisy = investigatorId('daisy');

  it.each([
    {
      held: 'roland 2, daisy 3',
      investigators: [
        { id: roland, clues: 2 },
        { id: daisy, clues: 3 },
      ],
      needed: 4,
      spend: [
        { investigator: roland, clues: 2 },
        { investigator: daisy, clues: 2 },
      ],
    },
    {
      held: 'roland 5, daisy 3',
      investigators: [
        { id: roland, clues: 5 },
        { id: daisy, clues: 3 },
      ],
      needed: 4,
      spend: [{ investigator: roland, clues: 4 }],
    },
    {
      held: 'roland 0, daisy 3',
      investigators: [
        { id: roland, clues: 0 },
        { id: daisy, clues: 3 },
      ],
      needed: 3,
      spend: [{ investigator: daisy, clues: 3 }],
    },
  ])('pays $needed from $held in seat order', ({ investigators, needed, spend }) => {
    expect(cluesInSeatOrder(investigators, needed)).toEqual(spend);
  });
});
