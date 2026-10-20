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

describe('tileCells', () => {
  it('keeps the book layout cells', () => {
    const house = houseWith([study, hallway], {
      [study]: { column: 1, row: 0 },
      [hallway]: { column: 0, row: 2 },
    });

    expect(tileCells(house)).toEqual({
      [study]: { column: 1, row: 0 },
      [hallway]: { column: 0, row: 2 },
    });
  });

  it('puts locations without a cell in a row below the laid-out ones, in map order', () => {
    const house = houseWith([study, hallway, attic], { [hallway]: { column: 3, row: 1 } });

    expect(tileCells(house)).toEqual({
      [study]: { column: 0, row: 2 },
      [hallway]: { column: 3, row: 1 },
      [attic]: { column: 1, row: 2 },
    });
  });

  it('starts that row at the top when no location has a cell', () => {
    const house = houseWith([study, hallway], {});

    expect(tileCells(house)).toEqual({
      [study]: { column: 0, row: 0 },
      [hallway]: { column: 1, row: 0 },
    });
  });
});

describe('tile geometry', () => {
  it.each([
    { cell: { column: 0, row: 0 }, origin: { x: 0, y: 0 } },
    { cell: { column: 1, row: 0 }, origin: { x: TILE.width + TILE.gap, y: 0 } },
    { cell: { column: 0, row: 2 }, origin: { x: 0, y: 2 * (TILE.height + TILE.gap) } },
  ])('places the tile in column $cell.column, row $cell.row', ({ cell, origin }) => {
    expect(tileOrigin(cell)).toEqual(origin);
  });

  it.each([
    { cells: [], size: { width: 0, height: 0 } },
    { cells: [{ column: 0, row: 0 }], size: { width: TILE.width, height: TILE.height } },
    {
      cells: [
        { column: 0, row: 0 },
        { column: 1, row: 2 },
      ],
      size: { width: 2 * TILE.width + TILE.gap, height: 3 * TILE.height + 2 * TILE.gap },
    },
  ])('fits the drawing around $cells.length tiles', ({ cells, size }) => {
    expect(drawingSize(cells)).toEqual(size);
  });
});

describe('connectionEnds', () => {
  const left = { column: 0, row: 0 };

  it.each([
    {
      to: 'the tile to the right',
      cell: { column: 1, row: 0 },
      ends: [
        { x: TILE.width, y: TILE.height / 2 },
        { x: TILE.width + TILE.gap, y: TILE.height / 2 },
      ],
    },
    {
      to: 'the tile below',
      cell: { column: 0, row: 1 },
      ends: [
        { x: TILE.width / 2, y: TILE.height },
        { x: TILE.width / 2, y: TILE.height + TILE.gap },
      ],
    },
    {
      to: 'a tile in the same cell',
      cell: left,
      ends: [
        { x: TILE.width / 2, y: TILE.height / 2 },
        { x: TILE.width / 2, y: TILE.height / 2 },
      ],
    },
  ])('runs from edge to edge to $to', ({ cell, ends }) => {
    expect(connectionEnds(left, cell)).toEqual(ends);
  });
});
