import type { BoardView, CardPlaceView, EncounterCardView, InvestigatorId } from '@arkham/engine';
import { matchingFirst } from '@arkham/util';

/**
 * Where the players put an encounter card by hand (`GameActions.moveEncounterCard`), when the
 * engine left part of a revelation to them: the top of the discard pile, set aside or an
 * investigator's threat area.
 */
export type PileMove =
  { to: 'discard' } | { to: 'setAside' } | { to: 'threatArea'; investigator: InvestigatorId };

/**
 * What the players can do with an encounter card (`cardMoves`): a `PileMove`, or spawn an enemy
 * that is not on the map yet at a location they then tap (`GameActions.spawnEnemy`), so the engine
 * engages it by the rules.
 */
export type CardMove = PileMove | { to: 'spawn' };

/** Where an enemy already is on the map, so it spawns no more. */
const ON_MAP: ReadonlySet<CardPlaceView['kind']> = new Set(['atLocation', 'engaged']);

/**
 * The moves that fit `card` where it is now on `board`: an enemy not on the map spawns, a
 * treachery goes into an active investigator's threat area (the turn investigator's first), and
 * any card goes to the discard pile or set aside. A move to where the card already is is left out.
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
    ...(card.type === 'enemy' && !ON_MAP.has(place.kind) ? [{ to: 'spawn' } as const] : []),
    ...threatAreas,
    ...(place.kind === 'encounterDiscard' ? [] : [{ to: 'discard' } as const]),
    ...(place.kind === 'setAside' ? [] : [{ to: 'setAside' } as const]),
  ];
}
