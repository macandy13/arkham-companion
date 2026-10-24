import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardName, EnemyView } from '@arkham/engine';
import { enemyConditions } from '../map/LocationTile';

/**
 * How many threat area cards show side by side; more scroll, a whole card at a time. The
 * stylesheet sizes the strip to the same count (`--threat-cards-shown`).
 */
export const THREAT_CARDS_SHOWN = 4;

/**
 * An investigator's threat area, laid as a row of small cards along the top edge of their card:
 * the treacheries in it (`InvestigatorView.threatArea`), then the enemies engaged with them, each
 * with the health it has left, like the damage tokens on the card. Past `THREAT_CARDS_SHOWN` cards
 * the row scrolls by whole cards, with a swipe or its arrows. Nothing while the area is empty, so
 * the card keeps its place.
 */
export function ThreatArea({
  treacheries,
  enemies,
}: {
  treacheries: readonly CardName[];
  enemies: readonly EnemyView[];
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
        {enemies.map((enemy, index) => (
          <EnemyCard key={`${enemy.name}-${index}`} enemy={enemy} />
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
 * it is exhausted, as on the map.
 */
function EnemyCard({ enemy }: { enemy: EnemyView }) {
  const { t } = useTranslation();
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
    </li>
  );
}
