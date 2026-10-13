import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStoreSelector } from './state/createStore';
import type { Store } from './state/createStore';
import type { AppState } from './state/appStore';
import './app.css';

/** Root layout (architecture §11): header, map, investigator bar, encounter panel – all placeholders for now. */
export function App({ store }: { store?: Store<AppState> }) {
  if (!store) return <p>Arkham Companion</p>;
  return <Shell store={store} />;
}

function Shell({ store }: { store: Store<AppState> }) {
  const { t } = useTranslation();
  const games = useStoreSelector(store, (s) => s.games);
  const current = useStoreSelector(store, (s) => s.current);

  useEffect(() => {
    void store.getState().refresh();
  }, [store]);

  return (
    <div id="shell">
      <header>
        <h1>{t('app.title')}</h1>
        <p>{current ? `${t('header.round')} ${current.state.meta.round}` : t('header.noGame')}</p>
        <button disabled>{t('header.undo')}</button>
        <button onClick={() => void store.getState().newGame()}>{t('games.new')}</button>
      </header>
      <aside id="games" aria-label={t('games.title')}>
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
      <main id="map">{t('map.placeholder')}</main>
      <section id="investigators">{t('investigators.placeholder')}</section>
      <section id="encounter">{t('encounter.placeholder')}</section>
    </div>
  );
}
