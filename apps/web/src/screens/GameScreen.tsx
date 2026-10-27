import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { gameId as toGameId } from '@arkham/engine';
import type { AppState } from '../state/appStore';
import { InvestigatorBar } from '../investigators/InvestigatorBar';
import { MapBoard } from '../map/MapBoard';
import { DecisionDialog } from './DecisionDialog';
import { GameHeader } from './GameHeader';
import { GameStatus } from './GameStatus';
import { RejectionToast } from './RejectionToast';
import { DrawnCardsNotice } from '../encounter/DrawnCardsNotice';
import { SkippedEffectsNotice } from './SkippedEffectsNotice';
import './game.css';

/**
 * Route `/game/:id`: loads the game named in the URL (so deep links and reloads work)
 * and shows the board layout of product.md "UI concept": the header, the status row, the map, the investigator bar,
 * the first open decision as a dialog, the reason when an action is refused, and the card effects it skipped. Until the game is open it says so, and
 * a game it cannot play (its scenario is not in the catalog) gets a warning instead of a board.
 */
export function GameScreen({ store }: { store: StoreApi<AppState> }) {
  const { t } = useTranslation();
  // The route only matches with an `:id` segment; the fallback only satisfies the type.
  const gameId = toGameId(useParams().id ?? '');
  const current = useStore(store, (s) => s.current);
  const open = current?.gameId === gameId ? current : undefined;

  useEffect(() => {
    void store.getState().openGame(gameId);
  }, [store, gameId]);

  // Only a playable game has a board to read, so the board's parts get one and never check.
  if (!open?.board) {
    return (
      <>
        <h1>{t('app.title')}</h1>
        {open ? <p role="alert">{t('game.unplayable')}</p> : <p>{t('header.noGame')}</p>}
      </>
    );
  }
  const { board } = open;
  const [decision] = board.decisions;

  return (
    <div id="board" data-adjusting={open.adjusting || undefined}>
      <GameHeader store={store} open={open} board={board} />
      <GameStatus store={store} open={open} board={board} />
      <section id="map" aria-labelledby="map-title">
        <h2 id="map-title">{t('map.title')}</h2>
        <MapBoard
          board={board}
          actions={store.getState().actions}
          busy={open.busy}
          adjusting={open.adjusting}
        />
      </section>
      <section id="investigators" aria-labelledby="investigators-title">
        <h2 id="investigators-title">{t('investigators.title')}</h2>
        <InvestigatorBar
          board={board}
          actions={store.getState().actions}
          busy={open.busy}
          adjusting={open.adjusting}
        />
      </section>
      {/* Adjusting the board is allowed with a decision open, so the dialog steps aside meanwhile. */}
      {decision && !open.adjusting && (
        <DecisionDialog
          key={open.state.pending[0]?.id}
          board={board}
          decision={decision}
          actions={store.getState().actions}
          busy={open.busy}
        />
      )}
      <div id="notices">
        {open.drawnCards && (
          <DrawnCardsNotice
            board={board}
            drawn={open.drawnCards}
            actions={store.getState().actions}
            busy={open.busy}
            onDismiss={() => store.getState().dismissDrawnCards()}
          />
        )}
        {open.skippedEffects && (
          <SkippedEffectsNotice
            skipped={open.skippedEffects}
            onDismiss={() => store.getState().dismissSkippedEffects()}
          />
        )}
        {open.rejection && (
          <RejectionToast
            rejection={open.rejection}
            onDismiss={() => store.getState().dismissRejection()}
          />
        )}
      </div>
    </div>
  );
}
