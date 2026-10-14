import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { AppState } from '../state/appStore';
import { GameListItem } from './GameListItem';
import './home.css';

/** Route `/`: saved games with resume, rename, duplicate and delete; an empty state points to the wizard. */
export function HomeScreen({ store }: { store: StoreApi<AppState> }) {
  const { t } = useTranslation();
  const games = useStore(store, (s) => s.games);

  useEffect(() => {
    void store.getState().refresh();
  }, [store]);

  return (
    <>
      <h1>{t('games.title')}</h1>
      <Link to="/new">{t('games.new')}</Link>
      {games.length === 0 ? (
        <section aria-labelledby="games-empty">
          <h2 id="games-empty">{t('games.empty')}</h2>
          <Link to="/new?mode=campaign">{t('games.newCampaign')}</Link>
          <Link to="/new?mode=quick">{t('games.quickGame')}</Link>
        </section>
      ) : (
        <ul aria-label={t('games.title')}>
          {games.map((game, i) => {
            const untitledLabel = t('games.untitled', { n: games.length - i });
            const copyTitle = t('games.copyTitle', { title: game.title || untitledLabel });
            return (
              <GameListItem
                key={game.gameId}
                game={game}
                untitledLabel={untitledLabel}
                onRename={(title) => void store.getState().renameGame(game.gameId, title)}
                onDuplicate={() => void store.getState().duplicateGame(game.gameId, copyTitle)}
                onDelete={() => void store.getState().deleteGame(game.gameId)}
              />
            );
          })}
        </ul>
      )}
    </>
  );
}
