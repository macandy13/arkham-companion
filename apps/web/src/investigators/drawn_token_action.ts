import { assertNever } from '@arkham/util';
import {
  continueDraw,
  drawFinished,
  redrawToken,
  replaceToken,
  withTokenState,
  type ChaosToken,
  type TestDraw,
} from '@arkham/engine';

/**
 * What the players do to one drawn token as a card says (ME.24b): ignore it (a cancel counts the
 * same: as never revealed), resolve it again, put it back and draw another in its place, or swap it
 * for a token of another kind from the bag (`replaceToken`).
 */
export type DrawnTokenAction =
  { kind: 'ignore' | 'resolve' | 'redraw' } | { kind: 'replace'; token: ChaosToken };

/**
 * `draw` after `action` on its token at `index`, drawing from `bag` with `random`. A token resolved
 * again reveals the tokens its kind asks for anew (a bless, curse or frost "makes the tester reveal
 * another").
 */
export function applyTokenAction(
  draw: TestDraw,
  index: number,
  action: DrawnTokenAction,
  bag: readonly ChaosToken[],
  random: () => number,
): TestDraw {
  switch (action.kind) {
    case 'ignore':
      return withTokenState(draw, index, 'ignored');
    case 'resolve': {
      const resolved = withTokenState(draw, index, 'resolved');
      return drawFinished(resolved) ? resolved : continueDraw(bag, resolved, random);
    }
    case 'redraw':
      return redrawToken(bag, draw, index, random);
    case 'replace':
      return replaceToken(bag, draw, index, action.token, random);
    default:
      return assertNever(action);
  }
}
