import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { InvestigatorView, LocationView, MapEnemyView } from '@arkham/engine';
import { CONTENT, pawnOffset, TILE, type Point } from './mapLayout';
import type { DragHandlers } from './usePieceDrag';

/** A piece standing on a tile that the players may drag: an investigator's pawn or an enemy. */
export type TilePiece = { investigator: InvestigatorView } | { enemy: MapEnemyView };

/**
 * One location as a tile at (`x`, `y`): its name, its shroud and clues once revealed (both are
 * on the revealed side), its doom and attachments when it has any, a chip per enemy at it and a
 * pawn per investigator there. `enemies` and `investigators` are the open game's pieces at this
 * location; `dragOf` gives the drag handlers of each piece that can be dragged now. Its edit
 * button in the top right corner calls `onEdit`.
 */
export function LocationTile({
  location,
  enemies,
  investigators,
  dragOf,
  onEdit,
  x,
  y,
}: {
  location: LocationView;
  enemies: readonly MapEnemyView[];
  investigators: readonly InvestigatorView[];
  dragOf: (piece: TilePiece) => DragHandlers | undefined;
  onEdit: () => void;
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

  return (
    <g role="group" aria-label={location.name} transform={`translate(${x} ${y})`}>
      <rect width={TILE.width} height={TILE.height} />
      {lines.map((line, i) => (
        <text key={i} x={TILE.width / 2} y={CONTENT.line * (i + 1)}>
          {line}
        </text>
      ))}
      <EditButton location={location} onEdit={onEdit} />
      {enemies.map((enemy, i) => (
        <EnemyChip
          key={enemy.id}
          enemy={enemy}
          investigators={investigators}
          centre={{
            x: TILE.width / 2,
            y: chipsTop + i * (CONTENT.chip + CONTENT.pawnGap) + CONTENT.chip / 2,
          }}
          drag={dragOf({ enemy })}
        />
      ))}
      {investigators.map((investigator, i) => (
        <Pawn
          key={investigator.id}
          investigator={investigator}
          centre={pawnOffset(i)}
          drag={dragOf({ investigator })}
        />
      ))}
    </g>
  );
}

/**
 * The tile's edit button, a round button with a pencil in its top right corner, named after the
 * location. It is an SVG group rather than an HTML button, since it sits inside the drawing, so it
 * takes the keyboard (Enter, Space) itself.
 */
function EditButton({ location, onEdit }: { location: LocationView; onEdit: () => void }) {
  const { t } = useTranslation();
  const radius = CONTENT.pawnRadius;
  const x = TILE.width - CONTENT.inset - radius;
  const y = CONTENT.inset + radius;
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onEdit();
  };
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={t('map.edit', { location: location.name })}
      onClick={onEdit}
      onKeyDown={onKeyDown}
    >
      <circle cx={x} cy={y} r={radius} />
      <text x={x} y={y}>
        ✎
      </text>
    </g>
  );
}

/**
 * The attributes a piece takes for dragging. A draggable piece is marked `data-drag`, which keeps
 * the map from panning when a drag starts on it. A `ghost` (`data-ghost`) is the copy that follows
 * the pointer during a drag; it is hidden from assistive technology, since the piece itself stays
 * in place until the move is played.
 */
function dragAttributes({
  name,
  kind,
  drag,
  ghost,
}: {
  name: string;
  kind: 'pawn' | 'enemy';
  drag?: DragHandlers;
  ghost: boolean;
}) {
  return {
    ...(ghost ? { 'aria-hidden': true, 'data-ghost': true } : { role: 'img', 'aria-label': name }),
    ...(drag && { 'data-drag': kind, ...drag }),
  };
}

/**
 * An investigator's pawn: a circle with their initial, centred on `centre`. With `drag` it can
 * be dragged (`usePieceDrag`); a `ghost` is the copy that follows the pointer.
 */
export function Pawn({
  investigator,
  centre: { x, y },
  drag,
  ghost = false,
}: {
  investigator: InvestigatorView;
  centre: Point;
  drag?: DragHandlers;
  ghost?: boolean;
}) {
  return (
    <g {...dragAttributes({ name: investigator.name, kind: 'pawn', drag, ghost })}>
      <circle cx={x} cy={y} r={CONTENT.pawnRadius} />
      <text x={x} y={y}>
        {investigator.name.charAt(0)}
      </text>
    </g>
  );
}

/**
 * An enemy as a chip across a tile with its name, centred on `centre`. Its accessible name also
 * says whom of `investigators` it is engaged with, its damage and whether it is exhausted; the
 * chip does not show those yet. With `drag` it can be dragged; a `ghost` is the copy that
 * follows the pointer.
 */
export function EnemyChip({
  enemy,
  investigators,
  centre,
  drag,
  ghost = false,
}: {
  enemy: MapEnemyView;
  investigators: readonly InvestigatorView[];
  centre: Point;
  drag?: DragHandlers;
  ghost?: boolean;
}) {
  const { t } = useTranslation();
  const engagedWith = investigators.find(({ id }) => id === enemy.engagedWith)?.name;
  const states = [
    ...(engagedWith ? [t('map.engagedWith', { investigator: engagedWith })] : []),
    ...(enemy.damage ? [t('map.damage', { count: enemy.damage })] : []),
    ...(enemy.exhausted ? [t('map.exhausted')] : []),
  ];
  const width = TILE.width - 2 * CONTENT.inset;
  return (
    <g
      {...dragAttributes({ name: [enemy.name, ...states].join(', '), kind: 'enemy', drag, ghost })}
    >
      <rect
        x={centre.x - width / 2}
        y={centre.y - CONTENT.chip / 2}
        width={width}
        height={CONTENT.chip}
      />
      <text x={centre.x} y={centre.y}>
        {enemy.name}
      </text>
    </g>
  );
}
