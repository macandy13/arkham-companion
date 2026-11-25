import type { BoardView, InstanceId, InvestigatorId } from '@arkham/engine';

/**
 * The locations a card effect may move `investigator` to (`GameActions.move` by card), which the
 * map lights to pick from: every location in play, connected or not, but the one they are at and
 * those a card forbids moving into (the Parlor's barrier) or whose cost to enter the group can't pay
 * (`BoardView.canEnter`, Underground Cistern), which the engine would refuse.
 */
export function moveByCardTargets(board: BoardView, investigator: InvestigatorId): InstanceId[] {
  const at = board.locationOf(investigator);
  return board.locations
    .filter(
      (location) =>
        location.id !== at &&
        !location.forbidden?.includes('moveInto') &&
        board.canEnter(location.id),
    )
    .map((location) => location.id);
}
