import { assertNever } from '@arkham/util';
import {
  continueDraw,
  drawFinished,
  redrawToken,
  treatTokenAs,
  withTokenState,
  type ChaosToken,
  type TestDraw,
} from '@arkham/engine';

/**
 * What the players do to one drawn token as a card says (ME.24b): ignore it (a cancel counts the
 * same: as never revealed), resolve it again, put it back and draw another in its place, or treat
 * it as another kind (`as` left out treats it as itself again).
 */
export type DrawnTokenAction =
  { kind: 'ignore' | 'resolve' | 'redraw' } | { kind: 'treatAs'; as?: ChaosToken };

/**
 * `draw` after `action` on its token at `index`, drawing from `bag` with `random`. A token resolved
 * again, or treated as another kind, reveals the tokens its kind asks for anew (a bless, curse or
 * frost "makes the tester reveal another"), so the tokens it brought out before go back first.
 */
export function applyTokenAction(
  draw: TestDraw,
  index: number,
  action: DrawnTokenAction,
  bag: readonly ChaosToken[],
  random: () => number,
): TestDraw {
  const drawOnWhileUnfinished = (changed: TestDraw) =>
    drawFinished(changed) ? changed : continueDraw(bag, changed, random);
  switch (action.kind) {
    case 'ignore':
      return withTokenState(draw, index, 'ignored');
    case 'resolve':
      return drawOnWhileUnfinished(withTokenState(draw, index, 'resolved'));
    case 'redraw':
      return redrawToken(bag, draw, index, random);
    case 'treatAs': {
      const treated = treatTokenAs(draw, index, action.as);
      if (treated[index]?.state !== 'resolved') return treated;
      const withoutFollowers = withTokenState(treated, index, 'ignored');
      return drawOnWhileUnfinished(withTokenState(withoutFollowers, index, 'resolved'));
    }
    default:
      return assertNever(action);
  }
}
