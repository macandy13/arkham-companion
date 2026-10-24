import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardName, MapEnemyView } from '@arkham/engine';
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
 * the row scrolls by whole cards, with a swipe or its arrows. On the investigator's turn (`turn`)
 * each enemy card has fight and evade buttons, which take the action and leave its skill test to
 * the decision dialog. Nothing while the area is empty, so the card keeps its place.
 */
export function ThreatArea({
  treacheries,
  enemies,
  turn,
}: {
  treacheries: readonly CardName[];
  enemies: readonly MapEnemyView[];
  /** Only on the investigator's turn: the actions and whether a step is queued. */
  turn: EnemyActions | undefined;
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
          <EnemyCard key={enemy.id} enemy={enemy} turn={turn} />
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

/** What a threat area's enemy cards play on the investigator's turn, waiting while `busy`. */
interface EnemyActions {
  actions: GameActions;
  busy: boolean;
}

/**
 * An engaged enemy as a small card: its name and the health it has left of its health
 * (`EnemyView.health` less `damage`), named for screen readers with that, its damage and whether
 * it is exhausted, as on the map. On the investigator's turn a tap on the card opens its actions
 * (`EnemyMenu`), since two buttons would not fit on a card this small.
 */
function EnemyCard({ enemy, turn }: { enemy: MapEnemyView; turn: EnemyActions | undefined }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
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
      {turn && (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={t('investigators.enemyActions', { name: enemy.name })}
          disabled={turn.busy}
          onClick={() => setMenuOpen(true)}
        />
      )}
      {turn && menuOpen && (
        <EnemyMenu enemy={enemy} turn={turn} onClose={() => setMenuOpen(false)} />
      )}
    </li>
  );
}

/**
 * The actions the investigator whose turn it is can take against an enemy engaged with them:
 * fight and evade. Either closes the menu, so the decision dialog that asks for the test's result
 * is the only one open. A native modal `<dialog>` brings focus trapping and Escape.
 */
function EnemyMenu({
  enemy,
  turn,
  onClose,
}: {
  enemy: MapEnemyView;
  turn: EnemyActions;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={onClose} data-dialog="enemy">
      <h2 id={titleId}>{enemy.name}</h2>
      {(['fight', 'evade'] as const).map((action) => (
        <button
          key={action}
          type="button"
          data-icon={action}
          disabled={turn.busy}
          onClick={() => {
            onClose();
            void turn.actions[action](enemy.id);
          }}
        >
          {t(`investigators.${action}`)}
        </button>
      ))}
      <footer>
        <button type="button" onClick={onClose}>
          {t('locationMenu.close')}
        </button>
      </footer>
    </dialog>
  );
}
