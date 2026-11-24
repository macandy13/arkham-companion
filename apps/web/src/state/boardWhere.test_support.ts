import type {
  BoardView,
  InstanceId,
  InvestigatorId,
  InvestigatorView,
  LocationView,
} from '@arkham/engine';

/**
 * `board` with some of its answers replaced, for a test of the wiring between a view value and a
 * control (coding guidelines §3, "Web tests own the wiring"). It puts the board in a state that
 * only a card's rule reaches otherwise, an action forbidden or a move costing more, so the web
 * test checks the control and the rule stays with the engine tests. Every member `answers` leaves
 * out answers as `board` does, and the steps a test plays still go to the table behind it.
 */
export function boardWhere(board: BoardView, answers: Partial<BoardView>): BoardView {
  return new Proxy(board, {
    get: (real, key, proxy) =>
      key in answers ? Reflect.get(answers, key) : Reflect.get(real, key, proxy),
  });
}

/**
 * `board` where the view of the location `id` has `change` on top, wherever the board lists it
 * (`location`, `locations`, each map's `locations`): `locationWhere(board, study, { forbidden:
 * ['investigate'] })` for a card that forbids investigating the study.
 */
export function locationWhere(
  board: BoardView,
  id: InstanceId,
  change: Partial<LocationView>,
): BoardView {
  const patch = (view: LocationView): LocationView =>
    view.id === id ? { ...view, ...change } : view;
  return boardWhere(board, {
    location: (ref) => patch(board.location(ref)),
    get locations() {
      return board.locations.map(patch);
    },
    get maps() {
      return board.maps.map((map) => ({ ...map, locations: map.locations.map(patch) }));
    },
  });
}

/**
 * `board` where the view of the investigator `id` has `change` on top, wherever the board lists
 * them (`investigator`, `investigators`, `investigatorsInPlay`, `investigatorsAt`):
 * `investigatorWhere(board, alder, { forbidden: { cards: ['play'] } })` for a card that forbids
 * them to play cards.
 */
export function investigatorWhere(
  board: BoardView,
  id: InvestigatorId,
  change: Partial<InvestigatorView>,
): BoardView {
  const patch = (view: InvestigatorView): InvestigatorView =>
    view.id === id ? { ...view, ...change } : view;
  return boardWhere(board, {
    investigator: (ref) => patch(board.investigator(ref)),
    get investigators() {
      return board.investigators.map(patch);
    },
    get investigatorsInPlay() {
      return board.investigatorsInPlay.map(patch);
    },
    investigatorsAt: (location) => board.investigatorsAt(location).map(patch),
  });
}
