import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { StoreApi } from 'zustand/vanilla';
import type { AppState } from '../state/appStore';

/**
 * Route `/new`: placeholder for the new-game wizard (M2.7). Until then it can only
 * create an empty game, which keeps the persistence flow reachable end to end.
 */
export function NewGameScreen({ store }: { store: StoreApi<AppState> }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  async function createEmptyGame() {
    const gameId = await store.getState().newGame();
    await navigate(`/game/${gameId}`);
  }

  return (
    <>
      <h1>{t('wizard.title')}</h1>
      <p>{t('wizard.placeholder')}</p>
      <button onClick={() => void createEmptyGame()}>{t('wizard.createEmpty')}</button>
    </>
  );
}
