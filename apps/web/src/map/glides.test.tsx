// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  atLocation,
  blankEnemy,
  blankLocation,
  instanceId,
  investigatorId,
  mapId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { actionsOn } from '../state/gameActions.test_support';
import { glides, piecePlaces, type PiecePlace } from './glides';
import { MapBoard } from './MapBoard';
import { tileCells } from './mapLayout';

const study = instanceId('study');
const hallway = instanceId('hallway');
const alder = investigatorId('alder');
const ghoul = instanceId('ghoul');

describe('glides', () => {
  const alderIn = (location: typeof study, x: number, y: number): PiecePlace => ({
    piece: { investigator: alder },
    location,
    centre: { x, y },
  });
  const ghoulIn = (location: typeof study, x: number, y: number): PiecePlace => ({
    piece: { enemy: ghoul },
    location,
    centre: { x, y },
  });

  it.each([
    {
      what: 'a pawn gone to the Hallway glides from its place in the Study',
      before: [alderIn(study, 10, 90)],
      after: [alderIn(hallway, 110, 90)],
      offsets: [{ x: -100, y: 0 }],
    },
    {
      what: 'an enemy gone to the Study glides from its place in the Hallway',
      before: [ghoulIn(hallway, 110, 90)],
      after: [ghoulIn(study, 30, 90)],
      offsets: [{ x: 80, y: 0 }],
    },
    {
      what: 'a pawn that only shifts on its own tile stays',
      before: [alderIn(study, 10, 90)],
      after: [alderIn(study, 30, 90)],
      offsets: [],
    },
    {
      what: 'an enemy new on the map stays',
      before: [],
      after: [ghoulIn(study, 30, 90)],
      offsets: [],
    },
  ])('$what', ({ before, after, offsets }) => {
    expect(glides(before, after).map(({ offset }) => offset)).toEqual(offsets);
  });

  it('lets a piece the players dropped glide from where they dropped it', () => {
    const dropped = { piece: { investigator: alder }, at: { x: 100, y: 60 } };

    expect(glides([alderIn(study, 10, 90)], [alderIn(hallway, 110, 90)], dropped)).toEqual([
      { piece: { investigator: alder }, offset: { x: -10, y: -30 } },
    ]);
  });
});

describe('piecePlaces', () => {
  it('places Alder and the Ghoul engaged with no one on the Study tile, in the drawing', () => {
    const board = PlayTable.start(
      newGame()
        .withMap(mapId('main'), { name: 'House' })
        .withLocation(study, blankLocation('study'), { revealed: true, at: { column: 0, row: 0 } })
        .withLocation(hallway, blankLocation('hallway'), { at: { column: 3, row: 0 } })
        .withInvestigator(alder, { name: 'Alder', locationId: study })
        .withCard(ghoul, blankEnemy('Ghoul'), atLocation(study)),
    ).board;
    const [map] = board.maps;

    const places = piecePlaces(map!, tileCells(map!), board);

    expect(places.map(({ piece, location }) => ({ piece, location }))).toEqual([
      { piece: { investigator: alder }, location: study },
      { piece: { enemy: ghoul }, location: study },
    ]);
  });
});

describe('useGlides in the map', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(Element.prototype, 'animate');
  });

  /** Alder in the `at` location of a house of the Study left of the Hallway. */
  const alderAt = (at: typeof study) =>
    PlayTable.start(
      newGame()
        .withMap(mapId('main'), { name: 'House' })
        .withLocation(study, blankLocation('study'), { revealed: true, at: { column: 0, row: 0 } })
        .withLocation(hallway, blankLocation('hallway'), {
          revealed: true,
          at: { column: 3, row: 0 },
        })
        .withConnection(study, hallway)
        .withInvestigator(alder, { name: 'Alder', locationId: at }),
    );
  const mapOf = (table: ReturnType<typeof alderAt>) => (
    <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />
  );
  const motion = (reduce: boolean) =>
    vi.stubGlobal('matchMedia', () => ({ matches: reduce }) as MediaQueryList);

  it('lets Alder glide from the Study when the board shows them in the Hallway', () => {
    motion(false);
    const animate = vi.fn();
    Object.assign(Element.prototype, { animate });
    const { rerender } = render(mapOf(alderAt(study)));

    rerender(mapOf(alderAt(hallway)));

    expect(animate).toHaveBeenCalledTimes(1);
    const [element] = animate.mock.contexts as Element[];
    expect(element?.getAttribute('data-pawn')).toBe(alder);
  });

  it('moves nothing when the players prefer reduced motion', () => {
    motion(true);
    const animate = vi.fn();
    Object.assign(Element.prototype, { animate });
    const { rerender } = render(mapOf(alderAt(study)));

    rerender(mapOf(alderAt(hallway)));

    expect(animate).not.toHaveBeenCalled();
  });
});
