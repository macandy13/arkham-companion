import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, MapEnemyView } from '@arkham/engine';
import type { GameActions } from '../state/gameActions';
import { EnemyCard } from './EnemyCard';
import './enemies.css';

/**
 * One enemy in full, opened by a tap on its card: whom it is engaged with, the enemy drawn as its
 * card (`EnemyCard`, from `BoardView.enemyStats`), then what the players can do to it. On the turn
 * of the investigator it is engaged with (`onTurn`), fight and evade as actions, which count off
 * one, and the same without an action, as some cards allow. At any time, what card effects do to
 * an enemy: deal 1 damage, disengage it, defeat it. Fight and evade close it, so the decision
 * dialog that asks for the test's result is the only one open; damage keeps it open for the next
 * point, and reads the enemy fresh from the board. A native modal `<dialog>` brings focus
 * trapping and Escape; nothing is tapped while a step is queued (`busy`).
 */
export function EnemyDetails({
  board,
  enemy,
  actions,
  onTurn,
  busy,
  onClose,
}: {
  board: BoardView;
  enemy: MapEnemyView;
  actions: GameActions;
  onTurn: boolean;
  busy: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const step = (play: () => Promise<void>, close: boolean) => () => {
    if (close) onClose();
    void play();
  };

  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={onClose} data-dialog="enemy">
      {enemy.engagedWith !== undefined && (
        <p>{t('enemy.engagedWith', { name: board.investigator(enemy.engagedWith).name })}</p>
      )}
      <EnemyCard enemy={enemy} stats={board.enemyStats(enemy.id)} titleId={titleId} />
      {onTurn && (
        <>
          <ActionGroup title={t('enemy.asAction')}>
            <button
              type="button"
              data-icon="fight"
              data-cost="action"
              disabled={busy}
              onClick={step(() => actions.fight(enemy.id), true)}
            >
              {t('enemy.fightAction')}
            </button>
            <button
              type="button"
              data-icon="evade"
              data-cost="action"
              disabled={busy}
              onClick={step(() => actions.evade(enemy.id), true)}
            >
              {t('enemy.evadeAction')}
            </button>
          </ActionGroup>
          <ActionGroup title={t('enemy.free')}>
            <button
              type="button"
              data-icon="fight"
              disabled={busy}
              onClick={step(() => actions.fight(enemy.id, 'free'), true)}
            >
              {t('enemy.fightFree')}
            </button>
            <button
              type="button"
              data-icon="evade"
              disabled={busy}
              onClick={step(() => actions.evade(enemy.id, 'free'), true)}
            >
              {t('enemy.evadeFree')}
            </button>
          </ActionGroup>
        </>
      )}
      <ActionGroup title={t('enemy.cardEffects')}>
        <button
          type="button"
          disabled={busy}
          onClick={step(() => actions.damageEnemy(enemy.id, 1), false)}
        >
          {t('enemy.damage')}
        </button>
        {enemy.engagedWith !== undefined && (
          <button
            type="button"
            disabled={busy}
            onClick={step(() => actions.disengageEnemy(enemy.id), true)}
          >
            {t('enemy.disengage')}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={step(() => actions.defeatEnemy(enemy.id), true)}
        >
          {t('enemy.defeat')}
        </button>
      </ActionGroup>
      <footer>
        <button type="button" onClick={onClose}>
          {t('enemy.close')}
        </button>
      </footer>
    </dialog>
  );
}

/** A titled row of buttons in the enemy details. */
function ActionGroup({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId}>
      <h3 id={titleId}>{title}</h3>
      {children}
    </section>
  );
}
