import { describe, expect, it } from 'vitest';
import { cardName, instanceId, mapId, type InstanceId, type MapView } from '@arkham/engine';
import { TILE, connectionEnds, drawingSize, tileCells, tileOrigin } from './mapLayout';

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
  };
}

// A tile is 160 × 100 with a gap of 50, and the grid is three cells per card: one cell is 70
// across and 50 down, one card step (3 cells) is 210 across and 150 down.
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
    expect(TILE).toEqual({ width: 160, height: 100, gap: 50 });
  });

  it.each([
    { cell: { column: 0, row: 0 }, origin: { x: 0, y: 0 } },
    { cell: { column: 1, row: 0 }, origin: { x: 70, y: 0 } },
    { cell: { column: 3, row: 0 }, origin: { x: 210, y: 0 } },
    { cell: { column: 0, row: 6 }, origin: { x: 0, y: 300 } },
  ])('places the tile in column $cell.column, row $cell.row', ({ cell, origin }) => {
    expect(tileOrigin(cell)).toEqual(origin);
  });

  it.each([
    { cells: [], size: { width: 0, height: 0 } },
    { cells: [{ column: 0, row: 0 }], size: { width: 160, height: 100 } },
    {
      cells: [
        { column: 0, row: 0 },
        { column: 4, row: 6 },
      ],
      size: { width: 280 + 160, height: 300 + 100 },
    },
  ])('fits the drawing around $cells.length tiles', ({ cells, size }) => {
    expect(drawingSize(cells)).toEqual(size);
  });
});

describe('connectionEnds', () => {
  const left = { column: 0, row: 0 };

  it.each([
    {
      to: 'the tile a card step to the right',
      cell: { column: 3, row: 0 },
      ends: [
        { x: 160, y: 50 },
        { x: 210, y: 50 },
      ],
    },
    {
      to: 'the tile a card step below',
      cell: { column: 0, row: 3 },
      ends: [
        { x: 80, y: 100 },
        { x: 80, y: 150 },
      ],
    },
    {
      to: 'a tile in the same cell',
      cell: left,
      ends: [
        { x: 80, y: 50 },
        { x: 80, y: 50 },
      ],
    },
  ])('runs from edge to edge to $to', ({ cell, ends }) => {
    expect(connectionEnds(left, cell)).toEqual(ends);
  });
});
