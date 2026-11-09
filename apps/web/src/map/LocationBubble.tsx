import type { LocationView } from '@arkham/engine';
import { useTranslation } from 'react-i18next';
import { CounterBubble, type BubbleCount } from '../screens/CounterBubble';
import type { GameActions } from '../state/gameActions';

/**
 * The − / + bubble a double tap on a location's tile opens (M6.10), titled with its name: its
 * clues once revealed, since an unrevealed location holds none yet, and its doom, also at none,
 * which the tile only shows once there is some. Each step is a correction of the tokens on it
 * (`GameActions.adjustTokens`), as the location details' steppers did while adjusting the board.
 */
export function LocationBubble({
  location,
  anchor,
  actions,
  onClose,
}: {
  location: LocationView;
  anchor: Element;
  actions: GameActions;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const count = (token: 'clue' | 'doom', value: number): BubbleCount => ({
    label: t(`location.${token}.label`),
    value: String(value),
    lower: { label: t(`location.${token}.remove`), disabled: value === 0 },
    raise: { label: t(`location.${token}.add`), disabled: false },
    onStep: (delta) => void actions.adjustTokens(location.id, token, delta),
  });
  const counts = [
    ...(location.revealed ? [count('clue', location.clues)] : []),
    count('doom', location.doom ?? 0),
  ];
  return <CounterBubble anchor={anchor} title={location.name} counts={counts} onClose={onClose} />;
}
