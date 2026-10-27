import { useTranslation } from 'react-i18next';
import type { EncounterCardView } from '@arkham/engine';

/**
 * Asks the players to tap the location on the map where `enemy` spawns (`OpenGame.spawning`),
 * with a button that cancels the spawn (`onCancel`).
 */
export function SpawnPrompt({
  enemy,
  onCancel,
}: {
  enemy: EncounterCardView;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <aside role="status" aria-label={t('encounter.spawnLabel')}>
      <p>{t('encounter.spawnPrompt', { card: enemy.name })}</p>
      <button type="button" onClick={onCancel}>
        {t('encounter.cancelSpawn')}
      </button>
    </aside>
  );
}
