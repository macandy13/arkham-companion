import type { PlayTable } from '@arkham/engine';
import { goalWeights } from './goal_bot';
import { isRare, offeredSteps, randomWeights, rareShareWeights } from './random_bot';
import type { BotKind, SeededRandom } from './run';
import type { Step } from './steps';
import { drawnTestAnswer } from './test_answers';

/**
 * The share of the chaos bot's picks that go to undo and corrections when the board offers any,
 * and the weight of resigning next to the rest: a quarter, so a game is taken back, adjusted and
 * left early again and again, yet still moves on.
 */
const CHAOS_SHARE = 1 / 4;

/** How each bot weighs the steps the board offers (`offeredSteps`). */
const WEIGHTS: Record<BotKind, (table: PlayTable, offered: readonly Step[]) => number[]> = {
  random: (_table, offered) => randomWeights(offered),
  goal: goalWeights,
  chaos: (table, offered) =>
    rareShareWeights(offered, isRare, CHAOS_SHARE).map((weight, i) =>
      resigns(table, offered[i]!) ? CHAOS_SHARE : weight,
    ),
};

/**
 * The next step `bot` plays on `table`. An open skill test of one investigator is answered first,
 * by chaos tokens the bot draws (`drawnTestAnswer`), like players who settle a test before
 * anything else; otherwise one of the steps the board offers, picked by the bot's weights.
 */
export function botStep(bot: BotKind, table: PlayTable, random: SeededRandom): Step {
  const drawn = drawnTestAnswer(table, random);
  if (drawn) return drawn;
  const offered = offeredSteps(table);
  return offered[random.pickWeighted(botWeights(bot, table, offered))]!;
}

/** How `bot` weighs each of the `offered` steps; a weight of 0 is never picked. */
export function botWeights(bot: BotKind, table: PlayTable, offered: readonly Step[]): number[] {
  return WEIGHTS[bot](table, offered);
}

/** Whether `step` is a card action that resigns (a location's "[action] Resign."). */
function resigns(table: PlayTable, step: Step): boolean {
  if (step.verb !== 'useCardAction') return false;
  const turn = table.board.turn;
  return (
    turn !== undefined &&
    table.board
      .cardActions(turn)
      .some(
        ({ cardId, action, designator }) =>
          cardId === step.card && action === step.action && designator === 'resign',
      )
  );
}
