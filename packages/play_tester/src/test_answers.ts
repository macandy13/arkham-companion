import {
  drawTokens,
  suggestSkillTest,
  type Decision,
  type PlayTable,
  type SkillTestResult,
} from '@arkham/engine';
import type { SeededRandom } from './run';
import type { Step } from './steps';

/**
 * The most a token the engine cannot value (the elder sign, a symbol without a number) adds or
 * takes away; the bot picks a modifier in this range for it, as the players would read their card.
 */
const UNKNOWN_TOKEN_RANGE = 2;

/**
 * Whether the bot answers `decision` by drawing a chaos token: a skill test of one investigator,
 * whose skill the engine knows (`suggestSkillTest`), with tokens in the bag, and the only open test
 * of that investigator, since `resolveTest` names the test by who takes it. Any other test (one
 * decided by the lead or the group, a second one of the same investigator) is answered like any
 * other decision.
 */
export function answersByDraw(table: PlayTable, decision: Decision): boolean {
  const { decider } = decision;
  return (
    decider.kind === 'investigator' &&
    table.state.chaosBag.length > 0 &&
    suggestSkillTest(table.ctx, table.state, decision) !== undefined &&
    table.state.pending.filter(
      (pending) =>
        pending.kind === 'skillTestResult' &&
        pending.decider.kind === 'investigator' &&
        pending.decider.investigatorId === decider.investigatorId,
    ).length === 1
  );
}

/**
 * The answer to the first open skill test the bot answers by drawing (`answersByDraw`): tokens
 * drawn from the scenario's chaos bag as the players draw them (`drawTokens`: another while the
 * last says so), valued by `suggestSkillTest`, a random modifier for tokens it cannot value, and
 * the pass or fail (with the margin) that follows. None while no such test is open.
 */
export function drawnTestAnswer(table: PlayTable, random: SeededRandom): Step | undefined {
  const decision = table.state.pending.find((pending) => answersByDraw(table, pending));
  if (!decision || decision.decider.kind !== 'investigator') return undefined;
  const tokens = drawTokens(table.board.chaosBag, [], () => random.fraction());
  const valued = suggestSkillTest(table.ctx, table.state, decision, { tokens });
  const suggestion =
    valued && valued.unknownTokens.length > 0
      ? suggestSkillTest(table.ctx, table.state, decision, {
          tokens,
          modifier: random.below(2 * UNKNOWN_TOKEN_RANGE + 1) - UNKNOWN_TOKEN_RANGE,
        })
      : valued;
  if (!suggestion) return undefined;
  const result: SkillTestResult =
    suggestion.outcome === 'pass' ? 'pass' : { failedBy: suggestion.margin };
  const { name } = table.board.investigator(decision.decider.investigatorId);
  return { verb: 'resolveTest', investigator: name, tokens, result };
}
