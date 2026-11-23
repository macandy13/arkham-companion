import { useTranslation } from 'react-i18next';
import type { BoardView, EnemyAction, MapEnemyView } from '@arkham/engine';
import { ActionButton, ActionGroup, CardActions, cardActionsOn } from '../screens/ActionRow';
import { cardTesters, SplitAction } from '../screens/SplitAction';
import { AttachedCards } from '../screens/AttachedCards';
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
 * health for the player count and evade on the page, the cards attached to it with Discard and
 * Attach a card (`AttachedCards`), and under them one row of what the players
 * can do to it. On an investigator's turn, in one Actions group, the basic actions the rules
 * allow them against it (`BoardView.enemyActions`): fight, evade and engage as actions, which
 * count off what they cost (`BoardView.actionCost`), then fight and evade without an action, as some cards allow; at any time, in a
 * group of their own, what card effects do to an enemy: deal 1 damage, disengage it, exhaust or
 * ready it, evade or engage it for each investigator `BoardView.enemyCardEffects` names, defeat it,
 * and put it beneath the act where an objective counts the cards there (`ActView.takesCardsBeneath`,
 * Smoke and Mirrors' interrogated suspects).
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
    board.turn === undefined ? (cost?.free ? 0 : 1) : board.actionCost(board.turn, action, cost);

  const engaged =
    enemy.engagedWith === undefined ? undefined : board.investigator(enemy.engagedWith);
  const stats = board.enemyStats(enemy.id);
  const left = healthLeft(enemy);
  const effects = board.enemyCardEffects(enemy.id);
  const testers = cardTesters(board);
  const tested = (['fight', 'evade'] as const).filter(
    (kind) => allowed.includes(kind) || testers.length > 0,
  );
  const testAs = (kind: 'fight' | 'evade', cost?: 'free') =>
    kind === 'fight' ? actions.fight(enemy.id, cost) : actions.evade(enemy.id, cost);

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
      <AttachedCards board={board} host={enemy.id} actions={actions} busy={busy} />
      <footer>
        {(tested.length > 0 || allowed.includes('engage')) && (
          <ActionGroup title={t('enemy.actions')}>
            {tested.map((kind) => (
              <SplitAction
                key={kind}
                icon={kind}
                caption={t(`enemy.caption.${kind}`)}
                waysName={t(`ways.${kind}`)}
                {...(allowed.includes(kind)
                  ? {
                      primary: {
                        key: 'action',
                        actions: costOf(kind),
                        name: t(`enemy.${kind}Action`, { count: costOf(kind) }),
                        onPick: step(() => testAs(kind), 'host'),
                      },
                    }
                  : {})}
                ways={[
                  ...(tests.includes(kind)
                    ? [
                        {
                          key: 'free',
                          actions: costOf(kind, { free: true }),
                          name: t(`enemy.${kind}Free`, { count: costOf(kind, { free: true }) }),
                          onPick: step(() => testAs(kind, 'free'), 'host'),
                        },
                      ]
                    : []),
                  ...testers.map(({ id, name }) => ({
                    key: id,
                    name: t('byCard.testBy', { test: t(`byCard.${kind}`), name }),
                    onPick: step(() => actions.testByCard(kind, id, enemy.id), 'host'),
                  })),
                ]}
                disabled={busy}
              />
            ))}
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
          {enemy.exhausted ? (
            <ActionButton
              icon="ready"
              caption={t('enemy.caption.ready')}
              name={t('enemy.ready')}
              disabled={busy}
              onClick={step(() => actions.readyEnemy(enemy.id), 'stay')}
            />
          ) : (
            <ActionButton
              icon="exhaust"
              caption={t('enemy.caption.exhaust')}
              name={t('enemy.exhaust')}
              disabled={busy}
              onClick={step(() => actions.exhaustEnemy(enemy.id), 'stay')}
            />
          )}
          {effects.evade.map((investigator) => (
            <ActionButton
              key={investigator}
              icon="evaded"
              caption={t('enemy.caption.evaded')}
              name={t('enemy.evadedBy', { name: board.investigator(investigator).name })}
              disabled={busy}
              onClick={step(() => actions.evadeEnemy(enemy.id, investigator), 'close')}
            />
          ))}
          {effects.engage.map((investigator) => (
            <ActionButton
              key={investigator}
              icon="engage"
              caption={t('enemy.caption.engage')}
              name={t('enemy.engages', { name: board.investigator(investigator).name })}
              disabled={busy}
              onClick={step(() => actions.engageEnemy(enemy.id, investigator), 'stay')}
            />
          ))}
          <ActionButton
            icon="defeat"
            caption={t('enemy.caption.defeat')}
            name={t('enemy.defeat')}
            disabled={busy}
            onClick={step(() => actions.defeatEnemy(enemy.id), 'close')}
          />
          {board.act?.takesCardsBeneath && (
            <ActionButton
              icon="beneathAct"
              caption={t('enemy.caption.beneathAct')}
              name={t('enemy.beneathAct')}
              disabled={busy}
              onClick={step(() => actions.putBeneathAct(enemy.id), 'close')}
            />
          )}
        </ActionGroup>
      </footer>
    </DetailsDialog>
  );
}
