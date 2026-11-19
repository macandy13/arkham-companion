import type { BoardView, InstanceId, InvestigatorId } from '@arkham/engine';

/**
 * The locations a card effect may move `investigator` to (`GameActions.moveByCard`), which the
 * map lights to pick from: every location in play, connected or not, but the one they are at and
 * those a card forbids moving into (the Parlor's barrier), which the engine would refuse.
 */
export function moveByCardTargets(board: BoardView, investigator: InvestigatorId): InstanceId[] {
  const at = board.locationOf(investigator);
  return board.locations
    .filter((location) => location.id !== at && !location.forbidden?.includes('moveInto'))
    .map((location) => location.id);
}
