import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, MapEnemyView } from '@arkham/engine';
import { ActionButton, ActionGroup } from '../screens/ActionRow';
import type { GameActions } from '../state/gameActions';
import { EnemyCard } from './EnemyCard';
import './enemies.css';

/**
 * One enemy in full, opened by a tap on its card: whom it is engaged with, the enemy drawn as its
 * card (`EnemyCard`, from `BoardView.enemyStats`), and under it one row of what the players can
 * do to it. On the turn of the investigator it is engaged with (`onTurn`), fight and evade as
 * actions, which count off one, and the same without an action, as some cards allow; at any time,
 * what card effects do to an enemy: deal 1 damage, disengage it, defeat it. Each button shows a
 * short word and is named in full ("Fight · 1 action"). Fight and evade close it, so the decision
 * dialog that asks for the test's result is the only one open; damage keeps it open for the next
 * point, and reads the enemy fresh from the board. A native modal `<dialog>` brings focus trapping
 * and Escape; nothing is tapped while a step is queued (`busy`).
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
      <button type="button" data-icon="close" aria-label={t('enemy.close')} onClick={onClose} />
      {enemy.engagedWith !== undefined && (
        <p>{t('enemy.engagedWith', { name: board.investigator(enemy.engagedWith).name })}</p>
      )}
      <EnemyCard enemy={enemy} stats={board.enemyStats(enemy.id)} titleId={titleId} />
      <footer>
        {onTurn && (
          <>
            <ActionGroup title={t('enemy.asAction')}>
              <ActionButton
                icon="fight"
                cost="action"
                caption={t('enemy.caption.fight')}
                name={t('enemy.fightAction')}
                disabled={busy}
                onClick={step(() => actions.fight(enemy.id), true)}
              />
              <ActionButton
                icon="evade"
                cost="action"
                caption={t('enemy.caption.evade')}
                name={t('enemy.evadeAction')}
                disabled={busy}
                onClick={step(() => actions.evade(enemy.id), true)}
              />
            </ActionGroup>
            <ActionGroup title={t('enemy.free')}>
              <ActionButton
                icon="fight"
                caption={t('enemy.caption.fight')}
                name={t('enemy.fightFree')}
                disabled={busy}
                onClick={step(() => actions.fight(enemy.id, 'free'), true)}
              />
              <ActionButton
                icon="evade"
                caption={t('enemy.caption.evade')}
                name={t('enemy.evadeFree')}
                disabled={busy}
                onClick={step(() => actions.evade(enemy.id, 'free'), true)}
              />
            </ActionGroup>
          </>
        )}
        <ActionGroup title={t('enemy.cardEffects')}>
          <ActionButton
            icon="damage"
            caption={t('enemy.caption.damage')}
            name={t('enemy.damage')}
            disabled={busy}
            onClick={step(() => actions.damageEnemy(enemy.id, 1), false)}
          />
          {enemy.engagedWith !== undefined && (
            <ActionButton
              icon="disengage"
              caption={t('enemy.caption.disengage')}
              name={t('enemy.disengage')}
              disabled={busy}
              onClick={step(() => actions.disengageEnemy(enemy.id), true)}
            />
          )}
          <ActionButton
            icon="defeat"
            caption={t('enemy.caption.defeat')}
            name={t('enemy.defeat')}
            disabled={busy}
            onClick={step(() => actions.defeatEnemy(enemy.id), true)}
          />
        </ActionGroup>
      </footer>
    </dialog>
  );
}
