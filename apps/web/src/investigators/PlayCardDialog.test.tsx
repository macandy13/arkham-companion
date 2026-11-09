import { describe, expect, it } from 'vitest';
import { paysAfterTap } from './PlayCardDialog';

describe('paysAfterTap', () => {
  it.each([
    { pays: 0, token: 2, after: 3, why: 'pays up to and with the tapped token' },
    { pays: 3, token: 0, after: 1, why: 'pays fewer when an earlier token is tapped' },
    { pays: 3, token: 2, after: 2, why: 'takes back the last paid token' },
    { pays: 1, token: 0, after: 0, why: 'takes back the only paid token' },
    { pays: 2, token: 4, after: 5, why: 'pays more when a later token is tapped' },
  ])('$why: $pays paid, token $token tapped → $after', ({ pays, token, after }) => {
    expect(paysAfterTap(pays, token)).toBe(after);
  });
});
