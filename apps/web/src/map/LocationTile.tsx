import { useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { EnemyView, InvestigatorView, LocationView, MapEnemyView } from '@arkham/engine';
import { LOCATION_ART, PORTRAIT_SCAN, portraitArtViewBox } from '../catalog/cardArt';
import { useCardPicture } from '../catalog/cardImages';
import { LocationOrnament, TYPE_PLATE_CENTRE } from './cardOrnament';
import {
  ART_WINDOW,
  ATTACHMENT,
  attachmentOrigin,
  CLUES_CENTRE,
  CONTENT,
  DOOM_CENTRE,
  NAME_WIDTH,
  pawnOffset,
  SHROUD_CENTRE,
  TILE,
  type Point,
} from './mapLayout';
import type { DragHandlers } from './usePieceDrag';
import { shrinkAround, useShrinkToFit } from './useShrinkToFit';

/**
 * How far, in CSS pixels, the pointer may move between pressing and letting go for a tap on a
 * tile; further, it was a pan of the map or a piece dragged, which open nothing.
 */
const TAP_SLOP = 8;

/** A piece standing on a tile that the players may drag: an investigator's pawn or an enemy. */
export type TilePiece = { investigator: InvestigatorView } | { enemy: MapEnemyView };

/**
 * One location as a tile at (`x`, `y`), drawn as a card face in layers, laid out like the printed
 * location card: a face for the side the location shows (revealed or not), the art area across
 * its width with that side's pattern, the frame of the printed cards (`LocationOrnament`) over
 * it, the name on the name plate and the type on the type plate. When the side has a picture
 * (`LocationView.image`), it shows once it has loaded (`data-picture`), in the look the players
 * chose (`Settings.cardLook`): the card's art cut out into the art window (`ART_WINDOW`, the
 * nested `svg`), or the whole card over the face (the `image`), with the frame, the texts and the
 * shroud the picture prints hidden. Both load the same address, so the browser fetches it once;
 * the stylesheet shows the one for the look. Over them lies what the game tracks: its
 * attachments peeking out at the right edge as small cards, and once revealed the shroud (with
 * what attachments add) on the left edge where the art ends and the clues on the right, doom
 * under the clues when it has any; then a pawn per investigator there and a round token per enemy
 * at it, in rows along the bottom edge. `enemies` and `investigators` are the open game's pieces
 * at this location; `dragOf` gives the drag handlers of each piece that can be dragged now. A tap
 * on the tile, or its details button in the top left corner, calls `onOpen`; a press that moves
 * further than `TAP_SLOP` (a pan, a piece dragged) is no tap.
 */
export function LocationTile({
  location,
  enemies,
  investigators,
  dragOf,
  onOpen,
  x,
  y,
}: {
  location: LocationView;
  enemies: readonly MapEnemyView[];
  investigators: readonly InvestigatorView[];
  dragOf: (piece: TilePiece) => DragHandlers | undefined;
  onOpen: () => void;
  x: number;
  y: number;
}) {
  const { t } = useTranslation();
  const picture = useCardPicture(location.image);
  const pressedAt = useRef<Point>(undefined);
  const onPointerDown = (event: PointerEvent<SVGGElement>) => {
    pressedAt.current = { x: event.clientX, y: event.clientY };
  };
  const onClick = (event: MouseEvent<SVGGElement>) => {
    const from = pressedAt.current;
    pressedAt.current = undefined;
    if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) > TAP_SLOP) return;
    onOpen();
  };

  return (
    <g
      role="group"
      aria-label={location.name}
      data-card="location"
      data-side={location.revealed ? 'revealed' : 'unrevealed'}
      data-picture={picture?.shown ? 'shown' : undefined}
      transform={`translate(${x} ${y})`}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <rect width={TILE.width} height={TILE.height} />
      <rect {...ART_WINDOW} />
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
      <LocationOrnament />
      <NameBand location={location} />
      <DetailsButton location={location} onOpen={onOpen} />
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
 * The fills of a tile drawn in the printed cards' style, one set per side of a location card, so
 * a revealed tile reads apart from an unrevealed one at a glance: a parchment gradient for the
 * face (tan on the revealed side, sage on the unrevealed one, like the printed cards) and a hatch
 * for the art area while it has no card image, and the paper's grain (`card-paper`, a pattern
 * the size of a tile filled by the `card-paper-grain` noise filter: large faint foxing and a fine
 * grain), which the frame lays over its plates and text box. They are drawn once per map drawing, in its
 * `defs`; the stylesheet fills each tile with the ones for its side by these ids and colours the
 * gradients' stops. The ids are fixed rather than `useId`, since the
 * stylesheet must name them; two drawings mounted at once would repeat them, which is harmless
 * because the patterns are the same.
 */
