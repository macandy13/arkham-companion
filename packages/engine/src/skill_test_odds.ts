import { withoutFirst } from '@arkham/util';
import type { EngineContext } from './cards';
import { tokenCounts } from './chaos_bag';
import {
  revealsMore,
  skillTestSuggestion,
  type SkillTestContext,
  type SkillTestInput,
} from './skill_modifiers';
import type { ChaosToken, GameState } from './state';

/**
 * How likely a skill test is to pass before its tokens are drawn (`skillTestOdds`), as chances
 * from 0 to 1 that add up to 1. `unknown` is the chance of a draw whose result the engine cannot
 * tell: one with a token whose value the players work out (the elder sign by the investigator's
 * ability, a symbol token whose effect says what to do instead of a number).
 */
export interface SkillTestOdds {
  pass: number;
  fail: number;
  unknown: number;
}

/**
 * The odds of `test` with what the players entered so far (`input`, without tokens) when they
 * draw from `bag`: every way the draw can go, one token and another while the last one says so
 * (bless, curse, frost, blood; not after a second frost), each weighed by its chance and valued as `skillTestSuggestion`
 * values the revealed tokens. An empty bag reveals nothing, so the test is decided by its values
 * alone. Pure, so the skill test dialog can ask again for every extra committed icon.
 */
export function skillTestOdds(
  ctx: EngineContext,
  state: GameState,
  test: SkillTestContext,
  bag: readonly ChaosToken[],
  input: Omit<SkillTestInput, 'tokens'> = {},
): SkillTestOdds {
  const outcome = (tokens: readonly ChaosToken[]): SkillTestOdds => {
    const suggestion = skillTestSuggestion(ctx, state, test, { ...input, tokens });
    if (suggestion.unknownTokens.length > 0) return { pass: 0, fail: 0, unknown: 1 };
    return suggestion.outcome === 'pass'
      ? { pass: 1, fail: 0, unknown: 0 }
      : { pass: 0, fail: 1, unknown: 0 };
  };
  // A draw's result depends on which tokens it revealed, not their order, so the draws that
  // revealed the same tokens before the next one share their odds; that keeps a bag full of
  // bless and curse tokens from branching into every order they could come out in.
  const known = new Map<string, SkillTestOdds>();
  const oddsAfter = (
    revealed: readonly ChaosToken[],
    left: readonly ChaosToken[],
  ): SkillTestOdds => {
    const key = [...revealed].sort().join(' ');
    const odds = known.get(key) ?? drawNext(revealed, left);
    known.set(key, odds);
    return odds;
  };
  const drawNext = (
    revealed: readonly ChaosToken[],
    left: readonly ChaosToken[],
  ): SkillTestOdds => {
    if (left.length === 0) return outcome(revealed);
    return tokenCounts(left).reduce<SkillTestOdds>(
      (sum, { token, count }) => {
        const drawn = [...revealed, token];
        const odds = revealsMore(drawn)
          ? oddsAfter(drawn, withoutFirst(left, token))
          : outcome(drawn);
        const chance = count / left.length;
        return {
          pass: sum.pass + chance * odds.pass,
          fail: sum.fail + chance * odds.fail,
          unknown: sum.unknown + chance * odds.unknown,
        };
      },
      { pass: 0, fail: 0, unknown: 0 },
    );
  };
  return oddsAfter([], bag);
}
