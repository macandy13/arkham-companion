import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TransformComponent, TransformWrapper, useControls } from 'react-zoom-pan-pinch';
import type { BoardView, Edge, GridCell, InstanceId, MapId, MapView } from '@arkham/engine';
import type { GameActions } from '../state/gameActions';
import { LocationTile, Pawn } from './LocationTile';
import { connectionEnds, drawingSize, tileCells, tileOrigin } from './mapLayout';
import { usePawnDrag } from './usePawnDrag';
import './map.css';

/**
 * The visible maps of the open game, each drawn as an SVG of its location tiles at their book
 * layout cells (`MapView.cells`) and the connections between them. Hidden maps are areas the
 * players cannot see yet, and a map whose locations have all left play (The Gathering's Study
 * once the house opens) has nothing to draw, so both are left out. Several maps get a tab each
 * and show one at a time, since each map is drawn to fill the map area. It takes the whole
 * `board`, since the pieces on the tiles come from all over it (investigators now, more pieces
 * later). The players pan, zoom and pinch each map, and move by dragging a pawn (`MapDrawing`),
 * which plays `actions`.
 */
export function MapBoard({ board, actions }: { board: BoardView; actions: GameActions }) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const [chosen, setChosen] = useState<MapId>();
  const shown = board.maps.filter((map) => map.visible && map.locations.length > 0);
  // A chosen map whose locations have all left play is no longer shown, so the first one is.
  const current = shown.find((map) => map.id === chosen) ?? shown[0];
  if (!current) return null;
  if (shown.length === 1) return <MapDrawing map={current} board={board} actions={actions} />;

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
        <MapDrawing key={current.id} map={current} board={board} actions={actions} />
      </div>
    </>
  );
}

/** Furthest the players can zoom into a map, as a multiple of the drawing fitted to the area. */
const MAX_ZOOM = 4;

/**
 * One map as a figure: its name, zoom buttons and the SVG drawing, which the players pan with a
 * drag, zoom with the wheel or a pinch, and fit back with "Fit map". The drawing starts fitted to
 * the map area, and zooming out never goes below that, so the whole map is always one tap away.
 * The pawn of the investigator whose turn it is can be dragged to another location, which is a
 * move action (`GameActions.moveTo`); the other pawns stay put, as only that investigator acts.
 */
function MapDrawing({
  map,
  board,
  actions,
}: {
  map: MapView;
  board: BoardView;
  actions: GameActions;
}) {
  const investigators = board.investigators;
  const captionId = useId();
  const arrowId = useId();
  const svg = useRef<SVGSVGElement>(null);
  const cells = tileCells(map);
  const drag = usePawnDrag(svg, cells, (location) => void actions.moveTo(location));
  const mover = investigators.find(({ id }) => id === board.turn);
  const { width, height } = drawingSize(Object.values(cells));
  return (
    <figure aria-labelledby={captionId}>
      <figcaption id={captionId}>{map.name}</figcaption>
      <TransformWrapper maxScale={MAX_ZOOM} panning={{ excluded: ['[data-drag]'] }}>
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
                      investigators={investigators.filter(({ id }) =>
                        location.investigators?.includes(id),
                      )}
                      movable={mover?.id}
                      drag={drag.handlers(location.id)}
                      {...tileOrigin(cell)}
                    />,
                  ]
                : [];
            })}
            {/* Drawn last, so the dragged pawn passes over the tiles rather than under them. */}
            {mover && drag.ghost && <Pawn investigator={mover} centre={drag.ghost} ghost />}
          </svg>
        </TransformComponent>
      </TransformWrapper>
    </figure>
  );
}

/** The zoom buttons of the map whose `TransformWrapper` they sit in. */
function ZoomControls() {
  const { t } = useTranslation();
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div role="toolbar" aria-label={t('map.zoom')}>
      <button type="button" onClick={() => zoomIn()}>
        {t('map.zoomIn')}
      </button>
      <button type="button" onClick={() => zoomOut()}>
        {t('map.zoomOut')}
      </button>
      <button type="button" onClick={() => resetTransform()}>
        {t('map.fit')}
      </button>
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
