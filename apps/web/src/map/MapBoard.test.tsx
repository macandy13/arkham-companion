// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  attachedTo,
  atLocation,
  blankEnemy,
  blankLocation,
  blankTreachery,
  engagedWith,
  fixed,
  instanceId,
  investigatorId,
  mapId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { gameActions } from '../state/gameActions';
import { MapBoard } from './MapBoard';

const study = instanceId('study');
const hallway = instanceId('hallway');
const attic = instanceId('attic');
const alder = investigatorId('alder');

/** A house map: the Study revealed and laid out left of the Hallway, the Attic unrevealed without a cell. */
const house = newGame()
  .withMap(mapId('main'), { name: 'House' })
  .withLocation(study, blankLocation('study', { shroud: 2 }), {
    revealed: true,
    clues: 2,
    doom: 1,
    at: { column: 0, row: 0 },
  })
  .withLocation(hallway, blankLocation('hallway'), { at: { column: 3, row: 0 } })
  .withLocation(attic, blankLocation('attic'))
  .withConnection(study, hallway)
  .withConnection(hallway, attic, { oneWay: true });

/**
 * The map's props for `table`: its board, actions that play on it as the store's play on the open
 * game, and no step queued.
 */
const mapPropsOf = (table: PlayTable) => ({
  board: table.board,
  actions: gameActions(
    async (step) => step(table),
    async () => {},
  ),
  busy: false,
});

const tile = (name: string) => screen.getByRole('group', { name });

