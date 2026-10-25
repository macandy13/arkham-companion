import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, MapEnemyView } from '@arkham/engine';
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

/** A titled group of buttons in the enemy details' action row. */
function ActionGroup({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId}>
      <h3 id={titleId}>{title}</h3>
      {children}
    </section>
  );
}

/**
 * A button of the action row: its icon over a short `caption`, named in full by `name` (which
 * contains the caption, so speech input finds it by the word it shows); `cost` marks the ones
 * that count off an action, which the stylesheet marks with the game's action arrow.
 */
function ActionButton({
  icon,
  cost,
  caption,
  name,
  disabled,
  onClick,
}: {
  icon: 'fight' | 'evade' | 'damage' | 'disengage' | 'defeat';
  cost?: 'action';
  caption: string;
  name: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-icon={icon}
      data-cost={cost}
      aria-label={name}
      disabled={disabled}
      onClick={onClick}
    >
      {caption}
    </button>
  );
}
