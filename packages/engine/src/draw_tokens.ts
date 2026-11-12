import { withoutFirst, withoutKey } from '@arkham/util';
import type { ChaosToken } from './state';
import { revealsMore } from './skill_modifiers';

/**
 * Whether `revealed` ends the test: the last token revealed makes the tester reveal no other, or
 * it was a second frost (`revealsMore`).
 */
export function testFinished(revealed: readonly ChaosToken[]): boolean {
  return revealed.length > 0 && !revealsMore(revealed);
}

/**
 * Draws from `bag` as the players would: one token, then another while the last one says so,
 * without putting any back. A test still waiting for its next token goes on from `revealed`.
 * `random` gives a number in [0, 1) like `Math.random`: the app passes that, the play tester its
 * seeded random, and tests pick the tokens.
 */
export function drawTokens(
  bag: readonly ChaosToken[],
  revealed: readonly ChaosToken[],
  random: () => number,
): ChaosToken[] {
  let drawn = testFinished(revealed) ? [] : [...revealed];
  let left = without(bag, drawn);
  while (left.length > 0 && !testFinished(drawn)) {
    const [token, rest] = takeOne(left, random);
    drawn = [...drawn, token];
    left = rest;
  }
  return drawn;
}

/**
 * What a player card made of a drawn token (ME.24): it resolves as drawn, or a card cancelled its
 * effects (Wendy Adams' "cancel that token") or had the players ignore it (Olive McBride's tokens
 * not chosen). Only resolved tokens count for the test; the others stay out of the bag until it
 * ends.
 */
export type DrawnTokenState = 'resolved' | 'cancelled' | 'ignored';

/**
 * One token of a skill test's draw: the token out of the bag, its state, and the token it counts
 * as when a card says to treat it as another (Jim Culver: "treat a skull as an elder sign").
 */
export interface DrawnToken {
  readonly token: ChaosToken;
  readonly state: DrawnTokenState;
  readonly treatedAs?: ChaosToken;
}

/**
 * The tokens drawn for one skill test, in the order they came out. Not game state, like the draw
 * itself (`docs/architecture/decisions.md`): the skill test dialog keeps it until the players
 * answer, changing it with the functions below as their cards say.
 */
export type TestDraw = readonly DrawnToken[];

/** The tokens out of the bag for the draw, whatever their state: the ones the test returns. */
export function drawnTokens(draw: TestDraw): ChaosToken[] {
  return draw.map(({ token }) => token);
}

/** The tokens the test resolves: the resolved ones, each as the token it is treated as. */
export function resolvedTokens(draw: TestDraw): ChaosToken[] {
  return draw.flatMap(({ token, state, treatedAs }) =>
    state === 'resolved' ? [treatedAs ?? token] : [],
  );
}

/**
 * Whether the draw is done: a token is out, and the resolved ones make the tester reveal no other
 * (a cancelled bless no longer says to reveal another).
 */
export function drawFinished(draw: TestDraw): boolean {
  return draw.length > 0 && !revealsMore(resolvedTokens(draw));
}

/**
 * Draws for the test as the players would (`drawTokens`): on from `draw` while it is not finished,
 * or a fresh draw when it is.
 */
export function continueDraw(
  bag: readonly ChaosToken[],
  draw: TestDraw,
  random: () => number,
): TestDraw {
  return drawOn(bag, drawFinished(draw) ? [] : draw, random);
}

/**
 * One more token, as a card says ("reveal an additional chaos token", Olive McBride's three),
 * then more while it makes the tester reveal another. Nothing when the bag holds no other token.
 */
export function revealAnother(
  bag: readonly ChaosToken[],
  draw: TestDraw,
  random: () => number,
): TestDraw {
  const left = without(bag, drawnTokens(draw));
  if (left.length === 0) return draw;
  const [token] = takeOne(left, random);
  return drawOn(bag, [...draw, resolved(token)], random);
}

/** The draw with the token at `index` in `state`: cancelled, ignored, or resolved again. */
export function withTokenState(draw: TestDraw, index: number, state: DrawnTokenState): TestDraw {
  return draw.map((drawn, at) => (at === index ? { ...drawn, state } : drawn));
}

/** The draw with the token at `index` treated as `as`, or as itself again without one. */
export function treatTokenAs(draw: TestDraw, index: number, as?: ChaosToken): TestDraw {
  return draw.map((drawn, at) => {
    if (at !== index) return drawn;
    const rest = withoutKey(drawn, 'treatedAs');
    return as === undefined || as === drawn.token ? rest : { ...rest, treatedAs: as };
  });
}

/**
 * The token at `index` back into the bag and a new one drawn in its place, as a card says ("return
 * it to the chaos bag and reveal a new one", Lucky Dice), then more while it makes the tester
 * reveal another. The returned token can come out again.
 */
export function redrawToken(
  bag: readonly ChaosToken[],
  draw: TestDraw,
  index: number,
  random: () => number,
): TestDraw {
  const kept = draw.filter((_, at) => at !== index);
  const left = without(bag, drawnTokens(kept));
  if (left.length === 0) return kept;
  const [token] = takeOne(left, random);
  const replaced = [...kept.slice(0, index), resolved(token), ...kept.slice(index)];
  return drawOn(bag, replaced, random);
}

/** Draws on from `draw` while it is not finished and the bag holds tokens. */
function drawOn(bag: readonly ChaosToken[], draw: TestDraw, random: () => number): TestDraw {
  let drawn = draw;
  let left = without(bag, drawnTokens(drawn));
  while (left.length > 0 && !drawFinished(drawn)) {
    const [token, rest] = takeOne(left, random);
    drawn = [...drawn, resolved(token)];
    left = rest;
  }
  return drawn;
}

function resolved(token: ChaosToken): DrawnToken {
  return { token, state: 'resolved' };
}

/** One token picked from `left` by `random`, and the tokens left after it. */
function takeOne(left: readonly ChaosToken[], random: () => number): [ChaosToken, ChaosToken[]] {
  const index = Math.floor(random() * left.length);
  return [left[index] as ChaosToken, [...left.slice(0, index), ...left.slice(index + 1)]];
}

/** `bag` without one copy of each token in `out`. */
function without(bag: readonly ChaosToken[], out: readonly ChaosToken[]): ChaosToken[] {
  return out.reduce<ChaosToken[]>((left, token) => withoutFirst(left, token), [...bag]);
}