describe('MapBoard', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('draws a tile per location with its shroud and clues once revealed, its doom and attachments', () => {
    const table = PlayTable.start(
      house.withCard(
        instanceId('obscuring_fog'),
        blankTreachery('obscuring_fog', { locationAttachment: { shroud: 2 } }),
        attachedTo(study),
      ),
    );

    render(<MapBoard {...mapPropsOf(table)} />);

    expect(screen.getByRole('figure', { name: 'House' })).toBeTruthy();
    expect(within(tile('study')).getByText('Shroud 4 · Clues 2')).toBeTruthy();
    expect(within(tile('study')).getByText('Doom 1')).toBeTruthy();
    expect(within(tile('study')).getByText('Attachments 1')).toBeTruthy();
    expect(within(tile('hallway')).getByText('Unrevealed')).toBeTruthy();
    expect(within(tile('attic')).getByText('Unrevealed')).toBeTruthy();
  });

  it('names each connection after its locations and marks one-way ones', () => {
    render(<MapBoard {...mapPropsOf(PlayTable.start(house))} />);

    const lines = screen.getAllByRole('img').map((line) => line.getAttribute('aria-label'));
    expect(lines).toEqual(['study – hallway', 'hallway to attic, one way']);
  });

  it('leaves out hidden maps and maps without locations', () => {
    const table = PlayTable.start(
      house
        .withMap(mapId('cellar'), { name: 'Cellar', visible: false })
        .withLocation(instanceId('cellar'), blankLocation('cellar'), { map: mapId('cellar') })
        .withMap(mapId('empty_study'), { name: 'Empty study' }),
    );

    render(<MapBoard {...mapPropsOf(table)} />);

    expect(screen.getByRole('figure', { name: 'House' })).toBeTruthy();
    expect(screen.queryByRole('figure', { name: 'Cellar' })).toBeNull();
    expect(screen.queryByRole('figure', { name: 'Empty study' })).toBeNull();
  });

  it('offers zoom buttons for the shown map', () => {
    render(<MapBoard {...mapPropsOf(PlayTable.start(house))} />);

    const zoom = within(screen.getByRole('toolbar', { name: 'Zoom' }));
    expect(zoom.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Zoom in',
      'Zoom out',
      'Fit map',
    ]);
  });

  it('shows one map without tabs', () => {
    render(<MapBoard {...mapPropsOf(PlayTable.start(house))} />);

    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('gives several visible maps a tab each and shows the chosen one, the first at the start', () => {
    const table = PlayTable.start(
      house
        .withMap(mapId('cellar'), { name: 'Cellar' })
        .withLocation(instanceId('cellar'), blankLocation('cellar'), { map: mapId('cellar') }),
    );
    render(<MapBoard {...mapPropsOf(table)} />);
    const tab = (name: string) => screen.getByRole('tab', { name });

    expect(tab('House').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'House' })).toBeTruthy();
    expect(screen.queryByRole('figure', { name: 'Cellar' })).toBeNull();

    fireEvent.click(tab('Cellar'));

    expect(tab('Cellar').getAttribute('aria-selected')).toBe('true');
    expect(tab('House').getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('figure', { name: 'Cellar' })).toBeTruthy();
    expect(screen.queryByRole('figure', { name: 'House' })).toBeNull();
  });

  it('shows the first map again once the chosen one has no locations left', () => {
    const cellar = mapId('cellar');
    const withCellar = PlayTable.start(
      house
        .withMap(cellar, { name: 'Cellar' })
        .withLocation(instanceId('cellar'), blankLocation('cellar'), { map: cellar }),
    );
    const { rerender } = render(<MapBoard {...mapPropsOf(withCellar)} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Cellar' }));

    const cellarEmptied = PlayTable.start(house.withMap(cellar, { name: 'Cellar' }));
    rerender(<MapBoard {...mapPropsOf(cellarEmptied)} />);

    expect(screen.getByRole('figure', { name: 'House' })).toBeTruthy();
  });

  it('stands a pawn for each investigator and a chip for each enemy on their location', () => {
    const ghoul = instanceId('ghoul');
    const table = PlayTable.start(
      house
        .withInvestigator(alder, { locationId: study })
        .withCard(ghoul, blankEnemy('ghoul', { health: fixed(3) }), engagedWith(alder), {
          tokens: { damage: 2 },
        })
        .withCard(instanceId('rats'), blankEnemy('rats'), atLocation(hallway)),
    );
    table.play({ type: 'ExhaustEnemy', enemyId: ghoul });

    render(<MapBoard {...mapPropsOf(table)} />);

    expect(within(tile('study')).getByRole('img', { name: 'alder' })).toBeTruthy();
    expect(
      within(tile('study')).getByRole('img', {
        name: 'ghoul, engaged with alder, 2 damage, exhausted',
      }),
    ).toBeTruthy();
    expect(within(tile('hallway')).getByRole('img', { name: 'rats' })).toBeTruthy();
  });

  // jsdom lays nothing out, so the drawing's screen matrix is stubbed to the identity: a pointer
  // at screen (x, y) is at (x, y) in the drawing. The Study's tile spans 0–150 across and 0–210
  // down, with its first pawn centred on (24, 186); the Hallway's tile starts at x 180.
  describe('dragging a pawn', () => {
    const bea = investigatorId('bea');
    const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    beforeAll(() => {
      Object.assign(SVGSVGElement.prototype, {
        getScreenCTM: () => ({ inverse: () => identity }),
      });
      Object.assign(Element.prototype, {
        setPointerCapture: () => {},
        hasPointerCapture: () => true,
      });
    });
    afterAll(() => {
      const svg: object = SVGSVGElement.prototype;
      const element: object = Element.prototype;
      Reflect.deleteProperty(svg, 'getScreenCTM');
      Reflect.deleteProperty(element, 'setPointerCapture');
      Reflect.deleteProperty(element, 'hasPointerCapture');
    });

    /** Drags the pawn named `name` in the Study to screen point (`x`, `y`) and lets go. */
    async function drag(name: string, x: number, y: number) {
      const pawn = within(tile('study')).getByRole('img', { name });
      fireEvent.pointerDown(pawn, { pointerId: 1, clientX: 24, clientY: 186 });
      fireEvent.pointerMove(pawn, { pointerId: 1, clientX: x, clientY: y });
      fireEvent.pointerUp(pawn, { pointerId: 1, clientX: x, clientY: y });
      await act(async () => {});
    }

    it('moves the investigator whose turn it is to the location they are dropped on', async () => {
      const table = PlayTable.start(
        house.withInvestigator(alder, { locationId: study }).withTurnOf(alder),
      );
      render(<MapBoard {...mapPropsOf(table)} />);

      await drag('alder', 255, 105);

      expect(table.board.investigator(alder).at).toBe('hallway');
    });

    it.each([
      { where: 'on their own location', x: 75, y: 105 },
      { where: 'between two tiles', x: 165, y: 105 },
    ])('leaves the investigator in place when dropped $where', async ({ x, y }) => {
      const table = PlayTable.start(
        house.withInvestigator(alder, { locationId: study }).withTurnOf(alder),
      );
      render(<MapBoard {...mapPropsOf(table)} />);

      await drag('alder', x, y);

      expect(table.board.investigator(alder).at).toBe('study');
    });

    it('leaves the pawn in place while a step is still queued', async () => {
      const table = PlayTable.start(
        house.withInvestigator(alder, { locationId: study }).withTurnOf(alder),
      );
      render(<MapBoard {...mapPropsOf(table)} busy />);

      await drag('alder', 255, 105);

      expect(table.board.investigator(alder).at).toBe('study');
    });

    it('leaves the pawns of the other investigators in place', async () => {
      const table = PlayTable.start(
        house
          .withInvestigator(bea, { locationId: study })
          .withInvestigator(alder, { locationId: study })
          .withTurnOf(alder),
      );
      render(<MapBoard {...mapPropsOf(table)} />);

      await drag('bea', 255, 105);

      expect(table.board.investigator(bea).at).toBe('study');
    });
  });
});
