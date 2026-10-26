import type {
  BoardView,
  CardPlaceView,
  EncounterCardView,
  Event,
  InstanceId,
  InvestigatorId,
} from '@arkham/engine';
import { unique } from '@arkham/util';

/**
 * An encounter card one step drew or placed, for the notice of where it went (`OpenGame.drawnCards`):
 * the card, the investigator it was drawn for when the step drew it, and where it is now.
 */
export interface DrawnCard {
  card: EncounterCardView;
  drawnFor?: InvestigatorId;
  place: CardPlaceView;
}

/**
 * The encounter cards `events` (one step's) drew or moved out of the `resolving` zone, in the
 * order they were drawn, each read where it is now on `board`. A card still resolving is left out:
 * the decision dialog shows it until its revelation is answered, and that step then lists it, for
 * the investigator the board before the step (`before`) had it resolving for.
 */
export function drawnCards(
  before: BoardView,
  board: BoardView,
  events: readonly Event[],
): DrawnCard[] {
  const drawnFor = new Map<InstanceId, InvestigatorId>();
  const { resolving } = before;
  if (resolving?.drawnBy !== undefined) drawnFor.set(resolving.id, resolving.drawnBy);
  const cards = unique(
    events.flatMap((event) => {
      if (event.type === 'EncounterCardDrawn') {
        drawnFor.set(event.cardId, event.investigatorId);
        return [event.cardId];
      }
      return event.type === 'CardMoved' && event.from.kind === 'resolving' ? [event.cardId] : [];
    }),
  );
  return cards.flatMap((id): DrawnCard[] => {
    const place = board.placeOf(id);
    if (place.kind === 'resolving') return [];
    const investigator = drawnFor.get(id);
    return [
      {
        card: board.encounterCard(id),
        ...(investigator === undefined ? {} : { drawnFor: investigator }),
        place,
      },
    ];
  });
}