export function CardPatterns() {
  const size = 2 * CONTENT.inset;
  return (
    <>
      <pattern id="card-art-revealed" width={size} height={size} patternUnits="userSpaceOnUse">
        <rect width={size} height={size} />
        <path d={`M 0 ${size} L ${size} 0`} />
      </pattern>
      <pattern id="card-art-unrevealed" width={size} height={size} patternUnits="userSpaceOnUse">
        <rect width={size} height={size} />
        <path d={`M 0 ${size} L ${size} 0 M 0 0 L ${size} ${size}`} />
      </pattern>
      {/* The grain's sepia sits in the colour matrices, since filter matrices take no CSS colours. */}
      <filter id="card-paper-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0.36  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 -1.2 0.6"
          result="foxing"
        />
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="3" />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0.3  0 0 0 0 0.2  0 0 0 0 0.1  0 0 0 0.5 -0.15"
        />
        <feMerge>
          <feMergeNode in="foxing" />
          <feMergeNode />
        </feMerge>
      </filter>
      <pattern
        id="card-paper"
        width={TILE.width}
        height={TILE.height}
        patternUnits="userSpaceOnUse"
      >
        <rect width={TILE.width} height={TILE.height} />
      </pattern>
      {(['revealed', 'unrevealed'] as const).map((side) => (
        <linearGradient key={side} id={`card-face-${side}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" />
          <stop offset="1" />
        </linearGradient>
      ))}
    </>
  );
}

/**
 * The tile's name and type: the location's name on the name plate, centred like the printed name
 * and shrunk to fit `NAME_WIDTH` when it is long, so it never reaches the details button, and on the
 * type plate "Location", or on an unrevealed tile "Unrevealed", since that side shows
 * no shroud or clues.
 */
function NameBand({ location }: { location: LocationView }) {
  const { t } = useTranslation();
  const name = useRef<SVGTextElement>(null);
  const scale = useShrinkToFit(name, NAME_WIDTH, location.name);
  const centre = { x: TILE.width / 2, y: CONTENT.band / 2 };
  return (
    <>
      <text ref={name} {...centre} transform={shrinkAround(centre, scale)}>
        {location.name}
      </text>
      <text {...TYPE_PLATE_CENTRE}>{t(location.revealed ? 'map.location' : 'map.unrevealed')}</text>
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
 * The tile's details button, a round button with an "i" in its top left corner, where the printed
 * card shows its connection icon, named after the location. It is the keyboard's way to the
 * details, which a tap on the tile also opens. It is an SVG group rather than an HTML button,
 * since it sits inside the drawing, so it takes the keyboard (Enter, Space) itself; its click is
 * the tile's, which opens the details.
 */
function DetailsButton({ location, onOpen }: { location: LocationView; onOpen: () => void }) {
  const { t } = useTranslation();
  const radius = CONTENT.pawnRadius;
  const x = radius;
  const y = radius;
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onOpen();
  };
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={t('map.details', { location: location.name })}
      onKeyDown={onKeyDown}
    >
      <circle cx={x} cy={y} r={radius} />
      <text x={x} y={y}>
        i
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
 * An investigator's pawn (`data-pawn`): a circle with their initial, centred on `centre`. With `drag` it can
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
    <g data-pawn {...dragAttributes({ name: investigator.name, kind: 'pawn', drag, ghost })}>
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
