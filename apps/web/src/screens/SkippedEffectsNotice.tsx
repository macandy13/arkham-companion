import type { DeckStep } from '@arkham/engine';
import { assertNever } from '@arkham/util';
import { useTranslation } from 'react-i18next';
import type { SkippedEffect } from '../state/gameSession';

/**
 * Tells the players which card effects of the last action they resolve by hand
 * (`OpenGame.skippedEffects`): those skipped because a card they name is not in the game exactly
 * once, and steps on an investigator's own deck. A skipped effect without its own text falls back
 * to a general one, so a new ability command never shows a raw key.
 */
export function SkippedEffectsNotice({
  skipped,
  onDismiss,
}: {
  skipped: readonly SkippedEffect[];
  onDismiss: () => void;
}) {
  const { t } = useTranslation();

  const describe = (effect: SkippedEffect): string => {
    if (effect.kind === 'missingCard')
      return t('skipped.effect', {
        card: effect.card,
        effect: t(`skipped.effects.${effect.effect}`, { defaultValue: t('skipped.anEffect') }),
        missing: effect.missing.join(', '),
      });
    const what = describeStep(effect.step);
    return t('skipped.deck.step', { investigator: effect.investigator, card: effect.card, what });
  };

  const describeStep = (step: DeckStep): string => {
    switch (step.kind) {
      case 'draw':
        return t('skipped.deck.draw', { count: step.amount });
      case 'search':
        return t(step.top === undefined ? 'skipped.deck.search' : 'skipped.deck.searchTop', {
          traits: step.traits.join(t('skipped.deck.or')),
          top: step.top,
        });
      default:
        return assertNever(step);
    }
  };

  return (
    <aside role="status" aria-label={t('skipped.label')}>
      <ul>
        {skipped.map((effect, index) => (
          // The same effect can be skipped twice in one step, so the position keeps the keys apart.
          <li key={index}>{describe(effect)}</li>
        ))}
      </ul>
      <button type="button" onClick={onDismiss}>
        {t('skipped.dismiss')}
      </button>
    </aside>
  );
}
