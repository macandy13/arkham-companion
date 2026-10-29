import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView, MapEnemyView } from '@arkham/engine';
import { ActionButton, ActionGroup, CardActions, cardActionsOn } from '../screens/ActionRow';
import type { GameActions } from '../state/gameActions';
import { useBackCloses } from '../screens/useBackCloses';
import { EnemyCard } from './EnemyCard';
import './enemies.css';

/**
 * One enemy in full, opened by a tap on its card or its map token: whom it is engaged with, the
 * enemy drawn as its card (`EnemyCard`, from `BoardView.enemyStats`), and under it one row of what
 * the players can do to it. On an investigator's turn, the basic actions the rules allow them
 * against it (`BoardView.enemyActions`): fight, evade and engage as actions, which count off one,
 * and fight and evade without an action, as some cards allow; at any time, what card effects do
 * to an enemy: deal 1 damage, disengage it, defeat it. Each button shows a short word and is
 * named in full ("Fight · 1 action"). Fight and evade close it, so the decision dialog that asks
 * for the test's result is the only one open; damage keeps it open for the next point, and engage
 * for the fight that usually follows, and both read the enemy fresh from the board. A native
 * modal `<dialog>` brings focus trapping and Escape; nothing is tapped while a step is queued
 * (`busy`). On a phone it fills the screen and the back gesture closes it too (`useBackCloses`).
 */
export function EnemyDetails({
  board,
  enemy,
  actions,
  busy,
  onClose,
}: {
  board: BoardView;
  enemy: MapEnemyView;
  actions: GameActions;
  busy: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const close = useBackCloses(onClose);
  const step = (play: () => Promise<void>, closes: boolean) => () => {
    if (closes) close();
    void play();
  };
  const allowed = board.turn === undefined ? [] : board.enemyActions(board.turn, enemy.id);
  const tests = allowed.filter((action) => action !== 'engage');
  const offered = cardActionsOn(board, enemy.id);

  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={close} data-dialog="enemy">
      <button type="button" data-icon="close" aria-label={t('enemy.close')} onClick={close} />
      {enemy.engagedWith !== undefined && (
        <p>{t('enemy.engagedWith', { name: board.investigator(enemy.engagedWith).name })}</p>
      )}
      <EnemyCard enemy={enemy} stats={board.enemyStats(enemy.id)} titleId={titleId} />
      <footer>
        {allowed.length > 0 && (
          <ActionGroup title={t('enemy.asAction')}>
            {allowed.includes('fight') && (
              <ActionButton
                icon="fight"
                cost="action"
                caption={t('enemy.caption.fight')}
                name={t('enemy.fightAction')}
                disabled={busy}
                onClick={step(() => actions.fight(enemy.id), true)}
              />
            )}
            {allowed.includes('evade') && (
              <ActionButton
                icon="evade"
                cost="action"
                caption={t('enemy.caption.evade')}
                name={t('enemy.evadeAction')}
                disabled={busy}
                onClick={step(() => actions.evade(enemy.id), true)}
              />
            )}
            {allowed.includes('engage') && (
              <ActionButton
                icon="engage"
                cost="action"
                caption={t('enemy.caption.engage')}
                name={t('enemy.engageAction')}
                disabled={busy}
                onClick={step(() => actions.engage(enemy.id), false)}
              />
            )}
          </ActionGroup>
        )}
        {tests.length > 0 && (
          <ActionGroup title={t('enemy.free')}>
            {tests.includes('fight') && (
              <ActionButton
                icon="fight"
                caption={t('enemy.caption.fight')}
                name={t('enemy.fightFree')}
                disabled={busy}
                onClick={step(() => actions.fight(enemy.id, 'free'), true)}
              />
            )}
            {tests.includes('evade') && (
              <ActionButton
                icon="evade"
                caption={t('enemy.caption.evade')}
                name={t('enemy.evadeFree')}
                disabled={busy}
                onClick={step(() => actions.evade(enemy.id, 'free'), true)}
              />
            )}
          </ActionGroup>
        )}
        {offered.length > 0 && (
          <CardActions
            board={board}
            offered={offered}
            actions={actions}
            busy={busy}
            onUse={close}
          />
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
