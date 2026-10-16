import type { CardMoved, Event, TokensChanged } from './events';
import { requireCard } from './lookup';
import { CommandRejected } from './rejection';
import type { InstanceId } from './ids';
import { TOKEN_KINDS, type CardInstance, type GameState, type TokenKind } from './state';
import { sameZone, zoneKey, type Zone } from './zone';

/** The IDs a zone may refer to, used to validate card placements. */
export interface ZoneRefs {
  cards: Record<InstanceId, CardInstance>;
  investigators: ReadonlySet<string>;
  maps: ReadonlySet<string>;
}

/** Checks that every ID a zone refers to exists and that hosting creates no cycle. */
export function validateZone(refs: ZoneRefs, cardId: InstanceId, zone: Zone): void {
  switch (zone.kind) {
    case 'location':
      if (!refs.maps.has(zone.mapId))
        throw new CommandRejected({ code: 'unknownMap', mapId: zone.mapId });
      return;
    case 'engaged':
    case 'threatArea':
      if (!refs.investigators.has(zone.investigatorId)) {
        throw new CommandRejected({
          code: 'unknownInvestigator',
          investigatorId: zone.investigatorId,
        });
      }
      return;
    case 'atLocation':
    case 'attachedTo': {
      const hostId = zone.kind === 'atLocation' ? zone.locationId : zone.hostId;
      // Follow the host chain; reaching the moved card again would be a cycle.
      const seen = new Set<InstanceId>();
      let current: InstanceId | undefined = hostId;
      while (current !== undefined) {
        if (current === cardId) throw new CommandRejected({ code: 'hostingCycle', cardId, hostId });
        if (seen.has(current)) break;
        seen.add(current);
        const host = requireCard(refs.cards, current);
        current = hostOf(host.zone);
      }
      return;
    }
    default:
      return;
  }
}

/** The card hosting a card in `zone`, if any (enemy at a location, attachment). */
function hostOf(zone: Zone): InstanceId | undefined {
  if (zone.kind === 'atLocation') return zone.locationId;
  if (zone.kind === 'attachedTo') return zone.hostId;
  return undefined;
}

/** The references a zone may name in `state`. */
export function stateZoneRefs(state: GameState): ZoneRefs {
  return {
    cards: state.cards,
    investigators: new Set(state.investigators.map((i) => i.id)),
    maps: new Set(Object.keys(state.board.maps)),
  };
}

/**
 * The `CardMoved` for moving `card` to `to` (at `index`, default the end),
 * without validation. For moves the engine itself decides, whose zone is
 * known to be valid; a move a command asks for goes through `cardMoved`.
 */
export function moveCardEvent(
  card: Pick<CardInstance, 'id' | 'zone'>,
  to: Zone,
  index?: number,
): CardMoved {
  return {
    type: 'CardMoved',
    cardId: card.id,
    from: card.zone,
    to,
    ...(index !== undefined ? { index } : {}),
  };
}

/** The `CardMoved` for moving `card` to `to` (at `index`, default the end), after validating both. */
export function cardMoved(
  state: GameState,
  card: CardInstance,
  to: Zone,
  index?: number,
): CardMoved {
  validateZone(stateZoneRefs(state), card.id, to);
  const destSize = (state.order[zoneKey(to)] ?? []).length;
  // When reordering within a zone the card itself is removed first.
  const maxIndex = sameZone(card.zone, to) ? destSize - 1 : destSize;
  if (index !== undefined && (!Number.isInteger(index) || index < 0 || index > maxIndex)) {
    throw new CommandRejected({ code: 'indexOutOfRange', index, max: maxIndex });
  }
  return moveCardEvent(card, to, index);
}

/** Removes every token of the given kinds (default all) from `card`; no event for a kind it has none of. */
export function clearTokensEvents(
  card: CardInstance,
  tokens: readonly TokenKind[] = TOKEN_KINDS,
): TokensChanged[] {
  return tokens.flatMap((token) => {
    const amount = card.tokens[token] ?? 0;
    return amount === 0 ? [] : [{ type: 'TokensChanged', cardId: card.id, token, delta: -amount }];
  });
}

/**
 * `cardId` and everything attached to it, attachments first, to the top of
 * the encounter discard. Attachments go with their host because a card in the
 * discard cannot host anything. Tokens are removed with each card: doom on a
 * discarded treachery must not come back if the discard is reshuffled into
 * the deck.
 */
export function discardEncounterCard(state: GameState, cardId: InstanceId): Event[] {
  const card = state.cards[cardId];
  if (!card) return [];
  const attachments = (state.order[zoneKey({ kind: 'attachedTo', hostId: cardId })] ?? []).flatMap(
    (attachedId) => discardEncounterCard(state, attachedId),
  );
  return [
    ...attachments,
    ...clearTokensEvents(card),
    moveCardEvent(card, { kind: 'encounterDiscard' }, 0),
  ];
}
