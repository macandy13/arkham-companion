import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { EnemyView, InvestigatorView, LocationView, MapEnemyView } from '@arkham/engine';
import { LOCATION_ART, PORTRAIT_SCAN, portraitArtViewBox } from '../catalog/cardArt';
import { useCardPicture } from '../catalog/cardImages';
import {
  ART_WINDOW,
  ATTACHMENT,
  attachmentOrigin,
  CLUES_CENTRE,
  CONTENT,
  DOOM_CENTRE,
  pawnOffset,
  SHROUD_CENTRE,
  TILE,
  type Point,
} from './mapLayout';
import type { DragHandlers } from './usePieceDrag';

/** A piece standing on a tile that the players may drag: an investigator's pawn or an enemy. */
export type TilePiece = { investigator: InvestigatorView } | { enemy: MapEnemyView };

/**
 * One location as a tile at (`x`, `y`), drawn as a card face in layers, laid out like the printed
 * card: a frame, an art area with a pattern for the side the location shows (revealed or not), a
 * name band along the top. When the side has a picture (`LocationView.image`), it shows once it
 * has loaded (`data-picture`), in the look the players chose (`Settings.cardLook`): the card's art
 * cut out into the art window (`ART_WINDOW`, the nested `svg`), or the whole card over the face
 * (the `image`), with the name band and shroud the picture prints hidden. Both load the same
 * address, so the browser fetches it once; the stylesheet shows the one for the look. Over them lies what the game tracks: its attachments peeking out at the right
 * edge as small cards, and once revealed the shroud (with what attachments add) at mid height on
 * the left and the clues on the right, doom under the clues when it has any; then a pawn per
 * investigator there and a round token per enemy at it, in rows along the bottom edge.
 * `enemies` and `investigators` are the open game's pieces at this location; `dragOf` gives the
 * drag handlers of each piece that can be dragged now. Its edit button at the right end of the
 * name band calls `onEdit`.
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
        <>
          <svg
            {...ART_WINDOW}
            viewBox={portraitArtViewBox(LOCATION_ART)}
            preserveAspectRatio="xMidYMid slice"
          >
            <image
              href={picture.url}
              {...PORTRAIT_SCAN}
              preserveAspectRatio="none"
              onLoad={picture.onLoad}
              onError={picture.onError}
            />
          </svg>
          <image
            href={picture.url}
            width={TILE.width}
            height={TILE.height}
            preserveAspectRatio="xMidYMid slice"
            onLoad={picture.onLoad}
            onError={picture.onError}
          />
        </>
      )}
      <NameBand location={location} />
      <EditButton location={location} onEdit={onEdit} />
      {location.attachments?.map((name, i) => (
        <Attachment key={`${name}-${i}`} name={name} origin={attachmentOrigin(i)} />
      ))}
      {location.revealed && (
        <>
          <Token
            kind="shroud"
            value={location.shroud}
            label={t('map.shroud', { shroud: location.shroud })}
            centre={SHROUD_CENTRE}
          />
          <Token
            kind="clue"
            value={location.clues}
            label={t('map.clues', { count: location.clues })}
            centre={CLUES_CENTRE}
          />
        </>
      )}
      {location.doom ? (
        <Token
          kind="doom"
          value={location.doom}
          label={t('map.doom', { count: location.doom })}
          centre={DOOM_CENTRE}
        />
      ) : null}
      {investigators.map((investigator, i) => (
        <Pawn
          key={investigator.id}
          investigator={investigator}
          centre={pawnOffset(i)}
          drag={dragOf({ investigator })}
        />
      ))}
      {enemies.map((enemy, i) => (
        <EnemyToken
          key={enemy.id}
          enemy={enemy}
          investigators={investigators}
          centre={pawnOffset(investigators.length + i)}
          drag={dragOf({ enemy })}
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
  kind: 'shroud' | 'clue' | 'doom';
  value: number;
  label: string;
}

/**
 * A round token with its count, centred on `centre`: the shroud, clues or doom. `kind`
 * (`data-token`) lets the stylesheet colour each like its token on the table, and a count of
 * none is marked (`data-empty`), so a location without clues reads as empty at a glance.
 */
function Token({ kind, value, label, centre: { x, y } }: TokenCount & { centre: Point }) {
  return (
    <g role="img" aria-label={label} data-token={kind} data-empty={value === 0 || undefined}>
      <circle cx={x} cy={y} r={CONTENT.pawnRadius} />
      <text x={x} y={y}>
        {value}
      </text>
    </g>
  );
}

/**
 * A card attached to the location, `name` its printed name, drawn as a small card turned a little and
 * peeking out past the tile's right edge, its top left corner at `origin`.
 */
function Attachment({ name, origin: { x, y } }: { name: string; origin: Point }) {
  const { t } = useTranslation();
  const centre = { x: x + ATTACHMENT.width / 2, y: y + ATTACHMENT.height / 2 };
  return (
    <g
      role="img"
      aria-label={t('map.attached', { card: name })}
      data-attachment
      transform={`rotate(${ATTACHMENT.turn} ${centre.x} ${centre.y})`}
    >
      <rect x={x} y={y} width={ATTACHMENT.width} height={ATTACHMENT.height} />
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
 * An enemy as a round token with its initial, centred on `centre`, like an investigator's pawn but
 * ringed in the doom colour (`data-enemy`). Its accessible name also says whom of
 * `investigators` it is engaged with, its damage and whether it is exhausted; the token does not
 * show those yet. With `drag` it can be dragged; a `ghost` is the copy that follows the pointer.
 */
export function EnemyToken({
  enemy,
  investigators,
  centre: { x, y },
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
    ...enemyConditions(enemy, t),
  ];
  return (
    <g
      data-enemy
      {...dragAttributes({ name: [enemy.name, ...states].join(', '), kind: 'enemy', drag, ghost })}
    >
      <circle cx={x} cy={y} r={CONTENT.pawnRadius} />
      <text x={x} y={y}>
        {enemy.name.charAt(0)}
      </text>
    </g>
  );
}

/**
 * What an enemy token's accessible name says about the enemy besides where it is: its damage and
 * whether it is exhausted. Shared by the map's tokens and the threat area's, so both read alike.
 */
export function enemyConditions(
  enemy: EnemyView,
  t: ReturnType<typeof useTranslation>['t'],
): string[] {
  return [
    ...(enemy.damage ? [t('map.damage', { count: enemy.damage })] : []),
    ...(enemy.exhausted ? [t('map.exhausted')] : []),
  ];
}
