import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { gameId as toGameId } from '@arkham/engine';
import type { AppState } from '../state/appStore';
import './game.css';

/**
 * Route `/game/:id`: loads the game named in the URL (so deep links and reloads work)
 * and shows the board layout of product.md "UI concept" as placeholders.
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

  return (
    <div id="board">
      <header>
        <h1>{t('app.title')}</h1>
        <p>{open ? `${t('header.round')} ${open.state.meta.round}` : t('header.noGame')}</p>
        <button disabled>{t('header.undo')}</button>
      </header>
      <section id="map" aria-labelledby="map-title">
        <h2 id="map-title">{t('map.title')}</h2>
      </section>
      <section id="investigators" aria-labelledby="investigators-title">
        <h2 id="investigators-title">{t('investigators.title')}</h2>
      </section>
      <section id="encounter" aria-labelledby="encounter-title">
        <h2 id="encounter-title">{t('encounter.title')}</h2>
      </section>
    </div>
  );
}
