import { describe, expect, it } from 'vitest';
import { instanceId } from './index';
import { requireCard } from './lookup';
import type { CardInstance } from './state';
import { rejectionOf } from '../test/utils';

describe('requireCard', () => {
  const known = instanceId('known');
  const card: CardInstance = {
    id: known,
    code: 'L1',
    zone: { kind: 'outOfGame' },
    faceUp: true,
    exhausted: false,
    flags: {},
    tokens: {},
  };

  it('returns the card with that id', () => {
    expect(requireCard({ [known]: card }, known)).toBe(card);
  });

  it('rejects an id that names no card', () => {
    const missing = instanceId('missing');

    expect(rejectionOf(() => requireCard({ [known]: card }, missing))).toEqual({
      code: 'unknownCard',
      cardId: missing,
    });
  });
});
