import { describe, expect, it } from 'vitest';
import { withoutEach } from '@arkham/util';
import type { ChaosToken } from './state';
import {
  continueDraw,
  drawFinished,
  drawnTokens,
  drawTokens,
  redrawToken,
  replaceToken,
  resolvedTokens,
  revealAnother,
  revealedTokens,
  testFinished,
  treatTokenAs,
  withTokenState,
  type TestDraw,
} from './draw_tokens';

/** A `random` that picks the bag's tokens in turn: the first left, then the first left again. */
const firstLeft = () => 0;

describe('testFinished', () => {
  it.each<{ revealed: ChaosToken[]; finished: boolean }>([
    { revealed: [], finished: false },
    { revealed: ['frost'], finished: false },
    { revealed: ['frost', 'autoFail'], finished: true },
    { revealed: ['elderSign'], finished: true },
    // A second frost ends the reveals at once, though frost says to reveal another.
    { revealed: ['frost', 'bless', 'frost'], finished: true },
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
    // The second frost fails the test and ends the draw before the 0.
    { bag: ['frost', 'frost', '0'], revealed: [], drawn: ['frost', 'frost'] },
    // A bag of only blesses runs out before the test ends.
    { bag: ['bless'], revealed: [], drawn: ['bless'] },
  ])('from $bag after $revealed draws $drawn', ({ bag, revealed, drawn }) => {
    expect(drawTokens(bag, revealed, firstLeft)).toEqual(drawn);
  });
});

