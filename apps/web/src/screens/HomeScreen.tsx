import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { AppState } from '../state/appStore';
import { GameImportError } from '../storage/gameExport';
import { downloadGameExport } from './downloadFile';
import { GameListItem, untitledLabel } from './GameListItem';
import './home.css';

/** Route `/`: saved games with resume, rename, duplicate, export and delete, plus import of an export file; an empty state points to the wizard. */
export function HomeScreen({ store }: { store: StoreApi<AppState> }) {
  const { t } = useTranslation();
  const games = useStore(store, (s) => s.games);
  const [importError, setImportError] = useState<string>();

  async function importFile(file: File) {
    try {
      await store.getState().importGame(await file.text());
      setImportError(undefined);
    } catch (error) {
      console.warn('Could not import the game file.', error);
      setImportError(
        t(
          error instanceof GameImportError && error.reason === 'newerVersion'
            ? 'games.importNewerVersion'
            : 'games.importInvalid',
        ),
      );
    }
  }

  useEffect(() => {
    void store.getState().refresh();
  }, [store]);

  return (
    <>
      <h1>{t('games.title')}</h1>
      <Link to="/new">{t('games.new')}</Link>
      <label>
        {t('games.import')}
        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (file) void importFile(file);
          }}
        />
      </label>
      {importError && <p role="alert">{importError}</p>}
      {games.length === 0 ? (
        <section aria-labelledby="games-empty">
          <h2 id="games-empty">{t('games.empty')}</h2>
          <Link to="/new?mode=campaign">{t('games.newCampaign')}</Link>
          <Link to="/new?mode=quick">{t('games.quickGame')}</Link>
        </section>
      ) : (
        <ul aria-label={t('games.title')}>
          {games.map((game, i) => {
            const untitled = untitledLabel(t, games, i);
            const copyTitle = t('games.copyTitle', { title: game.title || untitled });
            return (
              <GameListItem
                key={game.gameId}
                game={game}
                untitledLabel={untitled}
                onRename={(title) => void store.getState().renameGame(game.gameId, title)}
                onDuplicate={() => void store.getState().duplicateGame(game.gameId, copyTitle)}
                onExport={() => void downloadGameExport(store, game.gameId, game.title || untitled)}
                onDelete={() => void store.getState().deleteGame(game.gameId)}
              />
            );
          })}
        </ul>
      )}
    </>
  );
}
