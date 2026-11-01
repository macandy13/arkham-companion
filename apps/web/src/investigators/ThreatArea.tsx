import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, CardFaceView, MapEnemyView } from '@arkham/engine';
import { EnemyDetails } from '../enemies/EnemyDetails';
import { healthLeft } from '../enemies/enemyHealth';
import { enemyConditions } from '../map/LocationTile';
import { CardActions, cardActionsOn } from '../screens/ActionRow';
import { CardZoom } from '../screens/CardZoom';
import type { GameActions } from '../state/gameActions';

/**
 * How many threat area cards show side by side; more scroll, a whole card at a time. The
 * stylesheet sizes the strip to the same count (`--threat-cards-shown`).
 */
export const THREAT_CARDS_SHOWN = 4;

/**
 * An investigator's threat area, laid as a row of small cards along the top edge of their card:
 * the treacheries in it (`BoardView.cardsIn` its zone), then the enemies engaged with them, each
 * with the health it has left, like the damage tokens on the card. A tap on a treachery opens it
 * large to read and act on (`CardZoom`). Past `THREAT_CARDS_SHOWN` cards
 * the row scrolls by whole cards, with a swipe or its arrows. A tap on an enemy card opens its
 * details with what the players can do to it (`EnemyDetails`). Nothing while the area is empty,
 * so the card keeps its place.
 */
export function ThreatArea({
  board,
  treacheries,
  enemies,
  actions,
  busy,
}: {
  /** The board the enemy details read their numbers from (`BoardView.enemyStats`). */
  board: BoardView;
  treacheries: readonly CardFaceView[];
  enemies: readonly MapEnemyView[];
  actions: GameActions;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const strip = useRef<HTMLUListElement>(null);
  const count = treacheries.length + enemies.length;
  if (count === 0) return null;
  // One card's width is enough: the strip snaps to whole cards, so the scroll ends on the next one.
  const scroll = (direction: -1 | 1) => {
    const card = strip.current?.firstElementChild;
    if (card instanceof HTMLElement)
      strip.current?.scrollBy({ left: direction * card.offsetWidth, behavior: 'smooth' });
  };
  const overflowing = count > THREAT_CARDS_SHOWN;
  return (
    <div>
      {overflowing && (
        <button
          type="button"
          aria-label={t('investigators.earlierThreats')}
          onClick={() => scroll(-1)}
        >
          ‹
        </button>
      )}
      <ul ref={strip} aria-label={t('investigators.threatArea')}>
        {treacheries.map((card) => (
          <SmallCard
            key={card.id}
            kind="treachery"
            board={board}
            card={card}
            actions={actions}
            busy={busy}
          />
        ))}
        {enemies.map((enemy) => (
          <EnemyCard key={enemy.id} board={board} enemy={enemy} actions={actions} busy={busy} />
        ))}
      </ul>
      {overflowing && (
        <button
          type="button"
          aria-label={t('investigators.laterThreats')}
          onClick={() => scroll(1)}
        >
          ›
        </button>
      )}
    </div>
  );
}

/**
 * A treachery in the threat area or an asset in the play area (`kind`, which picks its frame) as
 * a small card with its name; a tap on it, a button over the whole card like the enemies', opens
 * it large (`CardZoom`), with the actions it offers, such as one that discards a treachery.
 */
export function SmallCard({
  kind,
  board,
  card,
  actions,
  busy,
}: {
  kind: 'treachery' | 'asset';
  board: BoardView;
  card: CardFaceView;
  actions: GameActions;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [zoomed, setZoomed] = useState(false);
  const close = () => setZoomed(false);
  const offered = cardActionsOn(board, card.id);
  return (
    <li data-card={kind}>
      {card.name}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={t('cardZoom.open', { name: card.name })}
        onClick={() => setZoomed(true)}
      />
      {zoomed && (
        <CardZoom card={card} onClose={close}>
          {(closeZoom) =>
            offered.length > 0 && (
              <CardActions
                board={board}
                offered={offered}
                actions={actions}
                busy={busy}
                onUse={closeZoom}
              />
            )
          }
        </CardZoom>
      )}
    </li>
  );
}

/**
 * An engaged enemy as a small card: its name and the health it has left of its health
 * (`EnemyView.health` less `damage`), named for screen readers with that, its damage and whether
 * it is exhausted, as on the map. A tap on the card opens its details (`EnemyDetails`), with what
 * the players can do to it; the button lies over the whole card, which is too small for more.
 */
function EnemyCard({
  board,
  enemy,
  actions,
  busy,
}: {
  board: BoardView;
  enemy: MapEnemyView;
  actions: GameActions;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const left = healthLeft(enemy);
  return (
    <li
      data-card="enemy"
      data-exhausted={enemy.exhausted}
      aria-label={[
        enemy.name,
        ...(left === undefined ? [] : [t('investigators.healthLeft', { left, max: enemy.health })]),
        ...enemyConditions(enemy, t),
      ].join(', ')}
    >
      {enemy.name}
      {left !== undefined && (
        <data value={left}>{t('investigators.left', { left, max: enemy.health })}</data>
      )}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={t('enemy.open', { name: enemy.name })}
        onClick={() => setDetailsOpen(true)}
      />
      {detailsOpen && (
        <EnemyDetails
          board={board}
          enemy={enemy}
          actions={actions}
          busy={busy}
          onClose={() => setDetailsOpen(false)}
        />
      )}
    </li>
  );
}
