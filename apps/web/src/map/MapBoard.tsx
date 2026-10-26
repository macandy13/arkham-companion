import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TransformComponent, TransformWrapper, useControls } from 'react-zoom-pan-pinch';
import type {
  BoardView,
  Edge,
  GridCell,
  InstanceId,
  InvestigatorId,
  MapId,
  MapView,
} from '@arkham/engine';
import { EnemyDetails } from '../enemies/EnemyDetails';
import type { GameActions } from '../state/gameActions';
import { LocationDetails } from './LocationDetails';
import { CardPatterns, EnemyToken, LocationTile, Pawn, type TilePiece } from './LocationTile';
import {
  connectionEnds,
  drawingSize,
  onPawn,
  pawnOffset,
  tileAt,
  tileCells,
  tileOrigin,
  type Point,
} from './mapLayout';
import { usePieceDrag } from './usePieceDrag';
import './map.css';

/**
 * The visible maps of the open game, each drawn as an SVG of its location tiles at their book
 * layout cells (`MapView.cells`) and the connections between them. Hidden maps are areas the
 * players cannot see yet, and a map whose locations have all left play (The Gathering's Study
 * once the house opens) has nothing to draw, so both are left out. Several maps get a tab each
 * and show one at a time, since each map is drawn to fill the map area. It takes the whole
 * `board`, since the pieces on the tiles come from all over it (investigators now, more pieces
 * later). The players pan, zoom and pinch each map, and move pieces by dragging them
 * (`MapDrawing`), which plays `actions`; no piece moves while a step is still queued (`busy`,
 * `OpenGame.busy`), since the turn it was dragged in may have ended by the time the move plays.
 * While the players adjust the board (`adjusting`, `OpenGame.adjusting`), a tile's details offer
 * corrections and the pieces stay put, since a move is a step of play, not a correction.
 */
export function MapBoard({
  board,
  actions,
  busy,
  adjusting,
}: {
  board: BoardView;
  actions: GameActions;
  busy: boolean;
  adjusting: boolean;
}) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const [chosen, setChosen] = useState<MapId>();
  const shown = board.maps.filter((map) => map.visible && map.locations.length > 0);
  // A chosen map whose locations have all left play is no longer shown, so the first one is.
  const current = shown.find((map) => map.id === chosen) ?? shown[0];
  if (!current) return null;
  if (shown.length === 1)
    return (
      <MapDrawing map={current} board={board} actions={actions} busy={busy} adjusting={adjusting} />
    );

  const tabId = (map: MapView) => `${idPrefix}-tab-${map.id}`;
  const panelId = `${idPrefix}-panel`;
  return (
    <>
      <div role="tablist" aria-label={t('map.tabs')}>
        {shown.map((map) => (
          <button
            key={map.id}
            id={tabId(map)}
            type="button"
            role="tab"
            aria-selected={map === current}
            aria-controls={panelId}
            onClick={() => setChosen(map.id)}
          >
            {map.name}
          </button>
        ))}
      </div>
      <div id={panelId} role="tabpanel" aria-labelledby={tabId(current)}>
        {/* Keyed by map, so a newly chosen map starts fitted instead of at the last one's zoom. */}
        <MapDrawing
          key={current.id}
          map={current}
          board={board}
          actions={actions}
          busy={busy}
          adjusting={adjusting}
        />
      </div>
    </>
  );
}

/** Furthest the players can zoom into a map, as a multiple of the drawing fitted to the area. */
const MAX_ZOOM = 4;

/** A piece being dragged on a map, with the location it is dragged from. */
type DraggedPiece = TilePiece & { from: InstanceId };

