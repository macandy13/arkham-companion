import { useTranslation } from 'react-i18next';
import type { BoardView, EnemyAction, MapEnemyView } from '@arkham/engine';
import { ActionButton, ActionGroup, CardActions, cardActionsOn } from '../screens/ActionRow';
import { DetailsDialog, useDecisionHost } from '../screens/DetailsDialog';
import type { GameActions } from '../state/gameActions';
import { useBackCloses } from '../screens/useBackCloses';
import { EnemyCard } from './EnemyCard';
import { healthLeft } from './enemyHealth';
import './enemies.css';

/**
 * One enemy in full, opened by a tap on its card or its map token, on the card shell
 * (`DetailsDialog`): the enemy drawn as its card beside the page (`EnemyCard`, from
 * `BoardView.enemyStats`), whom it is engaged with in the kicker, its fight, health left of its
 * health for the player count and evade on the page, and under them one row of what the players
 * can do to it. On an investigator's turn, in one Actions group, the basic actions the rules
 * allow them against it (`BoardView.enemyActions`): fight, evade and engage as actions, which
 * count off one, then fight and evade without an action, as some cards allow; at any time, in a
 * group of their own, what card effects do to an enemy: deal 1 damage, disengage it, defeat it.
 * Each button shows a short word and is named in full ("Fight · 1 action"). Fight, evade and
 * engage keep it open and show the decisions they raise in place of its page
 * (`useDecisionHost`: the test's result, an attack of opportunity), with the enemy still beside
 * it, then its page again for the fight that often follows; damage keeps it open for the next
 * point. It reads the enemy fresh from the board. Escape and its × close it; nothing is tapped
 * while a step is queued (`busy`). On a phone it is the shell's sheet and the back gesture
 * closes it too (`useBackCloses`).
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
  const close = useBackCloses(onClose);
  const hosted = useDecisionHost();
  const step = (play: () => Promise<void>, then: 'close' | 'stay' | 'host') => () => {
    if (then === 'close') close();
    if (then === 'host') hosted.host();
    void play();
  };
  const allowed = board.turn === undefined ? [] : board.enemyActions(board.turn, enemy.id);
  const tests = allowed.filter((action) => action !== 'engage');
  const offered = cardActionsOn(board, enemy.id);
  const costOf = (action: EnemyAction, cost?: { free: true }) =>
    board.turn === undefined ? 1 : board.actionCost(board.turn, action, cost);

  const engaged =
    enemy.engagedWith === undefined ? undefined : board.investigator(enemy.engagedWith);
  const stats = board.enemyStats(enemy.id);
  const left = healthLeft(enemy);

  return (
    <DetailsDialog
      board={board}
      actions={actions}
      busy={busy}
      hosted={hosted}
      name="enemy"
      card={board.cardFace(enemy.id)}
      drawn={<EnemyCard enemy={enemy} stats={stats} />}
      {...(engaged
        ? { actor: engaged, kicker: t('enemy.engagedWith', { name: engaged.name }) }
        : {})}
      title={enemy.name}
      onClose={close}
    >
      <dl>
        <div>
          <dt>{t('enemy.fight')}</dt>
          <dd>{stats.fight}</dd>
        </div>
        <div>
          <dt>{t('enemy.health')}</dt>
          <dd>{left === undefined ? '–' : t('enemy.healthLeft', { left, max: enemy.health })}</dd>
        </div>
        <div>
          <dt>{t('enemy.evade')}</dt>
          <dd>{stats.evade}</dd>
        </div>
      </dl>
      <footer>
        {allowed.length > 0 && (
          <ActionGroup title={t('enemy.actions')}>
            {allowed.includes('fight') && (
              <ActionButton
                icon="fight"
                actions={costOf('fight')}
                caption={t('enemy.caption.fight')}
                name={t('enemy.fightAction', { count: costOf('fight') })}
                disabled={busy}
                onClick={step(() => actions.fight(enemy.id), 'host')}
              />
            )}
            {allowed.includes('evade') && (
              <ActionButton
                icon="evade"
                actions={costOf('evade')}
                caption={t('enemy.caption.evade')}
                name={t('enemy.evadeAction', { count: costOf('evade') })}
                disabled={busy}
                onClick={step(() => actions.evade(enemy.id), 'host')}
              />
            )}
            {allowed.includes('engage') && (
              <ActionButton
                icon="engage"
                actions={costOf('engage')}
                caption={t('enemy.caption.engage')}
                name={t('enemy.engageAction', { count: costOf('engage') })}
                disabled={busy}
                onClick={step(() => actions.engage(enemy.id), 'host')}
              />
            )}
            {tests.includes('fight') && (
              <ActionButton
                icon="fight"
                actions={costOf('fight', { free: true })}
                caption={t('enemy.caption.fight')}
                name={t('enemy.fightFree', { count: costOf('fight', { free: true }) })}
                disabled={busy}
                onClick={step(() => actions.fight(enemy.id, 'free'), 'host')}
              />
            )}
            {tests.includes('evade') && (
              <ActionButton
                icon="evade"
                actions={costOf('evade', { free: true })}
                caption={t('enemy.caption.evade')}
                name={t('enemy.evadeFree', { count: costOf('evade', { free: true }) })}
                disabled={busy}
                onClick={step(() => actions.evade(enemy.id, 'free'), 'host')}
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
            onClick={step(() => actions.damageEnemy(enemy.id, 1), 'stay')}
          />
          {enemy.engagedWith !== undefined && (
            <ActionButton
              icon="disengage"
              caption={t('enemy.caption.disengage')}
              name={t('enemy.disengage')}
              disabled={busy}
              onClick={step(() => actions.disengageEnemy(enemy.id), 'close')}
            />
          )}
          <ActionButton
            icon="defeat"
            caption={t('enemy.caption.defeat')}
            name={t('enemy.defeat')}
            disabled={busy}
            onClick={step(() => actions.defeatEnemy(enemy.id), 'close')}
          />
        </ActionGroup>
      </footer>
    </DetailsDialog>
  );
}
