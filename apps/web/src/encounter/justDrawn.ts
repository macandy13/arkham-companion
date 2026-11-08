import { useState } from 'react';
import type { DecisionId, InstanceId } from '@arkham/engine';

/**
 * What the game screen shows of an open game for `useJustDrawn`: the encounter card being
 * resolved (`BoardView.resolving`) and the open decision (`GameState.pending[0]`), if any.
 */
export interface ResolvingShown {
  card?: InstanceId;
  decision?: DecisionId;
}

/**
 * Whether the open decision is the first one the encounter card being resolved raised while the
 * screen showed the game (`shown`, undefined while no game is open yet), so the decision dialog
 * deals that card in only as it is drawn (M6.5a): the decisions after it for the same card, and a
 * game opened, reloaded or gone back to with the card already drawn, show it in place. Worked out
 * while rendering, like `useCountChange`, so the dialog mounts with it and its animation starts
 * once.
 */
export function useJustDrawn(shown: ResolvingShown | undefined): boolean {
  const [drawn, setDrawn] = useState<ResolvingShown | undefined>(seenAtOpen(shown));
  if (shown === undefined || drawn === undefined) {
    if (shown !== drawn) setDrawn(seenAtOpen(shown));
    return false;
  }
  if (shown.card !== drawn.card) {
    setDrawn(shown);
    return shown.card !== undefined && shown.decision !== undefined;
  }
  return (
    shown.card !== undefined && shown.decision !== undefined && drawn.decision === shown.decision
  );
}

/** The card the game opened with counts as drawn before, so none of its decisions deals it in. */
function seenAtOpen(shown: ResolvingShown | undefined): ResolvingShown | undefined {
  return shown && (shown.card === undefined ? {} : { card: shown.card });
}
