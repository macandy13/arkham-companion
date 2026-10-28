import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import type { StoreApi } from 'zustand/vanilla';
import { ROUND_PHASES, type BoardView } from '@arkham/engine';
import type { AppState, OpenGame } from '../state/appStore';
import { GameLogDialog } from '../log/GameLogDialog';
import { GameExportButton } from './GameExportButton';

/**
 * The play screen's status row under the header, as in the prototype: the round as its heading,
 * the phase track with the current phase marked, then "Next", which runs the phase assistant, and
 * round icon buttons for "Adjust board", undo, the game log (`GameLogDialog`) and the menu. While
 * the players adjust the board (`OpenGame.adjusting`), "Done" and "Cancel" take the place of
 * "Next". Its buttons wait while a step is queued (`OpenGame.busy`), since a second tap would act
 * on whatever the first one leaves open; the log only reads, so it never waits. `board` is the
 * open game's `OpenGame.board`.
 */
export function GameStatus({
  store,
  open,
  board,
}: {
  store: StoreApi<AppState>;
  open: OpenGame;
  board: BoardView;
}) {
  const { t } = useTranslation();
  const { actions } = store.getState();
  const blocked = open.busy;
  const { adjusting, history } = open;
  const [logOpen, setLogOpen] = useState(false);
  return (
    <section id="status" aria-labelledby="status-round">
      <h2 id="status-round">
        {board.phase === 'setup'
          ? t('games.phases.setup')
          : t('header.round', { round: board.round })}
      </h2>
      <ol aria-label={t('header.phases')}>
        {ROUND_PHASES.map((phase) => (
          <li key={phase} aria-current={phase === board.phase ? 'step' : undefined}>
            {t(`games.phases.${phase}`)}
          </li>
        ))}
      </ol>
      {adjusting ? (
        <>
          <button type="button" disabled={blocked} onClick={() => void actions.finishAdjusting()}>
            {t('header.done')}
          </button>
          <button type="button" disabled={blocked} onClick={() => void actions.cancelAdjusting()}>
            {t('header.cancel')}
          </button>
        </>
      ) : (
        <button type="button" disabled={blocked} onClick={() => void actions.nextPhase()}>
          {t('header.next')}
        </button>
      )}
      <button
        type="button"
        data-icon="adjust"
        aria-label={t('header.adjust')}
        aria-pressed={adjusting}
        disabled={blocked || adjusting}
        onClick={() => void actions.startAdjusting()}
      />
      <button
        type="button"
        data-icon="undo"
        aria-label={t('header.undo')}
        disabled={blocked || !open.canUndo}
        onClick={() => void actions.undo()}
      />
      {history && (
        <button
          type="button"
          data-icon="log"
          aria-label={t('log.open')}
          aria-haspopup="dialog"
          onClick={() => setLogOpen(true)}
        />
      )}
      {history && logOpen && (
        <GameLogDialog history={history} state={open.state} onClose={() => setLogOpen(false)} />
      )}
      <GameMenu store={store} />
    </section>
  );
}

/**
 * The play screen's menu behind a round icon button: the way back to the game list, the game's
 * export and the settings, which the title bar holds on the other screens. The play screen leaves
 * the title bar out, so the table keeps its height.
 */
function GameMenu({ store }: { store: StoreApi<AppState> }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  return (
    <nav aria-label={t('nav.label')}>
      <button
        type="button"
        data-icon="menu"
        aria-label={t('header.menu')}
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      />
      {expanded && (
        <ul>
          <li>
            <NavLink to="/">{t('header.allGames')}</NavLink>
          </li>
          <li>
            <GameExportButton store={store} />
          </li>
          <li>
            <NavLink to="/settings">{t('settings.title')}</NavLink>
          </li>
        </ul>
      )}
    </nav>
  );
}
