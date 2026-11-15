import { assertNever } from '@arkham/util';
import type { InvestigatorId } from './ids';
import type { GameState, Phase } from './state';

/**
 * "(Limit once per turn.)", "(Limit once per round.)", "(Group limit once per game.)": how often an
 * ability may be used (Rules Reference, "Limits and Maximums"). A limit counts each investigator's
 * uses apart; a group limit counts everyone's together. One type for every printed limit, so card
 * actions and, with MC2.3, triggered abilities count them alike (`withinLimit`).
 */
export interface UsageLimit {
  readonly per: UsagePeriod;
  readonly group?: true;
  /** "(Limit twice per round.)": the uses allowed in the period; once when absent. */
  readonly times?: number;
}

/** The periods a limit names; each ends where `samePeriod` says. */
export type UsagePeriod = 'turn' | 'round' | 'phase' | 'game';

/**
 * One use of a limited ability: who used it and when, which is all a limit asks. `turnOf` is the
 * investigator whose turn was in progress, absent outside every turn (a free action in the mythos
 * phase). Kept on the card instance that has the ability (`CardInstance.actionUses`), so its uses
 * would reset if the card left play and came back; no limited card does that yet.
 */
export interface AbilityUse {
  investigatorId: InvestigatorId;
  round: number;
  phase: Phase;
  turnOf?: InvestigatorId;
}

/** When `investigatorId` uses an ability now: the use a reducer records. */
export function useNow(state: GameState, investigatorId: InvestigatorId): AbilityUse {
  const turnOf = state.meta.turn?.investigatorId;
  return {
    investigatorId,
    round: state.meta.round,
    phase: state.meta.phase,
    ...(turnOf === undefined ? {} : { turnOf }),
  };
}

/**
 * Whether `limit` lets `investigatorId` use the ability once more, given its earlier `uses`: fewer
 * than `times` of the uses that count (theirs, or everyone's for a group limit) fall in the
 * current period. No limit always allows.
 */
export function withinLimit(
  state: GameState,
  uses: readonly AbilityUse[],
  limit: UsageLimit | undefined,
  investigatorId: InvestigatorId,
): boolean {
  if (limit === undefined) return true;
  const now = useNow(state, investigatorId);
  const counted = uses.filter(
    (use) =>
      (limit.group === true || use.investigatorId === investigatorId) &&
      samePeriod(limit.per, use, now),
  );
  return counted.length < (limit.times ?? 1);
}

/**
 * Whether two uses fall in the same `period`. A turn is one investigator's turn in a round (each
 * has one per round); uses outside every turn share the phase they are in, as no turn is in
 * progress to tell them apart.
 */
function samePeriod(period: UsagePeriod, use: AbilityUse, now: AbilityUse): boolean {
  switch (period) {
    case 'game':
      return true;
    case 'round':
      return use.round === now.round;
    case 'phase':
      return use.round === now.round && use.phase === now.phase;
    case 'turn':
      return use.round === now.round && use.phase === now.phase && use.turnOf === now.turnOf;
    default:
      return assertNever(period);
  }
}
