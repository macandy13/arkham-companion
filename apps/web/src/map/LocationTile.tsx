import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { InvestigatorView, LocationView, MapEnemyView } from '@arkham/engine';
import { useCardPicture } from '../catalog/cardImages';
import {
  BADGE_CENTRE,
  CHIPS_TOP,
  CONTENT,
  pawnOffset,
  TILE,
  tokenOffset,
  type Point,
} from './mapLayout';
import type { DragHandlers } from './usePieceDrag';

/** A piece standing on a tile that the players may drag: an investigator's pawn or an enemy. */
export type TilePiece = { investigator: InvestigatorView } | { enemy: MapEnemyView };

/**
 * One location as a tile at (`x`, `y`), drawn as a card face in layers: a frame, an art area with
 * a pattern for the side the location shows (revealed or not), and a name band along the top.
 * When the side has a picture (`LocationView.image`), it covers the face once it has loaded
 * (`data-picture`), and the stylesheet hides the name band and shroud badge the picture prints.
 * Over them lies what the game tracks: the shroud badge once revealed (shroud is on the revealed
 * side), a token each for its clues once revealed, its doom and its attachments when it has
 * any, a chip per enemy at it and a pawn per investigator there. `enemies` and `investigators`
 * are the open game's pieces at this location; `dragOf` gives the drag handlers of each piece
 * that can be dragged now. Its edit button at the right end of the name band calls `onEdit`.
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
  const picture = useCardPicture(location.image);
  const tokens: TokenCount[] = [];
  if (location.revealed)
    tokens.push({
      kind: 'clue',
      value: location.clues,
      label: t('map.clues', { count: location.clues }),
    });
  if (location.doom)
    tokens.push({
      kind: 'doom',
      value: location.doom,
      label: t('map.doom', { count: location.doom }),
    });
  if (location.attachments)
    tokens.push({
      kind: 'attachments',
      value: location.attachments.length,
      label: t('map.attachments', { count: location.attachments.length }),
    });

  return (
    <g
      role="group"
      aria-label={location.name}
      data-card="location"
      data-side={location.revealed ? 'revealed' : 'unrevealed'}
      data-picture={picture?.shown ? 'shown' : undefined}
      transform={`translate(${x} ${y})`}
    >
      <rect width={TILE.width} height={TILE.height} />
      <rect
        x={CONTENT.inset}
        y={CONTENT.band}
        width={TILE.width - 2 * CONTENT.inset}
        height={TILE.height - CONTENT.band - CONTENT.inset}
      />
      {picture && (
        <image
          href={picture.url}
          width={TILE.width}
          height={TILE.height}
          preserveAspectRatio="xMidYMid slice"
          onLoad={picture.onLoad}
          onError={picture.onError}
        />
      )}
      <NameBand location={location} />
      <EditButton location={location} onEdit={onEdit} />
      {location.revealed && (
        <Token
          kind="shroud"
          value={location.shroud}
          label={t('map.shroud', { shroud: location.shroud })}
          centre={BADGE_CENTRE}
        />
      )}
      {tokens.map((token, i) => (
        <Token key={token.kind} {...token} centre={tokenOffset(i)} />
      ))}
      {enemies.map((enemy, i) => (
        <EnemyChip
          key={enemy.id}
          enemy={enemy}
          investigators={investigators}
          centre={{
            x: TILE.width / 2,
            y: CHIPS_TOP + i * (CONTENT.chip + CONTENT.pawnGap) + CONTENT.chip / 2,
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
 * The patterns that fill a tile's art area while it has no card image, one per side of a
 * location card, so a revealed tile reads apart from an unrevealed one at a glance. They are
 * drawn once per map drawing, in its `defs`; the stylesheet fills each art area with the
 * pattern for its tile's side by these ids. The ids are fixed rather than `useId`, since the
 * stylesheet must name them; two drawings mounted at once would repeat them, which is harmless
 * because the patterns are the same.
 */
export function CardPatterns() {
  const size = 2 * CONTENT.inset;
  return (
    <>
      <pattern id="card-art-revealed" width={size} height={size} patternUnits="userSpaceOnUse">
        <path d={`M 0 ${size} L ${size} 0`} />
      </pattern>
      <pattern id="card-art-unrevealed" width={size} height={size} patternUnits="userSpaceOnUse">
        <path d={`M 0 ${size} L ${size} 0 M 0 0 L ${size} ${size}`} />
      </pattern>
    </>
  );
}

/**
 * The tile's name band: the location's name, left of the edit button, and on an unrevealed tile a
 * second line saying so, since the unrevealed side shows no shroud or clues.
 */
function NameBand({ location }: { location: LocationView }) {
  const { t } = useTranslation();
  const buttonLeft = TILE.width - CONTENT.inset - 2 * CONTENT.pawnRadius;
  const x = (CONTENT.inset + buttonLeft) / 2;
  if (location.revealed)
    return (
      <text x={x} y={CONTENT.band / 2}>
        {location.name}
      </text>
    );
  return (
    <>
      <text x={x} y={CONTENT.band / 3}>
        {location.name}
      </text>
      <text x={x} y={(2 * CONTENT.band) / 3}>
        {t('map.unrevealed')}
      </text>
    </>
  );
}

/** What a tile shows as a round token: the kind it counts, its value and its accessible name. */
interface TokenCount {
  kind: 'shroud' | 'clue' | 'doom' | 'attachments';
  value: number;
  label: string;
}

/**
 * A round token or badge with its count, centred on `centre`: the shroud badge or a clue, doom or
 * attachment token. `kind` (`data-token`) lets the stylesheet colour each like its token on the
 * table.
 */
function Token({ kind, value, label, centre: { x, y } }: TokenCount & { centre: Point }) {
  return (
    <g role="img" aria-label={label} data-token={kind}>
      <circle cx={x} cy={y} r={CONTENT.pawnRadius} />
      <text x={x} y={y}>
        {value}
      </text>
    </g>
  );
}

/**
 * The tile's edit button, a round button with a pencil at the right end of its name band, named after the
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
