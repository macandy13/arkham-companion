import type { MapEnemyView } from '@arkham/engine';
import { useTranslation } from 'react-i18next';
import { CounterBubble, type BubbleCount } from '../screens/CounterBubble';
import type { GameActions } from '../state/gameActions';

/**
 * The − / + bubble a double tap on an enemy opens (M6.10), on the map or in a threat area, titled
 * with its name: its damage, dealt by rule (`GameActions.damageEnemy`, which defeats it at its
 * health) and healed (`healEnemy`), and its doom (`adjustTokens`). Its buttons are off while a
 * step is queued (`busy`).
 */
export function EnemyBubble({
  enemy,
  anchor,
  actions,
  busy,
  onClose,
}: {
  enemy: MapEnemyView;
  anchor: Element;
  actions: GameActions;
  busy: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const damage = enemy.damage ?? 0;
  const doom = enemy.doom ?? 0;
  const counts: BubbleCount[] = [
    {
      label: t('enemy.damageCount'),
      value: String(damage),
      lower: { label: t('enemy.heal'), disabled: busy || damage === 0 },
      raise: { label: t('enemy.damage'), disabled: busy },
      onStep: (delta) =>
        void (delta < 0 ? actions.healEnemy(enemy.id, 1) : actions.damageEnemy(enemy.id, 1)),
    },
    {
      label: t('enemy.doomCount'),
      value: String(doom),
      lower: { label: t('enemy.removeDoom'), disabled: busy || doom === 0 },
      raise: { label: t('enemy.addDoom'), disabled: busy },
      onStep: (delta) => void actions.adjustTokens(enemy.id, 'doom', delta),
    },
  ];
  return <CounterBubble anchor={anchor} title={enemy.name} counts={counts} onClose={onClose} />;
}
