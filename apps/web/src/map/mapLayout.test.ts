import { describe, expect, it } from 'vitest';
import {
  atLocation,
  blankEnemy,
  blankLocation,
  cardName,
  engagedWith,
  instanceId,
  investigatorId,
  mapId,
  newGame,
  PlayTable,
  type InstanceId,
  type MapView,
} from '@arkham/engine';
import {
  TILE,
  connectionEnds,
  drawingSize,
  leadMarkerPoints,
  neighboursOf,
  attachmentOrigin,
  onPawn,
  piecesOnTile,
  shrinkToFit,
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

// Pieces have a radius of 14 and stand 6 apart, from 10 inside the tile's left edge; the first row
// is centred 24 above the 210-high tile's bottom edge, the next one 34 higher. The line before the
// enemies engaged with no one takes another 12, so they start 18 after the piece before it.
describe('piecesOnTile', () => {
  const alder = investigatorId('alder');
  const bea = investigatorId('bea');
  const ghoul = instanceId('ghoul');
  const rats = instanceId('rats');
  /** Aloof, so it stays engaged with no one beside an investigator. */
  const aloofRats = blankEnemy('aloof_rats', { keywords: [{ name: 'aloof' }] });
  const inStudy = newGame()
    .withMap(mapId('main'), { name: 'House' })
    .withLocation(study, blankLocation('study'), { revealed: true });

  /** Each piece on the study's tile as `name (x, y)`, engaged enemies marked, and the line. */
  const studyPieces = (table: PlayTable) => {
    const { pieces, separator } = piecesOnTile(
      table.board.investigatorsAt(study),
      table.board.maps[0]?.enemies[study] ?? [],
    );
    return {
      pieces: pieces.map((piece) => {
        const { x, y } = piece.centre;
        if ('investigator' in piece) return `${piece.investigator.name} (${x}, ${y})`;
        return `${piece.enemy.name}${piece.engaged ? ' engaged' : ''} (${x}, ${y})`;
      }),
      separator,
    };
  };

  it('stands an engaged enemy right after its investigator and a line before the loose ones', () => {
    const table = PlayTable.start(
      inStudy
        .withInvestigator(alder, { locationId: study })
        .withCard(rats, aloofRats, atLocation(study))
        .withCard(ghoul, blankEnemy('ghoul'), engagedWith(alder)),
    );

    expect(studyPieces(table)).toEqual({
      pieces: ['alder (24, 186)', 'ghoul engaged (58, 186)', 'aloof_rats (104, 186)'],
      separator: { from: { x: 81, y: 172 }, to: { x: 81, y: 200 } },
    });
  });

  it('draws no line where no investigator stands before the enemies', () => {
    const table = PlayTable.start(
      inStudy
        .withCard(ghoul, blankEnemy('ghoul'), atLocation(study))
        .withCard(rats, blankEnemy('rats'), atLocation(study)),
    );

    expect(studyPieces(table)).toEqual({
      pieces: ['ghoul (24, 186)', 'rats (58, 186)'],
      separator: undefined,
    });
  });

  it('starts a row above for a loose enemy that does not fit, with no line', () => {
    const table = PlayTable.start(
      inStudy
        .withInvestigator(alder, { locationId: study })
        .withInvestigator(bea, { locationId: study })
        .withCard(ghoul, blankEnemy('ghoul'), engagedWith(bea))
        .withCard(rats, aloofRats, atLocation(study)),
    );

    expect(studyPieces(table)).toEqual({
      pieces: [
        'alder (24, 186)',
        'bea (58, 186)',
        'ghoul engaged (92, 186)',
        'aloof_rats (24, 152)',
      ],
      separator: undefined,
    });
  });
});

// An attachment is 30 wide, half of it past the 150-wide tile's right edge; the first sits 6 below
// the 19-high name plate, each further one 14 lower.
describe('attachmentOrigin', () => {
  it.each([
    { index: 0, origin: { x: 135, y: 25 } },
    { index: 1, origin: { x: 135, y: 39 } },
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

describe('shrinkToFit', () => {
  it.each([
    { width: 60, room: 90, scale: 1 },
    { width: 90, room: 90, scale: 1 },
    { width: 180, room: 90, scale: 0.5 },
  ])('shrinks a name $width wide by $scale to fit $room', ({ width, room, scale }) => {
    expect(shrinkToFit(width, room)).toBe(scale);
  });
});

describe('leadMarkerPoints', () => {
  // A pawn's radius is 14, so the marker's centre sits 14·√½ ≈ 9.9 right of and above the pawn's,
  // and its corners reach 7 from there.
  it('draws a pentagon, point up, on the upper right edge of the pawn', () => {
    const corners = leadMarkerPoints({ x: 100, y: 100 }).map(({ x, y }) => ({
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
    }));

    expect(corners).toEqual([
      { x: 109.9, y: 83.1 },
      { x: 116.6, y: 87.9 },
      { x: 114, y: 95.8 },
      { x: 105.8, y: 95.8 },
      { x: 103.2, y: 87.9 },
    ]);
  });
});

// One card step is 180 across and 240 down, so a tile two rows up and three columns across lies
// further across (180) than down (160).
describe('neighboursOf', () => {
  const cellar = instanceId('cellar');
  const parlor = instanceId('parlor');
  const house: MapView = {
    ...houseWith([hallway, study, attic, cellar, parlor], {
      [hallway]: { column: 3, row: 3 },
      [study]: { column: 3, row: 0 },
      [attic]: { column: 0, row: 3 },
      [cellar]: { column: 6, row: 1 },
      [parlor]: { column: 2, row: 6 },
    }),
    connections: [
      { from: hallway, to: study, oneWay: false },
      { from: attic, to: hallway, oneWay: false },
      { from: hallway, to: cellar, oneWay: true },
      { from: parlor, to: hallway, oneWay: true },
    ],
  };

  it.each([
    { neighbour: study, where: 'straight above', side: 'above', oneWay: undefined },
    { neighbour: attic, where: 'straight left', side: 'left', oneWay: undefined },
    { neighbour: cellar, where: 'up and further right', side: 'right', oneWay: 'out' },
    { neighbour: parlor, where: 'down and a little left', side: 'below', oneWay: 'in' },
  ])('puts the $neighbour tile, $where of the Hallway, $side', ({ neighbour, side, oneWay }) => {
    expect(neighboursOf(house, hallway).find(({ id }) => id === neighbour)).toEqual({
      id: neighbour,
      side,
      ...(oneWay && { oneWay }),
    });
  });

  it('lists only the locations connected to it', () => {
    expect(neighboursOf(house, study)).toEqual([{ id: hallway, side: 'below' }]);
  });
});
