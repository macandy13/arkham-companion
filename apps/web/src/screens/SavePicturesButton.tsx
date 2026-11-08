import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardView } from '@arkham/engine';
import { savePictures, type PictureProgress } from '../catalog/savePictures';

/**
 * The play menu's entry that saves every picture of the open game for a table without network
 * (M6.4, `BoardView.pictures` through `savePictures`). It counts on while it runs and then says
 * how many it saved, and how many failed for a tap to try again, which costs little, since the
 * cache serves the pictures it has. A Night of the Zealot scenario has about 40 pictures, well
 * within the cache's 500.
 */
export function SavePicturesButton({ board }: { board: BoardView }) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<PictureProgress>();
  const [running, setRunning] = useState(false);
  const save = async () => {
    setRunning(true);
    try {
      await savePictures(board.pictures, setProgress);
    } finally {
      setRunning(false);
    }
  };
  return (
    <button type="button" data-icon="offline" disabled={running} onClick={() => void save()}>
      {progress === undefined
        ? t('offline.save')
        : t(
            running
              ? 'offline.saving'
              : progress.failed > 0
                ? 'offline.savedSome'
                : 'offline.saved',
            { count: progress.saved, total: progress.total, failed: progress.failed },
          )}
    </button>
  );
}
