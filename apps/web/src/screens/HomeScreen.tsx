import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { investigatorPictures } from '../catalog/investigatorPictures';
import { useCatalog, type CatalogSource } from '../catalog/useCatalog';
import type { AppState } from '../state/appStore';
import { GameImportError } from '../storage/gameExport';
import { CampaignCover } from './CampaignCover';
import { downloadCampaignExport, downloadGameExport } from './downloadFile';
import { GameCover, untitledLabel } from './GameCover';
import { HomeTitle } from './HomeTitle';
import { LoadGameLabel } from './LoadGameLabel';
import { shelfEntries } from './shelf';
import type { PortraitImages } from './TeamPortraits';
import { WelcomePage } from './WelcomePage';
import '@fontsource/caveat/latin-500.css';
import './home.css';

/**
 * Route `/`: while nothing is stored, the welcome page on paper (`WelcomePage`, MD.4c). Otherwise
 * the app's title over its three ways in (a new campaign, one scenario, loading an export file),
 * then the shelf: one cover per campaign, its scenario games included, and one per game of one
 * scenario, last played first (`shelfEntries`); this view lies on the table rather than on a page
 * (MD.3b).
 */
export function HomeScreen({
  store,
  catalog,
}: {
  store: StoreApi<AppState>;
  /** The card catalog, for the investigators' portraits on the covers. */
  catalog: CatalogSource;
}) {
  const { t } = useTranslation();
  const catalogState = useCatalog(catalog);
  const images: PortraitImages = useMemo(
    () =>
      catalogState.status === 'ready' ? investigatorPictures(catalogState.catalog) : new Map(),
    [catalogState],
  );
  const games = useStore(store, (s) => s.games);
  const campaigns = useStore(store, (s) => s.campaigns);
  const [importError, setImportError] = useState<string>();

  async function importFile(file: File) {
    try {
      await store.getState().importFile(await file.text());
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

  const importAlert = importError && <p role="alert">{importError}</p>;
  if (games.length === 0 && campaigns.length === 0) {
    return (
      <>
        <WelcomePage onLoad={(file) => void importFile(file)} />
        {importAlert}
      </>
    );
  }

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
        <LoadGameLabel onLoad={(file) => void importFile(file)} />
      </nav>
      {importAlert}
      <ul id="shelf" aria-label={t('home.shelf')}>
        {shelfEntries(campaigns, games).map((entry, index) => {
          const lastPlayed = index === 0;
          if (entry.kind === 'campaign') {
            return (
              <CampaignCover
                key={entry.campaign.campaignId}
                campaign={entry.campaign}
                games={entry.games}
                images={images}
                lastPlayed={lastPlayed}
                onRename={(title) =>
                  void store.getState().renameCampaign(entry.campaign.campaignId, title)
                }
                onExport={() =>
                  void downloadCampaignExport(
                    store,
                    entry.campaign.campaignId,
                    entry.campaign.title,
                  )
                }
                onDelete={() => void store.getState().deleteCampaign(entry.campaign.campaignId)}
              />
            );
          }
          const { game } = entry;
          const untitled = untitledLabel(t, games, games.indexOf(game));
          const copyTitle = t('games.copyTitle', { title: game.title || untitled });
          return (
            <GameCover
              key={game.gameId}
              game={game}
              untitledLabel={untitled}
              onRename={(title) => void store.getState().renameGame(game.gameId, title)}
              onDuplicate={() => void store.getState().duplicateGame(game.gameId, copyTitle)}
              onExport={() => void downloadGameExport(store, game.gameId, game.title || untitled)}
              onDelete={() => void store.getState().deleteGame(game.gameId)}
              images={images}
              lastPlayed={lastPlayed}
            />
          );
        })}
      </ul>
    </>
  );
}
