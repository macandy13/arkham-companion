import { describe, expect, it } from 'vitest';
import type { ChaosToken } from '@arkham/engine';
import { drawTokens, testFinished } from './drawTokens';

/** A `random` that picks the bag's tokens in turn: the first left, then the first left again. */
const firstLeft = () => 0;

describe('testFinished', () => {
  it.each<{ revealed: ChaosToken[]; finished: boolean }>([
    { revealed: [], finished: false },
    { revealed: ['frost'], finished: false },
    { revealed: ['frost', 'autoFail'], finished: true },
    { revealed: ['elderSign'], finished: true },
  ])('$revealed finishes the test: $finished', ({ revealed, finished }) => {
    expect(testFinished(revealed)).toBe(finished);
  });
});

describe('drawTokens', () => {
  it.each<{ bag: ChaosToken[]; revealed: ChaosToken[]; drawn: ChaosToken[] }>([
    { bag: ['-1', 'bless'], revealed: [], drawn: ['-1'] },
    { bag: ['bless', 'curse', '-2'], revealed: [], drawn: ['bless', 'curse', '-2'] },
    // The bless on the table is not in the bag any more, so the next one is the −2.
    { bag: ['bless', '-2'], revealed: ['bless'], drawn: ['bless', '-2'] },
    { bag: ['-3', '+1'], revealed: ['+1'], drawn: ['-3'] },
    // A bag of only blesses runs out before the test ends.
    { bag: ['bless'], revealed: [], drawn: ['bless'] },
  ])('from $bag after $revealed draws $drawn', ({ bag, revealed, drawn }) => {
    expect(drawTokens(bag, revealed, firstLeft)).toEqual(drawn);
  });
});
