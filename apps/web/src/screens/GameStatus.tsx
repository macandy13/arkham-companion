import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import type { StoreApi } from 'zustand/vanilla';
import { ROUND_PHASES, type BoardView } from '@arkham/engine';
import type { AppState, OpenGame } from '../state/appStore';
import { GameLogDialog } from '../log/GameLogDialog';
import { GameExportButton } from './GameExportButton';
import { TABLE_SKINS } from '../settings/settings';
import { useSettings } from '../settings/useSettings';

/**
 * The play screen's status row under the header, as in the prototype: the round as its heading,
 * the phase track with the current phase marked, then "Next", which runs the phase assistant, and
 * round icon buttons for "Adjust board", undo, the game log (`GameLogDialog`) and the menu. A phone
 * has room for only Next, undo and the menu at a touch size, so the menu also holds "Adjust board"
 * and the game log, which the stylesheet shows there only on a phone (game.css). While
 * the players adjust the board (`OpenGame.adjusting`), "Done" and "Cancel" take the place of
 * "Next". Next and Done are the row's primary (`data-primary`), the brass pill the turn's own step
 * in an investigator's panel takes too (game.css). Its buttons wait while a step is queued (`OpenGame.busy`), since a second tap would act
 * on whatever the first one leaves open; the log opens meanwhile, only its going back waits.
 * `board` is the open game's `OpenGame.board`.
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
  const { adjusting, log } = open;
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
          <button
            type="button"
            data-primary
            disabled={blocked}
            onClick={() => void actions.finishAdjusting()}
          >
            {t('header.done')}
          </button>
          <button type="button" disabled={blocked} onClick={() => void actions.cancelAdjusting()}>
            {t('header.cancel')}
          </button>
        </>
      ) : (
        <button
          type="button"
          data-primary
          disabled={blocked}
          onClick={() => void actions.nextPhase()}
        >
          {t('header.next')}
        </button>
      )}
      <AdjustButton
        adjusting={adjusting}
        disabled={blocked || adjusting}
        onAdjust={() => void actions.startAdjusting()}
      />
      <button
        type="button"
        data-icon="undo"
        aria-label={t('header.undo')}
        disabled={blocked || !open.canUndo}
        onClick={() => void actions.undo()}
      />
      {log && <LogButton onOpen={() => setLogOpen(true)} />}
      {log && logOpen && (
        <GameLogDialog
          log={log}
          state={open.state}
          scenario={open.scenarioNameKey ? t(open.scenarioNameKey) : undefined}
          reliance={open.reliance}
          onRelianceChange={(reliance) => void store.getState().setReliance(reliance)}
          onGoBack={blocked || adjusting ? undefined : (step) => void actions.undoTo(step)}
          onClose={() => setLogOpen(false)}
        />
      )}
      <GameMenu
        store={store}
        heading={open.scenarioNameKey ? t(open.scenarioNameKey) : t('header.thisGame')}
      >
        {(close) => (
          <>
            <li>
              <AdjustButton
                adjusting={adjusting}
                disabled={blocked || adjusting}
                inMenu
                onAdjust={() => {
                  close();
                  void actions.startAdjusting();
                }}
              />
            </li>
            {log && (
              <li>
                <LogButton
                  inMenu
                  onOpen={() => {
                    close();
                    setLogOpen(true);
                  }}
                />
              </li>
            )}
          </>
        )}
      </GameMenu>
    </section>
  );
}

/**
 * "Adjust board", pressed while the players adjust it (`OpenGame.adjusting`): a round icon in the
 * status row, its name written beside the icon in the menu (`inMenu`).
 */
function AdjustButton({
  adjusting,
  disabled,
  onAdjust,
  inMenu = false,
}: {
  adjusting: boolean;
  disabled: boolean;
  onAdjust: () => void;
  inMenu?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-icon="adjust"
      aria-label={inMenu ? undefined : t('header.adjust')}
      aria-pressed={adjusting}
      disabled={disabled}
      onClick={onAdjust}
    >
      {inMenu && t('header.adjust')}
    </button>
  );
}

/** The button that opens the game log, an icon in the status row, named in the menu (`inMenu`). */
function LogButton({ onOpen, inMenu = false }: { onOpen: () => void; inMenu?: boolean }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-icon="log"
      aria-label={inMenu ? undefined : t('log.open')}
      aria-haspopup="dialog"
      onClick={onOpen}
    >
      {inMenu && t('log.open')}
    </button>
  );
}

/**
 * The play screen's menu behind a round icon button (MD.5a): the game's own entries under the
 * scenario's name (the status row's buttons a phone moves into it, given by `children` with the
 * way to close the menu as they act, and the game's export), the table skins, then
 * the way back to the game list and the settings, which the title bar holds on the other screens.
 * The play screen leaves the title bar out, so the table keeps its height.
 */
function GameMenu({
  store,
  heading,
  children,
}: {
  store: StoreApi<AppState>;
  /** Heads the game's own entries: the scenario's name, or "This game" without one. */
  heading: string;
  children: (close: () => void) => ReactNode;
}) {
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
        <div>
          <section aria-labelledby="game-menu-game">
            <h3 id="game-menu-game">{heading}</h3>
            <ul>
              {children(() => setExpanded(false))}
              <li>
                <GameExportButton store={store} />
              </li>
            </ul>
          </section>
          <hr />
          <TableMenuSection />
          <hr />
          <ul>
            <li>
              <NavLink to="/" data-icon="games">
                {t('header.allGames')}
              </NavLink>
            </li>
            <li>
              <NavLink to="/settings" data-icon="settings">
                {t('settings.title')}
              </NavLink>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}

/** The table skins, as in Settings, so the players change the table without leaving play. */
function TableMenuSection() {
  const { t } = useTranslation();
  const [settings, update] = useSettings();
  return (
    <section aria-labelledby="game-menu-table">
      <h3 id="game-menu-table">{t('settings.table')}</h3>
      <ul>
        {TABLE_SKINS.map((tableSkin) => (
          <li key={tableSkin}>
            <button
              type="button"
              data-icon={tableSkin === 'parchment' ? 'day' : 'night'}
              aria-pressed={settings.tableSkin === tableSkin}
              onClick={() => update({ tableSkin })}
            >
              {t(`settings.tableSkins.${tableSkin}`)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
