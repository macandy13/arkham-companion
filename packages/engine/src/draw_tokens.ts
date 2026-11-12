import { drawWithoutReplacement, withoutEach, withoutKey } from '@arkham/util';
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
  let left = withoutEach(bag, drawn);
  while (!testFinished(drawn)) {
    const [token, rest] = takeOne(left, random);
    if (token === undefined) break;
    drawn = [...drawn, token];
    left = rest;
  }
  return drawn;
}

/**
 * What a player card made of a drawn token (ME.24): it resolves as drawn, or a card cancelled it
 * (Counterspell) or had the players ignore it (Olive McBride's token not chosen, Lucky Dice). A
 * cancelled or ignored token counts as never revealed (Counterspell FAQ): no modifier, no effect,
 * no "reveal another"; it stays out of the bag until the test ends.
 */
export type DrawnTokenState = 'resolved' | 'cancelled' | 'ignored';

/**
 * One token of a skill test's draw: the token out of the bag, its state, the token it counts as
 * when a card says to treat it as another (Jim Culver: an elder sign as a skull), and whether it
 * was drawn only because the token before it said to reveal another (`chained`), so it goes back
 * into the bag when that one is cancelled, ignored or redrawn.
 */
export interface DrawnToken {
  readonly token: ChaosToken;
  readonly state: DrawnTokenState;
  readonly treatedAs?: ChaosToken;
  readonly chained?: true;
}

/**
 * The tokens drawn for one skill test, in the order they came out. Not game state, like the draw
 * itself (`docs/architecture/decisions.md`): the skill test dialog keeps it until the players
 * answer, changing it with the functions below as their cards say.
 */
export type TestDraw = readonly DrawnToken[];

/** The tokens out of the bag for the draw, whatever their state. */
export function drawnTokens(draw: TestDraw): ChaosToken[] {
  return draw.map(({ token }) => token);
}

/**
 * The tokens the test revealed, as they came out of the bag: the resolved ones, each as the token
 * it is, not as what it is treated as. A cancelled or ignored token counts as never revealed, so a
 * bless or curse among those goes back into the bag rather than to its pool.
 */
export function revealedTokens(draw: TestDraw): ChaosToken[] {
  return draw.flatMap(({ token, state }) => (state === 'resolved' ? [token] : []));
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
  const [token] = takeOne(withoutEach(bag, drawnTokens(draw)), random);
  return token === undefined ? draw : drawOn(bag, [...draw, resolved(token)], random);
}

/**
 * The draw with the token at `index` in `state`: cancelled, ignored, or resolved again. Cancelled
 * or ignored, the tokens it made the tester reveal go back into the bag, since they would never
 * have come out; resolved again, it asks for them anew (`continueDraw`).
 */
export function withTokenState(draw: TestDraw, index: number, state: DrawnTokenState): TestDraw {
  const changed = draw.map((drawn, at) => (at === index ? { ...drawn, state } : drawn));
  return state === 'resolved' ? changed : withoutFollowers(changed, index);
}

/** The draw with the token at `index` treated as `treatedAs`, or as itself again without one. */
export function treatTokenAs(draw: TestDraw, index: number, treatedAs?: ChaosToken): TestDraw {
  return draw.map((drawn, at) => {
    if (at !== index) return drawn;
    const rest = withoutKey(drawn, 'treatedAs');
    return treatedAs === undefined || treatedAs === drawn.token ? rest : { ...rest, treatedAs };
  });
}

/**
 * The token at `index` back into the bag, with the tokens it made the tester reveal, and a new one
 * drawn in its place, as a card says (Wendy Adams: "return it to the bag; reveal a new chaos
 * token"), then more while it makes the tester reveal another. The returned token can come out
 * again. Lucky Dice keeps its token out instead: `withTokenState` ignored, then `revealAnother`.
 */
export function redrawToken(
  bag: readonly ChaosToken[],
  draw: TestDraw,
  index: number,
  random: () => number,
): TestDraw {
  const old = draw[index];
  const kept = withoutFollowers(draw, index).filter((_, at) => at !== index);
  const [token] = takeOne(withoutEach(bag, drawnTokens(kept)), random);
  if (old === undefined || token === undefined) return kept;
  const replacement: DrawnToken = old.chained ? chained(token) : resolved(token);
  return drawOn(bag, [...kept.slice(0, index), replacement, ...kept.slice(index)], random);
}

/** Draws on from `draw` while it is not finished and the bag holds tokens. */
function drawOn(bag: readonly ChaosToken[], draw: TestDraw, random: () => number): TestDraw {
  let drawn = draw;
  let left = withoutEach(bag, drawnTokens(drawn));
  while (!drawFinished(drawn)) {
    const [token, rest] = takeOne(left, random);
    if (token === undefined) break;
    drawn = [...drawn, drawn.length === 0 ? resolved(token) : chained(token)];
    left = rest;
  }
  return drawn;
}

/** The draw without the tokens drawn because of the one at `index`: the chained run right after it. */
function withoutFollowers(draw: TestDraw, index: number): TestDraw {
  const after = draw.slice(index + 1);
  const followers = after.findIndex((drawn) => !drawn.chained);
  return [...draw.slice(0, index + 1), ...after.slice(followers === -1 ? after.length : followers)];
}

function resolved(token: ChaosToken): DrawnToken {
  return { token, state: 'resolved' };
}

function chained(token: ChaosToken): DrawnToken {
  return { token, state: 'resolved', chained: true };
}

/** One token picked from `left` by `random` (none from an empty bag), and the tokens left after it. */
function takeOne(
  left: readonly ChaosToken[],
  random: () => number,
): [ChaosToken | undefined, ChaosToken[]] {
  const { drawn, left: rest } = drawWithoutReplacement(left, 1, (count) =>
    Math.floor(random() * count),
  );
  return [drawn[0], rest];
}