/**
 * One map as a figure: its name, zoom buttons and the SVG drawing, which the players pan with a
 * drag, zoom with the wheel or a pinch, and fit back with "Fit map". The drawing starts fitted to
 * the map area, and zooming out never goes below that, so the whole map is always one tap away.
 * Pieces are dragged to play what the players do on the table:
 * - The pawn of the investigator whose turn it is, dropped on another location, is a move action
 *   (`GameActions.moveTo`); the other pawns stay put, as only that investigator acts.
 * - An enemy dropped on that pawn is an engage action (`GameActions.engage`).
 * - An enemy dropped on another location moves there as a card instruction says
 *   (`GameActions.moveEnemy`); the players drag it only when a card tells them to, so the map
 *   does not ask which card.
 *
 * A tap on a tile opens its details (`LocationDetails`): what the investigator whose turn it is
 * can do there, or while adjusting the corrections, when no piece is dragged. A tap on an enemy
 * token opens the enemy's details (`EnemyDetails`), the same as from the threat area: with
 * engage, fight and evade when the enemy is at the location of the investigator whose turn it
 * is, since the rules let them fight or evade an enemy there that is not engaged with them.
 */
function MapDrawing({
  map,
  board,
  actions,
  busy,
  adjusting,
}: {
  map: MapView;
  board: BoardView;
  actions: GameActions;
  busy: boolean;
  adjusting: boolean;
}) {
  const investigators = board.investigators;
  const captionId = useId();
  const arrowId = useId();
  const svg = useRef<SVGSVGElement>(null);
  const cells = tileCells(map);
  const mover = investigators.find(({ id }) => id === board.turn);
  const moverCentre = mover && pawnCentre(map, cells, board, mover.id);
  const [detailsFor, setDetailsFor] = useState<InstanceId>();
  const [enemyFor, setEnemyFor] = useState<InstanceId>();
  const drag = usePieceDrag<DraggedPiece>(
    svg,
    (piece, point) => {
      if ('enemy' in piece && moverCentre && onPawn(moverCentre, point)) {
        void actions.engage(piece.enemy.id);
        return;
      }
      const to = tileAt(cells, point);
      if (to === undefined || to === piece.from) return;
      void ('enemy' in piece ? actions.moveEnemy(piece.enemy.id, to) : actions.moveTo(to));
    },
    (piece) => {
      if (!('enemy' in piece)) return false;
      setEnemyFor(piece.enemy.id);
      return true;
    },
  );
  const tappedEnemy = Object.entries(map.enemies).flatMap(([location, enemies]) =>
    enemies.filter(({ id }) => id === enemyFor).map((enemy) => ({ enemy, location })),
  )[0];
  const detailsLocation = map.locations.find(({ id }) => id === detailsFor);
  const draggable = (piece: TilePiece) =>
    !busy && !adjusting && ('enemy' in piece || piece.investigator.id === mover?.id);
  const { width, height } = drawingSize(Object.values(cells));
  return (
    <figure aria-labelledby={captionId}>
      <figcaption id={captionId}>{map.name}</figcaption>
      {/*
        The library joins each exclusion to its wrapper class as both `X` and `.X`, so an entry
        must stay a valid selector after a leading dot: a bare attribute selector would not be,
        and would stop every pan. Draggable pieces and the details buttons start no pan.
      */}
      <TransformWrapper
        maxScale={MAX_ZOOM}
        panning={{ excluded: ['g[data-drag]', 'g[role="button"]'] }}
      >
        <ZoomControls />
        <TransformComponent>
          {/* One user unit is one CSS pixel at most, so a small map keeps its tiles card-sized. */}
          <svg ref={svg} viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
            <defs>
              <marker
                id={arrowId}
                viewBox="0 0 10 10"
                refX="10"
                refY="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
              <CardPatterns />
            </defs>
            {map.connections.map((edge) => (
              <Connection
                key={`${edge.from}-${edge.to}`}
                edge={edge}
                map={map}
                cells={cells}
                arrowId={arrowId}
              />
            ))}
            {map.locations.flatMap((location) => {
              const cell = cells[location.id];
              return cell
                ? [
                    <LocationTile
                      key={location.id}
                      location={location}
                      enemies={map.enemies[location.id] ?? []}
                      investigators={board.investigatorsAt(location.id)}
                      onOpen={() => setDetailsFor(location.id)}
                      dragOf={(piece) =>
                        draggable(piece)
                          ? drag.handlers({ ...piece, from: location.id })
                          : undefined
                      }
                      {...tileOrigin(cell)}
                    />,
                  ]
                : [];
            })}
            {/* Drawn last, so the dragged piece passes over the tiles rather than under them. */}
            {drag.dragged && (
              <Ghost piece={drag.dragged.piece} at={drag.dragged.at} board={board} />
            )}
          </svg>
        </TransformComponent>
      </TransformWrapper>
      {detailsLocation && (
        <LocationDetails
          board={board}
          location={detailsLocation}
          actions={actions}
          busy={busy}
          adjusting={adjusting}
          onClose={() => setDetailsFor(undefined)}
        />
      )}
      {tappedEnemy && (
        <EnemyDetails
          board={board}
          enemy={tappedEnemy.enemy}
          actions={actions}
          onTurn={mover !== undefined && board.locationOf(mover.id) === tappedEnemy.location}
          busy={busy}
          onClose={() => setEnemyFor(undefined)}
        />
      )}
    </figure>
  );
}

