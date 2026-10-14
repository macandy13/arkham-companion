import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { AppState } from '../state/appStore';

/** Route `/`: saved games, each linking to its play screen. Rename/duplicate/delete arrive with M2.x. */
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
        <p>{t('games.empty')}</p>
      ) : (
        <ul aria-label={t('games.title')}>
          {games.map((game, i) => (
            <li key={game.gameId}>
              <Link to={`/game/${game.gameId}`}>
                {game.title || t('games.untitled', { n: games.length - i })}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
