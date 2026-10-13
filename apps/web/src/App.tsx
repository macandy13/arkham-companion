import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { AppState } from './state/appStore';
import './app.css';

/** Root layout (architecture §11): header, map, investigator bar, encounter panel – all placeholders for now. */
export function App({ store }: { store?: StoreApi<AppState> }) {
  if (!store) return <h1>Arkham Companion</h1>;
  return <Shell store={store} />;
}

function Shell({ store }: { store: StoreApi<AppState> }) {
  const { t } = useTranslation();
  const games = useStore(store, (s) => s.games);
  const current = useStore(store, (s) => s.current);

  useEffect(() => {
    void store.getState().refresh();
  }, [store]);

  return (
    <div className="shell">
      <header className="region header">
        <strong>{t('app.title')}</strong>
        <span>
          {current ? `${t('header.round')} ${current.state.meta.round}` : t('header.noGame')}
        </span>
        <button disabled>{t('header.undo')}</button>
        <button onClick={() => void store.getState().newGame()}>{t('games.new')}</button>
      </header>
      <aside className="region games" aria-label={t('games.title')}>
        <h2>{t('games.title')}</h2>
        {games.length === 0 ? (
          <p>{t('games.empty')}</p>
        ) : (
          <ul>
            {games.map((g, i) => (
              <li key={g.gameId}>
                <button onClick={() => void store.getState().openGame(g.gameId)}>
                  {g.title || t('games.untitled', { n: games.length - i })}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <main className="region map">{t('map.placeholder')}</main>
      <section className="region investigators">{t('investigators.placeholder')}</section>
      <section className="region encounter">{t('encounter.placeholder')}</section>
    </div>
  );
}
