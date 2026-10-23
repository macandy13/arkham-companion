import { describe, expect, it } from 'vitest';
import { cardName, instanceId, mapId, type InstanceId, type MapView } from '@arkham/engine';
import {
  TILE,
  connectionEnds,
  drawingSize,
  attachmentOrigin,
  onPawn,
  pawnOffset,
  tileAt,
  tileCells,
  tileOrigin,
} from './mapLayout';

const study = instanceId('study');
const hallway = instanceId('hallway');
const attic = instanceId('attic');

/** A map named `house` with the given locations, unrevealed and without clues, in this order. */
function houseWith(ids: InstanceId[], cells: MapView['cells']): MapView {
  return {
    id: mapId('house'),
    name: 'House',
    visible: true,
    locations: ids.map((id) => ({
      id,
      name: cardName(id),
      map: mapId('house'),
      revealed: false,
      clues: 0,
    })),
    cells,
    connections: [],
    enemies: {},
  };
}

// A tile is 150 × 210 with a gap of 30, and the grid is three cells per card: one cell is 60
// across and 80 down, one card step (3 cells) is 180 across and 240 down.
describe('tileCells', () => {
  it('keeps the book layout cells', () => {
    const house = houseWith([study, hallway], {
      [study]: { column: 1, row: 0 },
      [hallway]: { column: 0, row: 4 },
    });

    expect(tileCells(house)).toEqual({
      [study]: { column: 1, row: 0 },
      [hallway]: { column: 0, row: 4 },
    });
  });

  it('puts locations without a cell one card step below the lowest tile, a card step apart', () => {
    const house = houseWith([study, hallway, attic], { [hallway]: { column: 4, row: 2 } });

    expect(tileCells(house)).toEqual({
      [study]: { column: 0, row: 5 },
      [hallway]: { column: 4, row: 2 },
      [attic]: { column: 3, row: 5 },
    });
  });

  it('starts that row at the top when no location has a cell', () => {
    const house = houseWith([study, hallway], {});

    expect(tileCells(house)).toEqual({
      [study]: { column: 0, row: 0 },
      [hallway]: { column: 3, row: 0 },
    });
  });
});

describe('tile geometry', () => {
  it('draws card-sized tiles whose step divides into whole cells', () => {
    expect(TILE).toEqual({ width: 150, height: 210, gap: 30 });
  });

  it.each([
    { cell: { column: 0, row: 0 }, origin: { x: 0, y: 0 } },
    { cell: { column: 1, row: 0 }, origin: { x: 60, y: 0 } },
    { cell: { column: 3, row: 0 }, origin: { x: 180, y: 0 } },
    { cell: { column: 0, row: 6 }, origin: { x: 0, y: 480 } },
  ])('places the tile in column $cell.column, row $cell.row', ({ cell, origin }) => {
    expect(tileOrigin(cell)).toEqual(origin);
  });

  it.each([
    { cells: [], size: { width: 0, height: 0 } },
    { cells: [{ column: 0, row: 0 }], size: { width: 150 + 30, height: 210 } },
    {
      cells: [
        { column: 0, row: 0 },
        { column: 4, row: 6 },
      ],
      size: { width: 240 + 150 + 30, height: 480 + 210 },
    },
  ])(
    'fits the drawing around $cells.length tiles and 30 for attachments past the right edge',
    ({ cells, size }) => {
      expect(drawingSize(cells)).toEqual(size);
    },
  );
});

describe('connectionEnds', () => {
  const left = { column: 0, row: 0 };

  it.each([
    {
      to: 'the tile a card step to the right',
      cell: { column: 3, row: 0 },
      ends: [
        { x: 150, y: 105 },
        { x: 180, y: 105 },
      ],
    },
    {
      to: 'the tile a card step below',
      cell: { column: 0, row: 3 },
      ends: [
        { x: 75, y: 210 },
        { x: 75, y: 240 },
      ],
    },
    {
      to: 'a tile in the same cell',
      cell: left,
      ends: [
        { x: 75, y: 105 },
        { x: 75, y: 105 },
      ],
    },
  ])('runs from edge to edge to $to', ({ cell, ends }) => {
    expect(connectionEnds(left, cell)).toEqual(ends);
  });
});

// The Study's tile spans 0–150 across and 0–210 down; the Hallway's, a card step to the right,
// spans 180–330 across.
describe('tileAt', () => {
  const cells = { [study]: { column: 0, row: 0 }, [hallway]: { column: 3, row: 0 } };

  it.each([
    { point: { x: 75, y: 105 }, location: study },
    { point: { x: 150, y: 210 }, location: study },
    { point: { x: 200, y: 10 }, location: hallway },
    { point: { x: 165, y: 105 }, location: undefined },
    { point: { x: 75, y: 230 }, location: undefined },
  ])('finds $location at ($point.x, $point.y)', ({ point, location }) => {
    expect(tileAt(cells, point)).toBe(location);
  });

  it('picks the tile drawn last where two share a cell', () => {
    const shared = { [study]: { column: 0, row: 0 }, [attic]: { column: 0, row: 0 } };

    expect(tileAt(shared, { x: 75, y: 105 })).toBe(attic);
  });
});

// Pieces have a radius of 14 and stand 6 apart, four to a row; the first row is centred 24 above
// the tile's bottom edge, the next one 34 higher.
describe('pawnOffset', () => {
  it.each([
    { index: 0, centre: { x: 24, y: 186 } },
    { index: 1, centre: { x: 58, y: 186 } },
    { index: 3, centre: { x: 126, y: 186 } },
    { index: 4, centre: { x: 24, y: 152 } },
  ])('centres piece $index on ($centre.x, $centre.y) of its tile', ({ index, centre }) => {
    expect(pawnOffset(index)).toEqual(centre);
  });
});

// An attachment is 30 wide, half of it past the 150-wide tile's right edge; the first sits 6 below
// the 48-high name band, each further one 14 lower.
describe('attachmentOrigin', () => {
  it.each([
    { index: 0, origin: { x: 135, y: 54 } },
    { index: 1, origin: { x: 135, y: 68 } },
  ])('puts attachment $index at ($origin.x, $origin.y) of its tile', ({ index, origin }) => {
    expect(attachmentOrigin(index)).toEqual(origin);
  });
});

describe('onPawn', () => {
  const centre = { x: 24, y: 186 };

  it.each([
    { point: { x: 24, y: 186 }, on: true },
    { point: { x: 38, y: 186 }, on: true },
    { point: { x: 33, y: 195 }, on: true },
    { point: { x: 39, y: 186 }, on: false },
    { point: { x: 35, y: 197 }, on: false },
  ])('says ($point.x, $point.y) is on the pawn: $on', ({ point, on }) => {
    expect(onPawn(centre, point)).toBe(on);
  });
});
