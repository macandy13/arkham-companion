import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { StoreApi } from 'zustand/vanilla';
import { useCatalog } from '../catalog/useCatalog';
import { InvestigatorPicker } from '../picker/InvestigatorPicker';
import type { AppState } from '../state/appStore';

/** Card language until the settings module (M2.4) stores the player's choice. */
const CARD_LANGUAGE = 'en';

/**
 * Route `/new`: investigator picker (M2.3) above the empty-game shortcut. The seats live in
 * component state until the wizard (M2.5) takes them over; creating an empty game keeps the
 * persistence flow reachable end to end.
 */
export function NewGameScreen({ store }: { store: StoreApi<AppState> }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [seats, setSeats] = useState<string[]>([]);
  const { state, retry } = useCatalog(store.getState().loadCatalog, CARD_LANGUAGE);

  async function createEmptyGame() {
    const gameId = await store.getState().newGame();
    await navigate(`/game/${gameId}`);
  }

  return (
    <>
      <h1>{t('wizard.title')}</h1>
      {state.status === 'loading' && <p role="status">{t('wizard.loading')}</p>}
      {state.status === 'error' && (
        <>
          <p role="alert">{t('wizard.loadFailed')}</p>
          <button onClick={retry}>{t('wizard.retry')}</button>
        </>
      )}
      {state.status === 'ready' && state.catalog.investigators.length === 0 && (
        <p>{t('wizard.noInvestigators')}</p>
      )}
      {state.status === 'ready' && state.catalog.investigators.length > 0 && (
        <InvestigatorPicker catalog={state.catalog} seats={seats} onSeatsChange={setSeats} />
      )}
      <button onClick={() => void createEmptyGame()}>{t('wizard.createEmpty')}</button>
    </>
  );
}
