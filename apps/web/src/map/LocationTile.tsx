import { useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  BoardView,
  EnemyView,
  InvestigatorView,
  LocationSymbol,
  LocationView,
  MapEnemyView,
  PrintedActionView,
  ScaledValue,
} from '@arkham/engine';
import { LOCATION_ART, PORTRAIT_SCAN, artViewBox } from '../catalog/cardArt';
import {
  CardFaceCorners,
  CountCircle,
  SCAN_TO_TILE,
  SetMedallion,
  TILE_PER_SCAN,
} from '../catalog/cardFace';
import { useCardPicture } from '../catalog/cardImages';
import { cardActionCaption } from '../screens/ActionRow';
import { LOCATION_FACE, LocationOrnament } from './cardOrnament';
import { connectionGlyph } from './connectionSymbol';
import {
  ART_WINDOW,
  ATTACHMENT,
  attachmentOrigin,
  BADGE_RADIUS,
  CONTENT,
  damageBadgeCentre,
  isTap,
  leadMarkerPoints,
  piecesOnTile,
  TEXT_BOX,
  TILE,
  type Point,
} from './mapLayout';
import type { DragHandlers } from './usePieceDrag';
import { shrinkAround, useShrinkToFit } from './useShrinkToFit';

/** A piece standing on a tile that the players may drag: an investigator's pawn or an enemy. */
export type TilePiece = { investigator: InvestigatorView } | { enemy: MapEnemyView };

/**
 * One location as a tile at (`x`, `y`), drawn as a card face in layers, laid out like the printed
 * location card: a face for the side the location shows (revealed or not), the art area across its
 * width with that side's pattern, and over it the card face in scan units (`data-face`,
 * `LOCATION_FACE`): the frame of the printed cards (`LocationOrnament`), the name on the name
 * plate and the type under the set medallion. When the side has a picture
 * (`LocationView.image`), it shows once it has loaded (`data-picture`), in the theme the players
 * chose (`Settings.cardTheme`): the card's art cut out into the art window (`ART_WINDOW`, the
 * nested `svg`), or the whole card over the face (the `image`), with the frame, the texts and the
 * shroud the picture prints hidden. Both load the same address, so the browser fetches it once;
 * the stylesheet shows the one for the look. On the face lies what the game tracks: once revealed
 * the shroud (with what attachments add) on the left end of the page's edge and the printed clue
 * value on the right with the clues left on it (`CountCircle`), doom under the clues when it has
 * any; over the face its attachments peeking out at the right edge as small cards and the actions
 * it prints in the text box (`PrintedActions`); then a
 * pawn per investigator there and a round token per enemy at it, in rows along the bottom edge,
 * each enemy engaged with an investigator right after their pawn (`piecesOnTile`).
 * `enemies` and `investigators` are the open game's pieces at this location, and `turnOrder`
 * says whose pawns carry the lead and turn markers; `dragOf` gives the drag handlers of each
 * piece that can be dragged now. A tap on the tile, or its details button in
 * the top right corner, calls `onOpen`; a press that moves further (`isTap`: a pan, a piece
 * dragged) is no tap. Without `onOpen` (the card in the location details) it has neither.
 */
