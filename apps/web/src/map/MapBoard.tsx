import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { Edge, GridCell, InstanceId, LocationView, MapView } from '@arkham/engine';
import { TILE, connectionEnds, tileCells, tileOrigin, drawingSize } from './mapLayout';
import './map.css';

/**
 * The visible maps of the open game, each drawn as an SVG of its location tiles at their book
 * layout cells (`MapView.cells`) and the connections between them. Hidden maps are areas the
 * players cannot see yet, and a map whose locations have all left play (The Gathering's Study
 * once the house opens) has nothing to draw, so both are left out. Static for now: pan, zoom and pieces on the
 * tiles come with M3.3b.
 */
export function MapBoard({ maps }: { maps: readonly MapView[] }) {
  return (
    <>
      {maps
        .filter((map) => map.visible && map.locations.length > 0)
        .map((map) => (
          <MapDrawing key={map.id} map={map} />
        ))}
    </>
  );
}

function MapDrawing({ map }: { map: MapView }) {
  const captionId = useId();
  const arrowId = useId();
  const cells = tileCells(map);
  const { width, height } = drawingSize(Object.values(cells));
  return (
    <figure aria-labelledby={captionId}>
      <figcaption id={captionId}>{map.name}</figcaption>
      {/* One user unit is one CSS pixel at most, so a small map keeps its tiles card-sized. */}
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
        <defs>
          <marker id={arrowId} viewBox="0 0 10 10" refX="10" refY="5" orient="auto-start-reverse">
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
            ? [<LocationTile key={location.id} location={location} {...tileOrigin(cell)} />]
            : [];
        })}
      </svg>
    </figure>
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

/** One location as a tile: its name, and its clues once revealed (clues go on a location when it is revealed). */
function LocationTile({ location, x, y }: { location: LocationView; x: number; y: number }) {
  const { t } = useTranslation();
  return (
    <g role="group" aria-label={location.name} transform={`translate(${x} ${y})`}>
      <rect width={TILE.width} height={TILE.height} />
      <text x={TILE.width / 2} y={TILE.height / 3}>
        {location.name}
      </text>
      <text x={TILE.width / 2} y={(TILE.height * 2) / 3}>
        {location.revealed ? t('map.clues', { count: location.clues }) : t('map.unrevealed')}
      </text>
    </g>
  );
}