/** The copy of a dragged piece that follows the pointer, centred on `at`. */
function Ghost({ piece, at, board }: { piece: TilePiece; at: Point; board: BoardView }) {
  return 'enemy' in piece ? (
    <EnemyToken enemy={piece.enemy} investigators={board.investigators} centre={at} ghost />
  ) : (
    <Pawn investigator={piece.investigator} centre={at} ghost />
  );
}

/**
 * Where the pawn of `investigator` stands on `map`, in the drawing's coordinates: in the row of
 * pawns on their location's tile (`BoardView.investigatorsAt`).
 */
function pawnCentre(
  map: MapView,
  cells: Record<InstanceId, GridCell>,
  board: BoardView,
  investigator: InvestigatorId,
): Point | undefined {
  const location = map.locations.find(({ investigators }) => investigators?.includes(investigator));
  const cell = location && cells[location.id];
  if (!cell) return undefined;
  const index = board.investigatorsAt(location.id).findIndex(({ id }) => id === investigator);
  const tile = tileOrigin(cell);
  const offset = pawnOffset(index);
  return { x: tile.x + offset.x, y: tile.y + offset.y };
}

/**
 * The zoom buttons of the map whose `TransformWrapper` they sit in: icons named for screen
 * readers, small so they float over the map instead of taking a row of it.
 */
function ZoomControls() {
  const { t } = useTranslation();
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div role="toolbar" aria-label={t('map.zoom')}>
      <button
        type="button"
        data-icon="zoom_in"
        aria-label={t('map.zoomIn')}
        onClick={() => zoomIn()}
      />
      <button
        type="button"
        data-icon="zoom_out"
        aria-label={t('map.zoomOut')}
        onClick={() => zoomOut()}
      />
      <button
        type="button"
        data-icon="fit"
        aria-label={t('map.fit')}
        onClick={() => resetTransform()}
      />
    </div>
  );
}

/**
 * One connection as a line between the edges of its tiles, with an arrowhead at the target of a
 * one-way connection. It is named after its locations, so the map's graph reads out as well as
 * it shows.
 */
function Connection({
  edge: { from, to, oneWay },
  map,
  cells,
  arrowId,
}: {
  edge: Edge;
  map: MapView;
  cells: Record<InstanceId, GridCell>;
  arrowId: string;
}) {
  const { t } = useTranslation();
  const fromCell = cells[from];
  const toCell = cells[to];
  if (!fromCell || !toCell) return null;
  const [start, end] = connectionEnds(fromCell, toCell);
  const names = { from: nameOf(map, from), to: nameOf(map, to) };
  return (
    <line
      role="img"
      aria-label={oneWay ? t('map.oneWay', names) : t('map.connection', names)}
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      markerEnd={oneWay ? `url(#${arrowId})` : undefined}
    />
  );
}

function nameOf(map: MapView, id: InstanceId): string {
  return map.locations.find((location) => location.id === id)?.name ?? id;
}
