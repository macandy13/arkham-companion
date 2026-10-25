import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, CardName, MapEnemyView } from '@arkham/engine';
import { EnemyDetails } from '../enemies/EnemyDetails';
import { enemyConditions } from '../map/LocationTile';
import type { GameActions } from '../state/gameActions';

/**
 * How many threat area cards show side by side; more scroll, a whole card at a time. The
 * stylesheet sizes the strip to the same count (`--threat-cards-shown`).
 */
export const THREAT_CARDS_SHOWN = 4;

/**
 * An investigator's threat area, laid as a row of small cards along the top edge of their card:
 * the treacheries in it (`InvestigatorView.threatArea`), then the enemies engaged with them, each
 * with the health it has left, like the damage tokens on the card. Past `THREAT_CARDS_SHOWN` cards
 * the row scrolls by whole cards, with a swipe or its arrows. A tap on an enemy card opens its
 * details with what the players can do to it (`EnemyDetails`). Nothing while the area is empty,
 * so the card keeps its place.
 */
export function ThreatArea({
  board,
  treacheries,
  enemies,
  actions,
  onTurn,
  busy,
}: {
  /** The board the enemy details read their numbers from (`BoardView.enemyStats`). */
  board: BoardView;
  treacheries: readonly CardName[];
  enemies: readonly MapEnemyView[];
  actions: GameActions;
  /** It is the turn of the investigator whose threat area this is, so they may fight and evade. */
  onTurn: boolean;
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
        {treacheries.map((name, index) => (
          <li key={`${name}-${index}`} data-threat="treachery">
            {name}
          </li>
        ))}
        {enemies.map((enemy) => (
          <EnemyCard
            key={enemy.id}
            board={board}
            enemy={enemy}
            actions={actions}
            onTurn={onTurn}
            busy={busy}
          />
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
 * An engaged enemy as a small card: its name and the health it has left of its health
 * (`EnemyView.health` less `damage`), named for screen readers with that, its damage and whether
 * it is exhausted, as on the map. A tap on the card opens its details (`EnemyDetails`), with what
 * the players can do to it; the button lies over the whole card, which is too small for more.
 */
function EnemyCard({
  board,
  enemy,
  actions,
  onTurn,
  busy,
}: {
  board: BoardView;
  enemy: MapEnemyView;
  actions: GameActions;
  onTurn: boolean;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const left = enemy.health === undefined ? undefined : enemy.health - (enemy.damage ?? 0);
  return (
    <li
      data-threat="enemy"
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
          onTurn={onTurn}
          busy={busy}
          onClose={() => setDetailsOpen(false)}
        />
      )}
    </li>
  );
}
