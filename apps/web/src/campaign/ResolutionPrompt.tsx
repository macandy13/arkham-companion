import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { StoreApi } from 'zustand/vanilla';
import type { AppState, OpenGame } from '../state/appStore';
import { ResolutionDialog } from './ResolutionDialog';

/**
 * Opens the resolution dialog over an ended campaign game (`OpenGame.resolution`) and, once the
 * players write it into the log (`AppState.writeResolution`), goes to the campaign screen. "Not
 * yet" closes it until the game is opened again, so the players can still look at the table.
 */
export function ResolutionPrompt({
  store,
  open,
}: {
  readonly store: StoreApi<AppState>;
  readonly open: OpenGame;
}) {
  const navigate = useNavigate();
  const [later, setLater] = useState(false);
  const [failed, setFailed] = useState(false);
  const resolution = open.resolution;
  const campaignId = resolution?.campaignId;
  // Adjusting the board may end the game on a tap the players take back, so the resolution waits
  // for "Done".
  if (later || open.adjusting || resolution === undefined || campaignId === undefined) return null;
  return (
    <ResolutionDialog
      game={open.state}
      changes={resolution.changes}
      busy={open.busy}
      failed={failed}
      onLater={() => setLater(true)}
      onWrite={(confirmed) => {
        store
          .getState()
          .writeResolution(confirmed)
          .then(() => navigate(`/campaign/${campaignId}`))
          .catch((error: unknown) => {
            console.warn('The resolution could not be written into the campaign log.', error);
            setFailed(true);
          });
      }}
    />
  );
}
