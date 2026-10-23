import { useTranslation } from 'react-i18next';
import type { CardName, EnemyView } from '@arkham/engine';

/**
 * An investigator's threat area laid along the top edge of their card, like cards placed over it
 * on the table: the treacheries in it as small cards (`InvestigatorView.threatArea`), then the
 * enemies engaged with them as round avatar tokens, as on the map, named with their damage and
 * whether they are exhausted. Nothing while the area is empty, so the card keeps its full face.
 */
export function ThreatArea({
  treacheries,
  enemies,
}: {
  treacheries: readonly CardName[];
  enemies: readonly EnemyView[];
}) {
  const { t } = useTranslation();
  if (treacheries.length === 0 && enemies.length === 0) return null;
  return (
    <ul aria-label={t('investigators.threatArea')}>
      {treacheries.map((name, index) => (
        <li key={`${name}-${index}`} data-threat="treachery">
          {name}
        </li>
      ))}
      {enemies.map((enemy, index) => (
        <li key={`${enemy.name}-${index}`} data-threat="enemy" data-exhausted={enemy.exhausted}>
          <span role="img" aria-label={enemyLabel(enemy, t)}>
            {enemy.name.charAt(0)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The enemy's name with its damage and whether it is exhausted, as the map names its tokens. */
function enemyLabel(enemy: EnemyView, t: ReturnType<typeof useTranslation>['t']): string {
  return [
    enemy.name,
    ...(enemy.damage ? [t('map.damage', { count: enemy.damage })] : []),
    ...(enemy.exhausted ? [t('map.exhausted')] : []),
  ].join(', ');
}