export function LocationTile({
  location,
  enemies,
  investigators,
  turnOrder,
  dragOf,
  onOpen,
  x,
  y,
}: {
  location: LocationView;
  enemies: readonly MapEnemyView[];
  investigators: readonly InvestigatorView[];
  turnOrder: TurnOrder;
  dragOf: (piece: TilePiece) => DragHandlers | undefined;
  onOpen?: () => void;
  x: number;
  y: number;
}) {
  const { t } = useTranslation();
  const picture = useCardPicture(location.image);
  const { pieces, separator } = piecesOnTile(investigators, enemies);
  const pressedAt = useRef<Point>(undefined);
  const onPointerDown = (event: PointerEvent<SVGGElement>) => {
    pressedAt.current = { x: event.clientX, y: event.clientY };
  };
  const onClick = (event: MouseEvent<SVGGElement>) => {
    const from = pressedAt.current;
    pressedAt.current = undefined;
    if (from && !isTap(from, { x: event.clientX, y: event.clientY })) return;
    onOpen?.();
  };

  return (
    <g
      role="group"
      aria-label={location.name}
      data-card="location"
      data-side={location.revealed ? 'revealed' : 'unrevealed'}
      data-picture={picture?.shown ? 'shown' : undefined}
      transform={`translate(${x} ${y})`}
      onPointerDown={onOpen && onPointerDown}
      onClick={onOpen && onClick}
    >
      <rect width={TILE.width} height={TILE.height} />
      <rect {...ART_WINDOW} />
      {picture && (
        <>
          <svg
            {...ART_WINDOW}
            viewBox={artViewBox(LOCATION_ART)}
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
      <g data-face="" transform={SCAN_TO_TILE} clipPath="url(#card-face-corners)">
        <LocationOrnament />
        <NameBand location={location} />
        {location.revealed && (
          <>
            <Token
              kind="shroud"
              value={location.shroud}
              label={t('map.shroud', { shroud: location.shroud })}
              centre={LOCATION_FACE.shroud}
            />
            <ClueValue printed={location.printedClues} />
            <CountCircle
              kind="clue"
              value={location.clues}
              label={t('map.clues', { count: location.clues })}
              centre={LOCATION_FACE.count}
            />
          </>
        )}
        {location.doom ? (
          <Token
            kind="doom"
            value={location.doom}
            label={t('map.doom', { count: location.doom })}
            centre={LOCATION_FACE.doom}
          />
        ) : null}
      </g>
      {location.symbol && <ConnectionSymbol symbol={location.symbol} />}
      {onOpen && <DetailsButton location={location} onOpen={onOpen} />}
      {location.attachments?.map((name, i) => (
        <Attachment key={`${name}-${i}`} name={name} origin={attachmentOrigin(i)} />
      ))}
      {location.revealed && location.printedActions && (
        <PrintedActions actions={location.printedActions} />
      )}
      {pieces.map((piece) =>
        'investigator' in piece ? (
          <Pawn
            key={piece.investigator.id}
            investigator={piece.investigator}
            centre={piece.centre}
            lead={turnOrder.lead === piece.investigator.id}
            onTurn={turnOrder.turn === piece.investigator.id}
            drag={dragOf({ investigator: piece.investigator })}
          />
        ) : (
          <EnemyToken
            key={piece.enemy.id}
            enemy={piece.enemy}
            investigators={investigators}
            centre={piece.centre}
            engaged={piece.engaged}
            drag={dragOf({ enemy: piece.enemy })}
          />
        ),
      )}
      {separator && (
        <line
          data-separator
          x1={separator.from.x}
          y1={separator.from.y}
          x2={separator.to.x}
          y2={separator.to.y}
        />
      )}
    </g>
  );
}

/**
 * The fills of a tile drawn in the printed cards' style: a hatch for the art area while it has no
 * card image, one per side of a location card, so a revealed tile reads apart from an unrevealed
 * one at a glance; the shading of the name plate (`card-plate`, darker towards its foot) and of
 * the page (`card-page`, lightest in the middle, like the printed paper); and the paper's grain
 * (`card-paper`, a pattern the size of a scan filled by the `card-paper-grain` noise filter:
 * large faint foxing and a fine grain), which the frame lays over its plate and page. They are
 * drawn once per map drawing, in its `defs`; the stylesheet fills each tile's parts by these ids
 * and colours the gradients' stops. The ids are fixed rather than `useId`, since the
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
        width={PORTRAIT_SCAN.width}
        height={PORTRAIT_SCAN.height}
        patternUnits="userSpaceOnUse"
      >
        <rect width={PORTRAIT_SCAN.width} height={PORTRAIT_SCAN.height} />
      </pattern>
      <linearGradient id="card-plate" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" />
        <stop offset="1" />
      </linearGradient>
      <radialGradient id="card-page" cx="0.5" cy="0.45" r="0.7">
        <stop offset="0" />
        <stop offset="1" />
      </radialGradient>
      <CardFaceCorners />
    </>
  );
}

/**
 * The face's name and type, in scan units: the location's name on the name plate, centred like
 * the printed name and shrunk to fit its width when it is long, so it never reaches the
 * connection symbol or the details button, and on the plate under the set medallion "Location",
 * or on an unrevealed tile "Unrevealed", since that side shows no shroud or clues.
 */
function NameBand({ location }: { location: LocationView }) {
  const { t } = useTranslation();
  const name = useRef<SVGTextElement>(null);
  const { x, y, width } = LOCATION_FACE.name;
  const scale = useShrinkToFit(name, width, location.name);
  const { medallion } = LOCATION_FACE;
  return (
    <>
      <text ref={name} x={x} y={y} transform={shrinkAround({ x, y }, scale)}>
        {location.name}
      </text>
      <SetMedallion
        centre={medallion}
        radius={medallion.radius}
        plateWidth={medallion.plateWidth}
        type={t(location.revealed ? 'map.location' : 'map.unrevealed')}
      />
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
 * A printed disc with its number on the face, in scan units, centred on `centre`: the shroud, or
 * the doom on the location. `kind` (`data-token`) lets the stylesheet colour each like the card
 * prints it or its token on the table.
 */
function Token({ kind, value, label, centre: { x, y } }: TokenCount & { centre: Point }) {
  return (
    <g role="img" aria-label={label} data-token={kind}>
      <circle cx={x} cy={y} r={LOCATION_FACE.disc.radius} />
      <text x={x} y={y}>
        {value}
      </text>
    </g>
  );
}

/**
 * The clue value the location prints (`LocationView.printedClues`) on its clue disc, in scan
 * units: the number, followed by the per investigator symbol when it scales with the players
 * ("2 per investigator"), and a value that does both as "1+2". The clues left are the count
 * circle on it, so this is only what the card prints.
 */
function ClueValue({ printed: { fixed, perInvestigator } }: { printed: ScaledValue }) {
  const { t } = useTranslation();
  const { x, y } = LOCATION_FACE.clues;
  const value =
    perInvestigator === 0
      ? `${fixed}`
      : fixed === 0
        ? `${perInvestigator}`
        : `${fixed}+${perInvestigator}`;
  const label = t(perInvestigator === 0 ? 'map.clueValue' : 'map.clueValuePerInvestigator', {
    value,
  });
  // The symbol takes the disc's right half, so the number moves left to make room for it.
  const shift = perInvestigator === 0 ? 0 : PER_INVESTIGATOR_SIZE / 2;
  return (
    <g role="img" aria-label={label} data-token="clue-value">
      <circle cx={x} cy={y} r={LOCATION_FACE.disc.radius} />
      <text x={x - shift} y={y}>
        {value}
      </text>
      {perInvestigator !== 0 && (
        <foreignObject
          x={x + shift}
          y={y - PER_INVESTIGATOR_SIZE / 2}
          width={PER_INVESTIGATOR_SIZE}
          height={PER_INVESTIGATOR_SIZE}
        >
          <span data-symbol="per_investigator" />
        </foreignObject>
      )}
    </g>
  );
}

/** The per investigator symbol on a clue disc, in scan units, as printed beside the number. */
const PER_INVESTIGATOR_SIZE = 12;

/**
 * The action abilities the location prints (`LocationView.printedActions`), a line each in the
 * text box as on the printed card: the action or free symbol, then its name ("Resign."). They show
 * whoever may take them; taking one is the location details' or the turn row's. HTML in a
 * `foreignObject`, like the enemy card's text, so a long line wraps.
 */
function PrintedActions({ actions }: { actions: readonly PrintedActionView[] }) {
  const { t } = useTranslation();
  return (
    <foreignObject {...TEXT_BOX}>
      <div data-part="text">
        {actions.map((action, index) => {
          const symbol = action.free ? 'free' : 'action';
          return (
            <p key={index}>
              <span role="img" aria-label={t(`symbol.${symbol}`)} data-symbol={symbol} />{' '}
              {t('map.printedAction', { action: cardActionCaption(t, action) })}
            </p>
          );
        })}
      </div>
    </foreignObject>
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
 * The location's connection symbol (`LocationView.symbol`) in the tile's top left corner, as on the
 * printed card: a small disc in the symbol's colour with a light glyph, where the card prints it
 * (`CORNER_DISC`) unless a drawing of its own gives it a `centre` (the location mode's
 * neighbours). Named for screen readers, since its shape alone says nothing.
 */
export function ConnectionSymbol({
  symbol,
  centre = CORNER_DISC,
}: {
  symbol: LocationSymbol;
  centre?: Point;
}) {
  const { t } = useTranslation();
  return (
    <g
      role="img"
      aria-label={t('map.connectionSymbol', { symbol: t(`map.symbols.${symbol}`) })}
      data-connection={symbol}
      transform={`translate(${centre.x} ${centre.y})`}
    >
      <circle r={CONNECTION_RADIUS} />
      <path d={connectionGlyph(symbol, CONNECTION_GLYPH_SIZE)} />
    </g>
  );
}

/**
 * Where a tile's top left corner disc sits, the connection symbol, and its details button mirrored
 * in the top right one: at (25, 18) of a scan with a radius of 13.5, as the card prints the symbol.
 */
const CORNER_DISC: Point = { x: 25 * TILE_PER_SCAN, y: 18 * TILE_PER_SCAN };

/** The symbol's disc, as large as the printed one beside the name. */
export const CONNECTION_RADIUS = 13.5 * TILE_PER_SCAN;

/** The glyph's reach from the disc's centre: a third of the disc, like the printed one. */
const CONNECTION_GLYPH_SIZE = CONNECTION_RADIUS / 3;

/**
 * The tile's details button, a round button with an "i" in its top right corner, across the name
 * from the connection symbol, named after the location. It is the keyboard's way to the
 * details, which a tap on the tile also opens. It is an SVG group rather than an HTML button,
 * since it sits inside the drawing, so it takes the keyboard (Enter, Space) itself; its click is
 * the tile's, which opens the details.
 */
function DetailsButton({ location, onOpen }: { location: LocationView; onOpen: () => void }) {
  const { t } = useTranslation();
  const radius = CONNECTION_RADIUS;
  const x = TILE.width - CORNER_DISC.x;
  const y = CORNER_DISC.y;
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

/** Who leads and whose turn it is, which the pawns show (`BoardView.lead`, `BoardView.turn`). */
export type TurnOrder = Pick<BoardView, 'lead' | 'turn'>;

/**
 * An investigator's pawn (`data-pawn`): a circle with their initial, centred on `centre`. The
 * `lead` investigator's pawn carries a pentagon like the game's lead investigator token, and the
 * pawn of the investigator whose turn it is (`onTurn`, `data-turn`) a bolder ring; both are also
 * in its name. With `drag` it can be dragged (`usePieceDrag`); a `ghost` is the copy that follows
 * the pointer.
 */
export function Pawn({
  investigator,
  centre,
  lead = false,
  onTurn = false,
  drag,
  ghost = false,
}: {
  investigator: InvestigatorView;
  centre: Point;
  lead?: boolean;
  onTurn?: boolean;
  drag?: DragHandlers;
  ghost?: boolean;
}) {
  const { t } = useTranslation();
  const { x, y } = centre;
  const name = [
    investigator.name,
    ...(lead ? [t('map.lead')] : []),
    ...(onTurn ? [t('map.onTurn')] : []),
  ].join(', ');
  return (
    <g
      data-pawn
      data-turn={onTurn || undefined}
      {...dragAttributes({ name, kind: 'pawn', drag, ghost })}
    >
      <circle cx={x} cy={y} r={CONTENT.pawnRadius} />
      <text x={x} y={y}>
        {investigator.name.charAt(0)}
      </text>
      {lead && (
        <polygon
          data-marker="lead"
          points={leadMarkerPoints(centre)
            .map((corner) => `${corner.x},${corner.y}`)
            .join(' ')}
        />
      )}
    </g>
  );
}

/**
 * An enemy as a round token with its initial, centred on `centre`, like an investigator's pawn but
 * ringed in the doom colour (`data-enemy`). An `engaged` enemy stands faded right after the pawn
 * of the investigator it is engaged with (`data-engaged`), since the threat area shows it in full.
 * A red badge on its rim shows its damage, and an exhausted enemy's initial lies on its side, like
 * the exhausted card turned sideways (`data-exhausted`). Its accessible name says the same, with
 * whom of `investigators` it is engaged with. With `drag` it can be dragged; a `ghost` is the copy
 * that follows the pointer.
 */
export function EnemyToken({
  enemy,
  investigators,
  centre,
  engaged = false,
  drag,
  ghost = false,
}: {
  enemy: MapEnemyView;
  investigators: readonly InvestigatorView[];
  centre: Point;
  engaged?: boolean;
  drag?: DragHandlers;
  ghost?: boolean;
}) {
  const { t } = useTranslation();
  const engagedWith = investigators.find(({ id }) => id === enemy.engagedWith)?.name;
  const states = [
    ...(engagedWith ? [t('map.engagedWith', { investigator: engagedWith })] : []),
    ...enemyConditions(enemy, t),
  ];
  const badge = damageBadgeCentre(centre);
  return (
    <g
      data-enemy
      data-engaged={engaged || undefined}
      data-exhausted={enemy.exhausted || undefined}
      {...dragAttributes({ name: [enemy.name, ...states].join(', '), kind: 'enemy', drag, ghost })}
    >
      <circle cx={centre.x} cy={centre.y} r={CONTENT.pawnRadius} />
      <text x={centre.x} y={centre.y}>
        {enemy.name.charAt(0)}
      </text>
      {enemy.damage ? (
        <g data-marker="damage">
          <circle cx={badge.x} cy={badge.y} r={BADGE_RADIUS} />
          <text x={badge.x} y={badge.y}>
            {enemy.damage}
          </text>
        </g>
      ) : null}
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
