import type { CardStats, EngineContext } from '../cards';
import type { CardCode } from '../ids';
import { cluesHeldAt, cluesHeldByGroup } from '../investigators';
import { theOnlyCopy } from '../lookup';
import type { GameState } from '../state';

/**
 * Whether an objective of the card counts the cards beneath it ("6 Elite enemies in the victory
 * display and/or beneath this act", Augurs of Flame): the players put cards there by hand, as a
 * codex entry tells them, so the screen offers the move only where it counts.
 */
export function countsCardsBeneathSelf(stats: CardStats): boolean {
  return (stats.abilities ?? []).some(({ condition }) => {
    if (condition?.kind !== 'countOf' || condition.of.ref !== 'eachInZone') return false;
    const zones = [condition.of.zone].flat();
    return zones.some((zone) => zone.kind === 'beneath' && zone.hostId.ref === 'self');
  });
}

/**
 * The clues a round-end objective can count on: those of the investigators at the only copy of
 * `location` (none while it is out of play), or of every investigator who may spend clues when
 * the objective names no location.
 */
export function cluesHeldForObjective(
  ctx: EngineContext,
  state: GameState,
  location: CardCode | undefined,
): number {
  if (location === undefined) return cluesHeldByGroup(ctx, state);
  const locationId = theOnlyCopy(state, location);
  return locationId === undefined ? 0 : cluesHeldAt(ctx, state, locationId);
}
