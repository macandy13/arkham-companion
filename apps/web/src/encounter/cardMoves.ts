import type { BoardView, EncounterCardView, InvestigatorId } from '@arkham/engine';
import { matchingFirst } from '@arkham/util';

/**
 * Where the players put an encounter card by hand (`GameActions.moveEncounterCard`), when the
 * engine left part of a revelation to them: the top of the discard pile, set aside or an
 * investigator's threat area. An enemy spawns on the map instead (`GameActions.spawnEnemy`).
 */
export type CardMove =
  { to: 'discard' } | { to: 'setAside' } | { to: 'threatArea'; investigator: InvestigatorId };

/**
 * The moves that fit `card` where it is now on `board`: a treachery goes into an active
 * investigator's threat area (the turn investigator's first), and any card goes to the discard
 * pile or set aside. A move to where the card already is is left out.
 */
export function cardMoves(board: BoardView, card: EncounterCardView): CardMove[] {
  const place = board.placeOf(card.id);
  const active = matchingFirst(
    board.investigators.filter((investigator) => investigator.status === 'active'),
    (investigator) => investigator.id === board.turn,
  );
  const threatAreas: CardMove[] =
    card.type === 'treachery'
      ? active
          .filter(({ id }) => !(place.kind === 'threatArea' && place.investigator === id))
          .map(({ id }) => ({ to: 'threatArea', investigator: id }))
      : [];
  return [
    ...threatAreas,
    ...(place.kind === 'encounterDiscard' ? [] : [{ to: 'discard' } as const]),
    ...(place.kind === 'setAside' ? [] : [{ to: 'setAside' } as const]),
  ];
}
