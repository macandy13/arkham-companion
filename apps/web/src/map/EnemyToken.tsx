import { useTranslation } from 'react-i18next';
import type { EnemyView, InvestigatorView, MapEnemyView, InstanceId } from '@arkham/engine';
import { ENEMY_AVATAR, PORTRAIT_SCAN } from '../catalog/cardArt';
import { RisingDelta } from '../catalog/cardFace';
import { type CountChange, useCountChange } from '../screens/countChange';
import { SvgGameToken } from '../tokens/SvgGameToken';
import {
  BADGE_COUNT_RADIUS,
  BADGE_GRIP_RADIUS,
  BADGE_RADIUS,
  CONTENT,
  damageBadgeCentre,
  doomBadgeCentre,
  type Point,
} from './mapLayout';
import { dragAttributes, type DragHandlers } from './usePieceDrag';
import { TokenPicture } from './TokenPicture';

/**
 * An enemy as a round token with its initial, its figure from its card's picture over it once
 * loaded (`TokenPicture`), centred on `centre`, like an investigator's pawn but
 * ringed in the doom colour (`data-enemy`). An `engaged` enemy stands faded right after the pawn
 * of the investigator it is engaged with (`data-engaged`), since the threat area shows it in full.
 * A red badge on its rim shows its damage and one across from it its doom, each pulsing with the
 * change (`RisingDelta`), and an exhausted enemy's initial lies on its side, like
 * the exhausted card turned sideways (`data-exhausted`). Its accessible name says the same, with
 * whom of `investigators` it is engaged with. With `drag` it can be dragged; a `ghost` is the copy
 * that follows the pointer. With `doomDrag` a doom can be dragged off its doom badge instead, and
 * with `damageDrag` a damage off its damage badge. Its id
 * (`data-enemy`) lets a token dropped on it from elsewhere find it (`enemyAt`).
 */
export function EnemyToken({
  enemy,
  investigators,
  centre,
  engaged = false,
  drag,
  doomDrag,
  damageDrag,
  ghost = false,
}: {
  enemy: MapEnemyView;
  investigators: readonly InvestigatorView[];
  centre: Point;
  engaged?: boolean;
  drag?: DragHandlers;
  doomDrag?: DragHandlers | undefined;
  damageDrag?: DragHandlers | undefined;
  ghost?: boolean;
}) {
  const { t } = useTranslation();
  const engagedWith = investigators.find(({ id }) => id === enemy.engagedWith)?.name;
  const states = [
    ...(engagedWith ? [t('map.engagedWith', { investigator: engagedWith })] : []),
    ...enemyConditions(enemy, t),
  ];
  const damageChange = useCountChange(enemy.damage ?? 0);
  const doomChange = useCountChange(enemy.doom ?? 0);
  return (
    <>
      <g
        data-enemy={enemy.id}
        data-engaged={engaged || undefined}
        data-exhausted={enemy.exhausted || undefined}
        {...dragAttributes({
          name: [enemy.name, ...states].join(', '),
          kind: 'enemy',
          drag,
          ghost,
        })}
      >
        <circle cx={centre.x} cy={centre.y} r={CONTENT.pawnRadius} />
        <text x={centre.x} y={centre.y}>
          {enemy.name.charAt(0)}
        </text>
        <TokenPicture
          image={enemy.image}
          area={ENEMY_AVATAR}
          scan={PORTRAIT_SCAN}
          centre={centre}
          radius={CONTENT.pawnRadius}
        />
      </g>
      {/*
        The badges lie beside the token rather than in it, so a press on one reaches the tile under
        it as any other piece's does (the tile tells a tap from a drag by it) without moving the
        enemy too.
      */}
      {enemy.damage ? (
        <Badge
          kind="damage"
          value={enemy.damage}
          change={damageChange}
          centre={damageBadgeCentre(centre)}
          drag={damageDrag}
          beside={{ enemy: enemy.id, engaged, ghost }}
        />
      ) : null}
      {enemy.doom ? (
        <Badge
          kind="doom"
          value={enemy.doom}
          change={doomChange}
          centre={doomBadgeCentre(centre)}
          drag={doomDrag}
          beside={{ enemy: enemy.id, engaged, ghost }}
        />
      ) : null}
    </>
  );
}

/**
 * A count on a piece's rim (`data-marker` with its `kind`) centred on `centre`, pulsing with its
 * `change`. With `drag` a token can be dragged off it (`data-drag`), around a grip a finger
 * catches. Hidden from assistive technology: the piece's accessible name says the count. A badge
 * drawn `beside` an enemy's token rather than in it carries the enemy's id (`data-badge-of`, for
 * `enemyAt`) and fades with the token (`data-engaged`, `data-ghost`).
 */
function Badge({
  kind,
  value,
  change,
  centre: { x, y },
  drag,
  beside,
}: {
  kind: 'damage' | 'doom';
  value: number;
  change: CountChange | undefined;
  centre: Point;
  drag?: DragHandlers | undefined;
  beside?: { enemy: InstanceId; engaged: boolean; ghost: boolean };
}) {
  return (
    <g
      key={change?.key}
      aria-hidden="true"
      data-marker={kind}
      data-changed={change && ''}
      {...(drag && { 'data-drag': kind, ...drag })}
      {...(beside && {
        'data-badge-of': beside.enemy,
        'data-engaged': beside.engaged || undefined,
        'data-ghost': beside.ghost || undefined,
      })}
    >
      {drag && <circle data-part="grip" cx={x} cy={y} r={BADGE_GRIP_RADIUS} />}
      <SvgGameToken
        kind={kind}
        centre={{ x, y }}
        radius={BADGE_RADIUS}
        count={value}
        countRadius={BADGE_COUNT_RADIUS}
      />
      <RisingDelta change={change} x={x} y={y - BADGE_RADIUS} />
    </g>
  );
}

/**
 * What an enemy token's accessible name says about the enemy besides where it is: its damage, its
 * doom and whether it is exhausted. Shared by the map's tokens and the threat area's, so both read alike.
 */
export function enemyConditions(
  enemy: EnemyView,
  t: ReturnType<typeof useTranslation>['t'],
): string[] {
  return [
    ...(enemy.damage ? [t('map.damage', { count: enemy.damage })] : []),
    ...(enemy.doom ? [t('map.doom', { count: enemy.doom })] : []),
    ...(enemy.exhausted ? [t('map.exhausted')] : []),
  ];
}
