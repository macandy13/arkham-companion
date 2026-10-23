import { useTranslation } from 'react-i18next';
import { useMatch } from 'react-router';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { AppState } from '../state/appStore';
import { downloadGameExport } from './downloadFile';
import { untitledLabel } from './GameListItem';

/**
 * The title bar's export of the game on the play screen, so the board's header keeps its room for
 * the scenario's cards. It shows only on `/game/:id` once that game is open, and saves the game
 * under the title the home screen lists it with, so both exports get the same file name.
 */
export function GameExportButton({ store }: { store: StoreApi<AppState> }) {
  const { t } = useTranslation();
  const route = useMatch('/game/:id');
  const open = useStore(store, (s) => s.current);
  const games = useStore(store, (s) => s.games);
  if (!open || open.gameId !== route?.params.id) return null;

  const index = games.findIndex((game) => game.gameId === open.gameId);
  const title = games[index]?.title || untitledLabel(t, games, index);
  return (
    <button type="button" onClick={() => void downloadGameExport(store, open.gameId, title)}>
      {t('games.export')}
    </button>
  );
}
