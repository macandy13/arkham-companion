import type { CardStats, EngineContext, ScaledValue } from '../cards';
import type { CardCode } from '../ids';
import { cluesHeldAt, cluesHeldByGroup } from '../investigators';
import { theOnlyCopy } from '../lookup';
import type { GameState, TokenKind } from '../state';
import { asScaled } from './types';

/**
 * The count of `token` a card's objective on its own tokens (`whenTokensOnSelf`) waits for, if it
 * has one: the act's threshold as the board shows it (Disrupting the Ritual's 2 clues per
 * investigator).
 */
export function tokenObjective(stats: CardStats, token: TokenKind): ScaledValue | undefined {
  for (const { condition } of stats.abilities ?? []) {
    if (
      condition?.kind === 'valueOf' &&
      condition.value.kind === 'tokens' &&
      condition.value.on.ref === 'self' &&
      condition.value.token === token &&
      condition.min !== undefined
    )
      return asScaled(condition.min);
  }
  return undefined;
}

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
 * The clues an act's `advanceBySpendingCluesAtRoundEnd` asks of the investigators at `location`
 * (The Barrier's Hallway), or of all of them when it names none; undefined for an act without one.
 */
export function roundEndClueObjective(
  stats: CardStats,
): { clues: ScaledValue; location?: CardCode } | undefined {
  for (const { window, condition } of stats.abilities ?? []) {
    if (
      window.on === 'roundEnds' &&
      condition?.kind === 'valueOf' &&
      condition.value.kind === 'groupClues' &&
      condition.min !== undefined
    )
      return { clues: asScaled(condition.min), location: condition.value.location };
  }
  return undefined;
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