describe('a test draw', () => {
  const minusTwo: TestDraw = [{ token: '-2', state: 'resolved' }];
  /** A bless and the −1 it made the tester reveal. */
  const blessThenMinusOne: TestDraw = [
    { token: 'bless', state: 'resolved' },
    { token: '-1', state: 'resolved', chained: true },
  ];

  it.each<{ name: string; draw: TestDraw; resolved: ChaosToken[]; finished: boolean }>([
    { name: 'no token yet', draw: [], resolved: [], finished: false },
    { name: 'a −2', draw: minusTwo, resolved: ['-2'], finished: true },
    {
      name: 'a cancelled −2, which leaves nothing to resolve',
      draw: [{ token: '-2', state: 'cancelled' }],
      resolved: [],
      finished: true,
    },
    {
      name: 'a bless still waiting for its next token',
      draw: [{ token: 'bless', state: 'resolved' }],
      resolved: ['bless'],
      finished: false,
    },
    {
      name: 'an ignored bless, which no longer reveals another',
      draw: [{ token: 'bless', state: 'ignored' }],
      resolved: [],
      finished: true,
    },
    {
      name: 'an elder sign treated as a skull',
      draw: [{ token: 'elderSign', state: 'resolved', treatedAs: 'skull' }],
      resolved: ['skull'],
      finished: true,
    },
  ])('resolves $resolved from $name', ({ draw, resolved, finished }) => {
    expect([resolvedTokens(draw), drawFinished(draw)]).toEqual([resolved, finished]);
  });

  it('lists every drawn token, and as revealed only the resolved ones as they came out', () => {
    const draw: TestDraw = [
      { token: 'bless', state: 'cancelled' },
      { token: 'elderSign', state: 'resolved', treatedAs: 'skull' },
    ];

    expect(drawnTokens(draw)).toEqual(['bless', 'elderSign']);
    expect(revealedTokens(draw)).toEqual(['elderSign']);
  });

  it.each<{ name: string; bag: ChaosToken[]; draw: TestDraw; after: ChaosToken[] }>([
    { name: 'draws one token', bag: ['-1', '0'], draw: [], after: ['-1'] },
    {
      name: 'draws on after a bless',
      bag: ['bless', '-1'],
      draw: [{ token: 'bless', state: 'resolved' }],
      after: ['bless', '-1'],
    },
    { name: 'starts again once the draw is done', bag: ['-2', '0'], draw: minusTwo, after: ['-2'] },
  ])('continueDraw $name', ({ bag, draw, after }) => {
    expect(drawnTokens(continueDraw(bag, draw, firstLeft))).toEqual(after);
  });

  it.each<{ name: string; bag: ChaosToken[]; after: ChaosToken[] }>([
    { name: 'reveals one more token', bag: ['-2', '0', '+1'], after: ['-2', '0'] },
    {
      name: 'goes on while the new one is a curse',
      bag: ['-2', 'curse', '+1'],
      after: ['-2', 'curse', '+1'],
    },
    { name: 'reveals none from a bag with no other token', bag: ['-2'], after: ['-2'] },
  ])('revealAnother $name', ({ bag, after }) => {
    expect(drawnTokens(revealAnother(bag, minusTwo, firstLeft))).toEqual(after);
  });

  it('puts back the −1 a cancelled bless made the tester reveal', () => {
    const cancelled = withTokenState(blessThenMinusOne, 0, 'cancelled');

    expect(cancelled).toEqual([{ token: 'bless', state: 'cancelled' }]);
    expect(drawFinished(cancelled)).toBe(true);
  });

  it('asks for another token once the cancelled bless resolves again', () => {
    const resolvedAgain = withTokenState([{ token: 'bless', state: 'cancelled' }], 0, 'resolved');

    expect([resolvedTokens(resolvedAgain), drawFinished(resolvedAgain)]).toEqual([
      ['bless'],
      false,
    ]);
  });

  it('ignores the −1 alone, keeping the bless', () => {
    const ignored = withTokenState(blessThenMinusOne, 1, 'ignored');

    expect(resolvedTokens(ignored)).toEqual(['bless']);
  });

  it('treats a token as another and back as itself', () => {
    const asElderSign = treatTokenAs(minusTwo, 0, 'elderSign');

    expect(asElderSign).toEqual([{ token: '-2', state: 'resolved', treatedAs: 'elderSign' }]);
    expect(treatTokenAs(asElderSign, 0)).toEqual(minusTwo);
  });

  it.each<{
    name: string;
    bag: ChaosToken[];
    draw: TestDraw;
    redrawn: ChaosToken;
    after: ChaosToken[];
  }>([
    {
      name: 'puts the token back and draws one in its place',
      bag: ['0', '-2'],
      draw: minusTwo,
      redrawn: '-2',
      after: ['0'],
    },
    {
      name: 'draws on when the new token is a bless',
      bag: ['bless', '-2', '+1'],
      draw: minusTwo,
      redrawn: '-2',
      after: ['bless', '-2'],
    },
    {
      name: 'puts back the −1 the redrawn bless made the tester reveal',
      bag: ['0', 'bless', '-1'],
      draw: blessThenMinusOne,
      redrawn: 'bless',
      after: ['0'],
    },
    {
      name: 'keeps the tokens before it in their place',
      bag: ['bless', '0', '-1'],
      draw: blessThenMinusOne,
      redrawn: '-1',
      after: ['bless', '0'],
    },
    {
      name: 'can draw the same token again',
      bag: ['-2'],
      draw: minusTwo,
      redrawn: '-2',
      after: ['-2'],
    },
  ])('redrawToken $name', ({ bag, draw, redrawn, after }) => {
    const index = draw.findIndex(({ token }) => token === redrawn);

    expect(drawnTokens(redrawToken(bag, draw, index, firstLeft))).toEqual(after);
  });

  it.each<{
    name: string;
    bag: ChaosToken[];
    draw: TestDraw;
    replaced: ChaosToken;
    by: ChaosToken;
    after: ChaosToken[];
    left: ChaosToken[];
  }>([
    {
      name: 'swaps the −2 for the +1, so the −2 is the one left in the bag',
      bag: ['-2', '+1'],
      draw: minusTwo,
      replaced: '-2',
      by: '+1',
      after: ['+1'],
      left: ['-2'],
    },
    {
      name: 'draws on when the new token is a bless',
      bag: ['-2', 'bless', '0'],
      draw: minusTwo,
      replaced: '-2',
      by: 'bless',
      after: ['bless', '-2'],
      left: ['0'],
    },
    {
      name: 'puts back the −1 the replaced bless made the tester reveal',
      bag: ['bless', '-1', '0'],
      draw: blessThenMinusOne,
      replaced: 'bless',
      by: '0',
      after: ['0'],
      left: ['bless', '-1'],
    },
    {
      name: 'keeps the draw when the bag holds no token of that kind',
      bag: ['-2'],
      draw: minusTwo,
      replaced: '-2',
      by: '+1',
      after: ['-2'],
      left: [],
    },
  ])('replaceToken $name', ({ bag, draw, replaced, by, after, left }) => {
    const index = draw.findIndex(({ token }) => token === replaced);

    const replacedDraw = replaceToken(bag, draw, index, by, firstLeft);

    expect(drawnTokens(replacedDraw)).toEqual(after);
    expect(withoutEach(bag, drawnTokens(replacedDraw))).toEqual(left);
  });
});
