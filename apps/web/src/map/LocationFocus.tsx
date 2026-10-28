import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, InstanceId, LocationView } from '@arkham/engine';
import type { GameActions } from '../state/gameActions';
import { LocationContent } from './LocationDetails';
import { CONNECTION_RADIUS, ConnectionSymbol } from './LocationTile';
import { neighboursOf, type Neighbour, type Side } from './mapLayout';

/**
 * The phone's location mode (M3.14e): one location in the detail view's map row, in place of the
 * whole map, with the same content as the location details dialog (`LocationContent`) and a Map
 * button that brings the whole map back (`onMap`). Its connected locations sit around its card,
 * each on the side where it lies on the map (`neighboursOf`), and a tap on one shows that one
 * instead (`onGo`), sliding in from that side. It stays on the location after a move or an
 * investigation, since the players look at the row, not a window over it; a decision that follows
 * opens as its own dialog. It takes the focus as it opens on a location, since the tile tapped to
 * open it is gone with the map.
 */
export function LocationFocus({
  board,
  location,
  actions,
  busy,
  adjusting,
  onGo,
  onMap,
}: {
  board: BoardView;
  location: LocationView;
  actions: GameActions;
  busy: boolean;
  adjusting: boolean;
  onGo: (location: InstanceId) => void;
  onMap: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const section = useRef<HTMLElement>(null);
  const [arrivedFrom, setArrivedFrom] = useState<Side>();
  useEffect(() => {
    section.current?.focus({ preventScroll: true });
  }, [location.id]);
  const map = board.maps.find(({ id }) => id === location.map);
  const neighbours = map ? neighboursOf(map, location.id) : [];
  const go = ({ id, side }: Neighbour) => {
    setArrivedFrom(side);
    onGo(id);
  };
  return (
    <section
      // A new location starts its slide afresh.
      key={location.id}
      ref={section}
      tabIndex={-1}
      aria-labelledby={titleId}
      data-mode="location"
      data-from={arrivedFrom}
    >
      <LocationContent
        board={board}
        location={location}
        actions={actions}
        busy={busy}
        adjusting={adjusting}
        titleId={titleId}
        around={(card) => (
          <Compass board={board} neighbours={neighbours} onGo={go}>
            {card}
          </Compass>
        )}
      />
      <button type="button" onClick={onMap}>
        {t('detail.showMap')}
      </button>
    </section>
  );
}

/** Where the compass grid puts the neighbours of each side, around the card in its middle. */
const SIDES: readonly Side[] = ['above', 'left', 'right', 'below'];

/**
 * The location's card with its neighbours around it: a list per side, named after the side, so
 * screen readers hear where each one lies, as the eye sees it.
 */
function Compass({
  board,
  neighbours,
  onGo,
  children,
}: {
  board: BoardView;
  neighbours: readonly Neighbour[];
  onGo: (neighbour: Neighbour) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div data-compass>
      {SIDES.map((side) => {
        const here = neighbours.filter((neighbour) => neighbour.side === side);
        return (
          here.length > 0 && (
            <ul key={side} aria-label={t(`location.side.${side}`)} data-side={side}>
              {here.map((neighbour) => (
                <li key={neighbour.id}>
                  <NeighbourTile board={board} neighbour={neighbour} onGo={() => onGo(neighbour)} />
                </li>
              ))}
            </ul>
          )
        );
      })}
      {children}
    </div>
  );
}

/**
 * One neighbour as a small tile, a button that shows it instead: its connection symbol and name,
 * and the initials of who is there, investigators then enemies. A neighbour a card forbids to
 * enter (`LocationView.forbidden`, the Parlor's barrier) is marked barricaded (`data-blocked`) and
 * a one-way connection by its direction (`data-one-way`); its name says both, and who is there.
 */
function NeighbourTile({
  board,
  neighbour,
  onGo,
}: {
  board: BoardView;
  neighbour: Neighbour;
  onGo: () => void;
}) {
  const { t } = useTranslation();
  const location = board.location(neighbour.id);
  const pieces = [...board.investigatorsAt(neighbour.id), ...board.enemiesAt(neighbour.id)];
  const blocked = location.forbidden?.includes('moveInto') === true;
  const name = [
    location.name,
    ...(blocked ? [t('location.neighbour.blocked')] : []),
    ...(neighbour.oneWay ? [t(`location.neighbour.oneWay.${neighbour.oneWay}`)] : []),
    ...pieces.map(({ name }) => name),
  ].join(', ');
  return (
    <button
      type="button"
      aria-label={t('location.neighbour.goTo', { name })}
      data-blocked={blocked || undefined}
      data-one-way={neighbour.oneWay}
      onClick={onGo}
    >
      {location.symbol && (
        <svg
          aria-hidden="true"
          viewBox={`${-CONNECTION_RADIUS} ${-CONNECTION_RADIUS} ${2 * CONNECTION_RADIUS} ${2 * CONNECTION_RADIUS}`}
        >
          <ConnectionSymbol symbol={location.symbol} centre={{ x: 0, y: 0 }} />
        </svg>
      )}
      <span>{location.name}</span>
      {pieces.length > 0 && (
        <span aria-hidden="true" data-pieces>
          {pieces.map(({ id, name }) => (
            <span key={id}>{name.charAt(0)}</span>
          ))}
        </span>
      )}
    </button>
  );
}
