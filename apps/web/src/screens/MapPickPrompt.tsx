import { useTranslation } from 'react-i18next';

/**
 * Asks the players to tap a location on the map (`prompt`, under the notice's `label`): where an
 * enemy spawns or where a card effect moves an investigator (`OpenGame.picking`), with a button that cancels the pick (`onCancel`).
 */
export function MapPickPrompt({
  label,
  prompt,
  onCancel,
}: {
  label: string;
  prompt: string;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <aside role="status" aria-label={label}>
      <p>{prompt}</p>
      <button type="button" onClick={onCancel}>
        {t('games.cancel')}
      </button>
    </aside>
  );
}
