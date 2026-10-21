import { useTranslation } from 'react-i18next';
import type { SkippedEffect } from '../state/gameSession';

/**
 * Tells the players which card effects the last action skipped because a card they name is not
 * in the game exactly once (`OpenGame.skippedEffects`), so they resolve those by hand. An effect
 * without its own text falls back to a general one, so a new ability command never shows a raw key.
 */
export function SkippedEffectsNotice({
  skipped,
  onDismiss,
}: {
  skipped: readonly SkippedEffect[];
  onDismiss: () => void;
}) {
  const { t } = useTranslation();

  return (
    <aside role="status" aria-label={t('skipped.label')}>
      <ul>
        {skipped.map((effect, index) => (
          // The same effect can be skipped twice in one step, so the position keeps the keys apart.
          <li key={index}>
            {t('skipped.effect', {
              card: effect.card,
              effect: t(`skipped.effects.${effect.effect}`, {
                defaultValue: t('skipped.anEffect'),
              }),
              missing: effect.missing.join(', '),
            })}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onDismiss}>
        {t('skipped.dismiss')}
      </button>
    </aside>
  );
}
