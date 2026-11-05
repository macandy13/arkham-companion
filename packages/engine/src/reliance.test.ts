import { describe, expect, it } from 'vitest';
import type { NoticeKind } from './change_notices';
import { showsNotice, type Reliance } from './reliance';

describe('showsNotice', () => {
  it.each<[Reliance, NoticeKind, boolean]>([
    ['display', 'tokens', true],
    ['display', 'board', true],
    ['display', 'investigator', true],
    ['display', 'byHand', true],
    ['assist', 'tokens', false],
    ['assist', 'board', false],
    ['assist', 'investigator', true],
    ['assist', 'enemy', true],
    ['assist', 'encounter', true],
    ['assist', 'byHand', true],
    ['auto', 'investigator', false],
    ['auto', 'encounter', false],
    ['auto', 'byHand', true],
  ])('%s shows a %s notice: %s', (reliance, kind, shown) => {
    expect(showsNotice(reliance, kind)).toBe(shown);
  });
});
