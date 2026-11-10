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
  const left = [...bag];
  for (const token of drawn) {
    const index = left.indexOf(token);
    if (index >= 0) left.splice(index, 1);
  }
  while (left.length > 0 && !testFinished(drawn)) {
    drawn = [...drawn, ...left.splice(Math.floor(random() * left.length), 1)];
  }
  return drawn;
}
