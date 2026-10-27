import type { BoardView, EncounterCardView, InstanceId, InvestigatorId } from '@arkham/engine';
import { matchingFirst } from '@arkham/util';

/**
 * Where the players put an encounter card by hand (`GameActions.moveEncounterCard`), when the
 * engine left part of a revelation to them: the top of the discard pile, set aside, an
 * investigator's threat area, or, for an enemy, at a location, unengaged or engaged with an
 * investigator there.
 */
export type CardMove =
  | { to: 'discard' }
  | { to: 'setAside' }
  | { to: 'threatArea'; investigator: InvestigatorId };

/**
 * The moves that fit `card` where it is now on `board`: an enemy spawns at a location, unengaged or
 * engaged with any active investigator there (the turn investigator first), since prey, Aloof and
 * the lead investigator decide which, and the players carry that out; a treachery
 * goes into an active investigator's threat area, and any card goes to the discard pile or set
 * aside. A move to where the card already is is left out.
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
