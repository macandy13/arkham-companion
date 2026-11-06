import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { AppState } from '../state/appStore';
import { GameImportError } from '../storage/gameExport';
import { CampaignListItem } from './CampaignListItem';
import { downloadGameExport } from './downloadFile';
import { GameListItem, untitledLabel } from './GameListItem';
import { HomeTitle } from './HomeTitle';
import './home.css';

/**
 * Route `/`: the app's title over its three ways in (a new campaign, one scenario, loading an
 * export file), then campaigns with resume and saved games with resume, rename, duplicate, export
 * and delete. The title and the ways in lie on the table rather than on a page (MD.3b).
 */
export function HomeScreen({ store }: { store: StoreApi<AppState> }) {
  const { t } = useTranslation();
  const games = useStore(store, (s) => s.games);
  const campaigns = useStore(store, (s) => s.campaigns);
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
      <hgroup>
        <h1>
          <HomeTitle />
        </h1>
        <p>{t('home.tagline')}</p>
      </hgroup>
      <nav aria-label={t('home.start')}>
        <Link to="/new?mode=campaign" data-primary>
          {t('home.newCampaign')}
        </Link>
        <Link to="/new?mode=quick">{t('home.oneScenario')}</Link>
        <label>
          {t('home.load')}
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
      </nav>
      {importError && <p role="alert">{importError}</p>}
      {campaigns.length > 0 && (
        <ul aria-label={t('campaignList.title')}>
          {campaigns.map((campaign) => (
            <CampaignListItem key={campaign.campaignId} campaign={campaign} />
          ))}
        </ul>
      )}
      {games.length === 0 ? (
        <p>{t('games.empty')}</p>
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
