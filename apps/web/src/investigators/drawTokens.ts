import { revealsAnotherToken, type ChaosToken } from '@arkham/engine';

/**
 * The tokens a skill test has revealed once one more is revealed: `token` joins `revealed` while
 * the last one there makes the tester reveal another (bless, curse, frost, blood); otherwise it
 * starts a new test of its own.
 */
export function revealToken(revealed: readonly ChaosToken[], token: ChaosToken): ChaosToken[] {
  return testFinished(revealed) || revealed.length === 0 ? [token] : [...revealed, token];
}

/** Whether `revealed` ends the test: the last token revealed makes the tester reveal no other. */
export function testFinished(revealed: readonly ChaosToken[]): boolean {
  const last = revealed.at(-1);
  return last !== undefined && !revealsAnotherToken(last);
}

/**
 * Draws from `bag` as the players would: one token, then another while the last one says so,
 * without putting any back. A test still waiting for its next token goes on from `revealed`.
 * `random` gives a number in [0, 1) like `Math.random`, so tests can pick the tokens.
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
