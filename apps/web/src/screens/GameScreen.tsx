import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { gameId as toGameId } from '@arkham/engine';
import type { AppState } from '../state/appStore';
import { MapBoard } from '../map/MapBoard';
import { GameHeader } from './GameHeader';
import { RejectionToast } from './RejectionToast';
import './game.css';

/**
 * Route `/game/:id`: loads the game named in the URL (so deep links and reloads work)
 * and shows the board layout of product.md "UI concept": the header, the map, so far placeholders
 * for the rest, and the reason when an action is refused. Until the game is open it says so, and
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

  return (
    <div id="board">
      <GameHeader store={store} open={open} board={board} />
      <section id="map" aria-labelledby="map-title">
        <h2 id="map-title">{t('map.title')}</h2>
        <MapBoard maps={board.maps} />
      </section>
      <section id="investigators" aria-labelledby="investigators-title">
        <h2 id="investigators-title">{t('investigators.title')}</h2>
      </section>
      <section id="encounter" aria-labelledby="encounter-title">
        <h2 id="encounter-title">{t('encounter.title')}</h2>
      </section>
      {open.rejection && (
        <RejectionToast
          rejection={open.rejection}
          onDismiss={() => store.getState().dismissRejection()}
        />
      )}
    </div>
  );
}
