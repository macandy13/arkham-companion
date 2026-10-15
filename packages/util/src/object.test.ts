import { describe, expect, it } from 'vitest';
import { withoutKey } from './index';

describe('withoutKey', () => {
  it('removes the key from the copy', () => {
    const turn = { investigatorId: 'roland', actionsTaken: 2 };

    expect(withoutKey(turn, 'actionsTaken')).toStrictEqual({ investigatorId: 'roland' });
  });

  it('leaves the original untouched', () => {
    const turn = { investigatorId: 'roland', actionsTaken: 2 };

    withoutKey(turn, 'actionsTaken');

    expect(turn).toStrictEqual({ investigatorId: 'roland', actionsTaken: 2 });
  });

  it('copies an object that lacks the optional key', () => {
    const meta: { round: number; turn?: string } = { round: 1 };

    expect(withoutKey(meta, 'turn')).toStrictEqual({ round: 1 });
  });
});
