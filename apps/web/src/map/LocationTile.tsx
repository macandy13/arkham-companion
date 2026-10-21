import { useTranslation } from 'react-i18next';
import type { EnemyView, InvestigatorId, InvestigatorView, LocationView } from '@arkham/engine';
import { TILE, type Point } from './mapLayout';
import type { PawnDragHandlers } from './usePawnDrag';

/**
 * Where a tile's contents sit, in SVG user units from its top left corner: text lines one
 * `line` apart from the top, enemy chips below them, investigator pawns in a row along the
 * bottom edge.
 */
const CONTENT = { inset: 10, line: 24, chip: 28, pawnRadius: 14, pawnGap: 6 } as const;

/**
 * One location as a tile at (`x`, `y`): its name, its shroud and clues once revealed (both are
 * on the revealed side), its doom and attachments when it has any, a chip per enemy at it and a
 * pawn per investigator there. `enemies` and `investigators` are the open game's pieces at this
 * location; the pawn of `movable`, if it stands here, can be dragged with `drag`'s handlers.
 */
export function LocationTile({
  location,
  enemies,
  investigators,
  movable,
  drag,
  x,
  y,
}: {
  location: LocationView;
  enemies: readonly EnemyView[];
  investigators: readonly InvestigatorView[];
  movable?: InvestigatorId;
  drag: PawnDragHandlers;
  x: number;
  y: number;
}) {
  const { t } = useTranslation();
  const lines = [
    location.name,
    location.revealed
      ? t('map.revealed', { shroud: location.shroud, clues: location.clues })
      : t('map.unrevealed'),
    ...(location.doom ? [t('map.doom', { count: location.doom })] : []),
    ...(location.attachments ? [t('map.attachments', { count: location.attachments.length })] : []),
  ];
  const chipsTop = CONTENT.line * (lines.length + 0.5);
  const pawnsY = TILE.height - CONTENT.inset - CONTENT.pawnRadius;

  return (
    <g role="group" aria-label={location.name} transform={`translate(${x} ${y})`}>
      <rect width={TILE.width} height={TILE.height} />
      {lines.map((line, i) => (
        <text key={i} x={TILE.width / 2} y={CONTENT.line * (i + 1)}>
          {line}
        </text>
      ))}
      {enemies.map((enemy, i) => (
        <EnemyChip
          key={i}
          enemy={enemy}
          investigators={investigators}
          y={chipsTop + i * (CONTENT.chip + CONTENT.pawnGap)}
        />
      ))}
      {investigators.map((investigator, i) => (
        <Pawn
          key={investigator.id}
          investigator={investigator}
          centre={{ x: pawnX(i), y: pawnsY }}
          drag={investigator.id === movable ? drag : undefined}
        />
      ))}
    </g>
  );
}

/**
 * An investigator's pawn: a circle with their initial, centred on `centre`. With `drag` it can
 * be dragged (`usePawnDrag`), and its `data-drag` keeps the map from panning when a drag starts
 * on it. A `ghost` (`data-ghost`) is the copy that follows the pointer during a drag; it is hidden from
 * assistive technology, since the pawn itself stays in place until the move is played.
 */
export function Pawn({
  investigator,
  centre: { x, y },
  drag,
  ghost = false,
}: {
  investigator: InvestigatorView;
  centre: Point;
  drag?: PawnDragHandlers;
  ghost?: boolean;
}) {
  return (
    <g
      {...(ghost
        ? { 'aria-hidden': true, 'data-ghost': true }
        : { role: 'img', 'aria-label': investigator.name })}
      {...(drag && { 'data-drag': 'pawn', ...drag })}
    >
      <circle cx={x} cy={y} r={CONTENT.pawnRadius} />
      <text x={x} y={y}>
        {investigator.name.charAt(0)}
      </text>
    </g>
  );
}

/** The centre of the `index`th pawn in the row along the tile's bottom edge. */
function pawnX(index: number): number {
  return CONTENT.inset + CONTENT.pawnRadius + index * (2 * CONTENT.pawnRadius + CONTENT.pawnGap);
}

/**
 * An enemy as a chip across the tile with its name. Its accessible name also says whom it is
 * engaged with, its damage and whether it is exhausted; the chip does not show those yet.
 */
function EnemyChip({
  enemy,
  investigators,
  y,
}: {
  enemy: EnemyView;
  investigators: readonly InvestigatorView[];
  y: number;
}) {
  const { t } = useTranslation();
  const engagedWith = investigators.find(({ id }) => id === enemy.engagedWith)?.name;
  const states = [
    ...(engagedWith ? [t('map.engagedWith', { investigator: engagedWith })] : []),
    ...(enemy.damage ? [t('map.damage', { count: enemy.damage })] : []),
    ...(enemy.exhausted ? [t('map.exhausted')] : []),
  ];
  return (
    <g role="img" aria-label={[enemy.name, ...states].join(', ')}>
      <rect x={CONTENT.inset} y={y} width={TILE.width - 2 * CONTENT.inset} height={CONTENT.chip} />
      <text x={TILE.width / 2} y={y + CONTENT.chip / 2}>
        {enemy.name}
      </text>
    </g>
  );
}
