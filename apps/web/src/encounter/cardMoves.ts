import type { BoardView, EncounterCardView, InstanceId, InvestigatorId } from '@arkham/engine';
import { matchingFirst } from '@arkham/util';

/**
 * Where the players put an encounter card by hand (`GameActions.moveEncounterCard`), when the
 * engine left part of a revelation to them: the top of the discard pile, set aside, an
 * investigator's threat area, or, for an enemy, at a location, engaged with an investigator there
 * when there is one.
 */
export type CardMove =
  | { to: 'discard' }
  | { to: 'setAside' }
  | { to: 'threatArea'; investigator: InvestigatorId }
  | { to: 'location'; location: InstanceId; engagedWith?: InvestigatorId };

/**
 * The moves that fit `card` where it is now on `board`: an enemy spawns at a location (engaged with
 * the investigator whose turn it is when they are there, else the first one there), a treachery
 * goes into an active investigator's threat area, and any card goes to the discard pile or set
 * aside. A move to where the card already is is left out.
 */
export function cardMoves(board: BoardView, card: EncounterCardView): CardMove[] {
  const place = board.placeOf(card.id);
  const active = matchingFirst(
    board.investigators.filter((investigator) => investigator.status === 'active'),
    (investigator) => investigator.id === board.turn,
  );
  const spawns: CardMove[] =
    card.type === 'enemy'
      ? board.locations.map(({ id }) => {
          const [engaged] = active.filter(
            (investigator) => board.locationOf(investigator.id) === id,
          );
          return {
            to: 'location',
            location: id,
            ...(engaged === undefined ? {} : { engagedWith: engaged.id }),
          };
        })
      : [];
  const threatAreas: CardMove[] =
    card.type === 'treachery'
      ? active
          .filter(({ id }) => !(place.kind === 'threatArea' && place.investigator === id))
          .map(({ id }) => ({ to: 'threatArea', investigator: id }))
      : [];
  return [
    ...spawns,
    ...threatAreas,
    ...(place.kind === 'encounterDiscard' ? [] : [{ to: 'discard' } as const]),
    ...(place.kind === 'setAside' ? [] : [{ to: 'setAside' } as const]),
  ];
}
