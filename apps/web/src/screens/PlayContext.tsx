import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { GameActions } from '../state/gameActions';

/**
 * What every control on the play screen needs to play a step: the players' verbs on the open game
 * (`GameActions`) and whether a step is still being played (`OpenGame.busy`), which disables them.
 * The one thing the play screen hands down through a context rather than props, since nearly every
 * part of the board takes it and none decides anything by it; the board itself stays a prop.
 */
export interface Play {
  actions: GameActions;
  busy: boolean;
}

const PlayContext = createContext<Play | undefined>(undefined);

/** Gives the parts of the play screen below it the open game's `actions` and `busy` (`usePlay`). */
export function PlayProvider({ actions, busy, children }: Play & { children: ReactNode }) {
  const play = useMemo(() => ({ actions, busy }), [actions, busy]);
  return <PlayContext.Provider value={play}>{children}</PlayContext.Provider>;
}

/** The open game's actions and whether they are disabled, from the nearest `PlayProvider`. */
export function usePlay(): Play {
  const play = useContext(PlayContext);
  if (!play) throw new Error('A part of the play screen was drawn outside its PlayProvider.');
  return play;
}
