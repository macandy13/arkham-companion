// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  attachedTo,
  atLocation,
  blankEnemy,
  blankLocation,
  blankTreachery,
  cardImagePath,
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
import type { Point } from './mapLayout';

const study = instanceId('study');
const hallway = instanceId('hallway');
const attic = instanceId('attic');
const alder = investigatorId('alder');

/**
 * A house map: the Study revealed with 2 clues and 1 doom, laid out left of the Hallway, which is
 * unrevealed without clues or doom, like the Attic, which has no cell.
 */
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

/** Actions that play on `table`, as the store's play on the open game; undo is never used here. */
const actionsOn = (table: PlayTable) =>
  gameActions(
    async (step) => step(table),
    async () => {},
  );

const tile = (name: string) => screen.getByRole('group', { name });

describe('MapBoard', () => {
  // jsdom lays nothing out and has no pointer capture: the drawing's screen matrix is stubbed to
  // the identity, so a pointer at screen (x, y) is at (x, y) in the drawing, and a captured
  // pointer stays with the piece it went down on.
  const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  beforeAll(async () => {
    await initI18n('en');
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
  afterEach(cleanup);

  it('draws a tile per location with its shroud and clues once revealed, its doom and attachments', () => {
    const table = PlayTable.start(
      house.withCard(
        instanceId('obscuring_fog'),
        blankTreachery('obscuring_fog', { modifiers: [{ stat: 'shroud', of: 'host', by: 2 }] }),
        attachedTo(study),
      ),
    );

    render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);

    expect(screen.getByRole('figure', { name: 'House' })).toBeTruthy();
    const tokensOf = (name: string) =>
      within(tile(name))
        .queryAllByRole('img')
        .map((token) => [token.getAttribute('aria-label'), token.textContent]);
    expect(tokensOf('study')).toEqual([
      ['Attached: obscuring_fog', ''],
      ['Shroud 4', '4'],
      ['Clues 2', '2'],
      ['Doom 1', '1'],
    ]);
    expect(within(tile('study')).getByText('Location')).toBeTruthy();
    expect(tokensOf('hallway')).toEqual([]);
    expect(within(tile('hallway')).getByText('Unrevealed')).toBeTruthy();
    expect(within(tile('attic')).getByText('Unrevealed')).toBeTruthy();
  });

  describe('a location with a picture of its side', () => {
    // jsdom loads no images, so each test fires the picture's load or error itself.
    const withCellar = house.withLocation(
      instanceId('cellar'),
      blankLocation('cellar', {
        shroud: 3,
        backImageSrc: cardImagePath('/bundles/cards/cellar_back.png'),
      }),
    );
    const pictureOf = (name: string) => tile(name).querySelector('image');
    const requiredPictureOf = (name: string) => {
      const picture = pictureOf(name);
      if (!picture) throw new Error(`${name} has no picture`);
      return picture;
    };

    it('fetches the picture from ArkhamDB and keeps the pattern face until it has loaded', () => {
      const table = PlayTable.start(withCellar);
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);

      expect(pictureOf('cellar')?.getAttribute('href')).toBe(
        'https://arkhamdb.com/bundles/cards/cellar_back.png',
      );
      expect(tile('cellar').hasAttribute('data-picture')).toBe(false);
      expect(pictureOf('study')).toBeNull();
    });

    it('shows the picture once it has loaded', () => {
      const table = PlayTable.start(withCellar);
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);

      fireEvent.load(requiredPictureOf('cellar'));

      expect(tile('cellar').getAttribute('data-picture')).toBe('shown');
    });

    it('cuts the art out of the picture into the art window of the tile', () => {
      const table = PlayTable.start(withCellar);
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);

      // The art window is the tile's nested svg: the scan's art area, its whole width from 5.7 % to
      // 56.3 % of its height.
      const artWindow = tile('cellar').querySelector('svg');
      expect(artWindow?.getAttribute('viewBox')).toBe('0 24 300 212');
      expect(artWindow?.querySelector('image')?.getAttribute('href')).toBe(
        'https://arkhamdb.com/bundles/cards/cellar_back.png',
      );
    });

    it('keeps the pattern face when the picture fails to load', () => {
      const table = PlayTable.start(withCellar);
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);

      fireEvent.error(requiredPictureOf('cellar'));

      expect(tile('cellar').hasAttribute('data-picture')).toBe(false);
    });
  });

  it('names each connection after its locations and marks one-way ones', () => {
    const table = PlayTable.start(house);
    render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);

    const lines = screen
      .getAllByRole('img')
      .filter((image) => image.tagName === 'line')
      .map((line) => line.getAttribute('aria-label'));
    expect(lines).toEqual(['study – hallway', 'hallway to attic, one way']);
  });

  it('leaves out hidden maps and maps without locations', () => {
    const table = PlayTable.start(
      house
        .withMap(mapId('cellar'), { name: 'Cellar', visible: false })
        .withLocation(instanceId('cellar'), blankLocation('cellar'), { map: mapId('cellar') })
        .withMap(mapId('empty_study'), { name: 'Empty study' }),
    );

    render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);

    expect(screen.getByRole('figure', { name: 'House' })).toBeTruthy();
    expect(screen.queryByRole('figure', { name: 'Cellar' })).toBeNull();
    expect(screen.queryByRole('figure', { name: 'Empty study' })).toBeNull();
  });

  it('offers zoom buttons for the shown map', () => {
    const table = PlayTable.start(house);
    render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);

    const zoom = within(screen.getByRole('toolbar', { name: 'Zoom' }));
    expect(zoom.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Zoom in',
      'Zoom out',
      'Fit map',
    ]);
  });

  it('shows one map without tabs', () => {
    const table = PlayTable.start(house);
    render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);

    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('gives several visible maps a tab each and shows the chosen one, the first at the start', () => {
    const table = PlayTable.start(
      house
        .withMap(mapId('cellar'), { name: 'Cellar' })
        .withLocation(instanceId('cellar'), blankLocation('cellar'), { map: mapId('cellar') }),
    );
    render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);
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
    const { rerender } = render(
      <MapBoard board={withCellar.board} actions={actionsOn(withCellar)} busy={false} />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Cellar' }));

    const cellarEmptied = PlayTable.start(house.withMap(cellar, { name: 'Cellar' }));
    rerender(
      <MapBoard board={cellarEmptied.board} actions={actionsOn(cellarEmptied)} busy={false} />,
    );

    expect(screen.getByRole('figure', { name: 'House' })).toBeTruthy();
  });

  it('stands a pawn for each investigator and a token for each enemy on their location', () => {
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

    render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);

    expect(within(tile('study')).getByRole('img', { name: 'alder' })).toBeTruthy();
    expect(
      within(tile('study')).getByRole('img', {
        name: 'ghoul, engaged with alder, 2 damage, exhausted',
      }),
    ).toBeTruthy();
    expect(within(tile('hallway')).getByRole('img', { name: 'rats' })).toBeTruthy();
  });

  // The Study's tile spans 0–150 across and 0–210 down. Pieces stand in a row along its bottom
  // edge, investigators first: the first centred on (24, 186), the next on (58, 186). The
  // Hallway's tile starts at x 180.
  describe('dragging pieces', () => {
    const firstPawn = { x: 24, y: 186 };
    const enemyAlone = { x: 24, y: 186 };
    const enemyBesideAlder = { x: 58, y: 186 };
    const bea = investigatorId('bea');
    const rats = instanceId('rats');

    /**
     * Drags the piece named `name` on the tile of `location`, pressed at screen point `from`, to
     * screen point (`x`, `y`) and lets go there.
     */
    async function drag(location: string, name: string, from: Point, x: number, y: number) {
      const piece = within(tile(location)).getByRole('img', { name });
      fireEvent.pointerDown(piece, { pointerId: 1, clientX: from.x, clientY: from.y });
      fireEvent.pointerMove(piece, { pointerId: 1, clientX: x, clientY: y });
      fireEvent.pointerUp(piece, { pointerId: 1, clientX: x, clientY: y });
      await act(async () => {});
    }

    it('moves the investigator whose turn it is to the location they are dropped on', async () => {
      const table = PlayTable.start(
        house.withInvestigator(alder, { locationId: study }).withTurnOf(alder),
      );
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);

      await drag('study', 'alder', firstPawn, 255, 105);

      expect(table.board.investigator(alder).at).toBe('hallway');
    });

    it.each([
      { where: 'on their own location', x: 75, y: 105 },
      { where: 'between two tiles', x: 165, y: 105 },
    ])('leaves the investigator in place when dropped $where', async ({ x, y }) => {
      const table = PlayTable.start(
        house.withInvestigator(alder, { locationId: study }).withTurnOf(alder),
      );
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);

      await drag('study', 'alder', firstPawn, x, y);

      expect(table.board.investigator(alder).at).toBe('study');
    });

    it('leaves the pawn in place while a step is still queued', async () => {
      const table = PlayTable.start(
        house.withInvestigator(alder, { locationId: study }).withTurnOf(alder),
      );
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy />);

      await drag('study', 'alder', firstPawn, 255, 105);

      expect(table.board.investigator(alder).at).toBe('study');
    });

    it('leaves the pawns of the other investigators in place', async () => {
      const table = PlayTable.start(
        house
          .withInvestigator(bea, { locationId: study })
          .withInvestigator(alder, { locationId: study })
          .withTurnOf(alder),
      );
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);

      await drag('study', 'bea', firstPawn, 255, 105);

      expect(table.board.investigator(bea).at).toBe('study');
    });

    it('moves an enemy to the location it is dropped on, connected or not', async () => {
      const table = PlayTable.start(
        house.withCard(rats, blankEnemy('rats', { health: fixed(1) }), atLocation(study)),
      );
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);

      await drag('study', 'rats', enemyAlone, 255, 105);

      expect(table.board.enemy(rats)).toEqual({ name: 'rats', at: 'hallway', health: 1 });
    });

    it('disengages an engaged enemy and moves it to the location it is dropped on', async () => {
      const table = PlayTable.start(
        house
          .withInvestigator(alder, { locationId: study })
          .withCard(rats, blankEnemy('rats', { health: fixed(1) }), engagedWith(alder)),
      );
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);

      await drag('study', 'rats, engaged with alder', enemyBesideAlder, 255, 105);

      expect(table.board.enemy(rats)).toEqual({ name: 'rats', at: 'hallway', health: 1 });
    });

    it('engages an aloof enemy with the investigator whose turn it is when dropped on their pawn', async () => {
      const aloofRats = blankEnemy('aloof_rats', {
        health: fixed(1),
        keywords: [{ name: 'aloof' }],
      });
      const table = PlayTable.start(
        house
          .withInvestigator(alder, { locationId: study })
          .withCard(rats, aloofRats, atLocation(study))
          .withTurnOf(alder),
      );
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);

      await drag('study', 'aloof_rats', enemyBesideAlder, 24, 186);

      expect(table.board.enemy(rats)).toEqual({
        name: 'aloof_rats',
        at: 'study',
        engagedWith: alder,
        health: 1,
      });
    });

    it.each([
      { where: 'on its own location', x: 75, y: 105 },
      { where: 'between two tiles', x: 165, y: 105 },
    ])('leaves an enemy in place when dropped $where', async ({ x, y }) => {
      const table = PlayTable.start(
        house.withCard(rats, blankEnemy('rats', { health: fixed(1) }), atLocation(study)),
      );
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);

      await drag('study', 'rats', enemyAlone, x, y);

      expect(table.board.enemy(rats)).toEqual({ name: 'rats', at: 'study', health: 1 });
    });

    it('leaves an enemy in place while a step is still queued', async () => {
      const table = PlayTable.start(
        house.withCard(rats, blankEnemy('rats', { health: fixed(1) }), atLocation(study)),
      );
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy />);

      await drag('study', 'rats', enemyAlone, 255, 105);

      expect(table.board.enemy(rats)).toEqual({ name: 'rats', at: 'study', health: 1 });
    });
  });

  describe('the location menu', () => {
    const menu = (name: string) => screen.getByRole('dialog', { name });
    const tap = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

    const editButton = (location: string) =>
      within(tile(location)).getByRole('button', { name: `Edit ${location}` });

    it('opens from the tile’s edit button and closes again', () => {
      const table = PlayTable.start(house);
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);

      fireEvent.click(editButton('hallway'));
      expect(menu('hallway')).toBeTruthy();

      tap('Close');
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it.each(['Enter', ' '])('opens from the edit button by the %j key', (key) => {
      const table = PlayTable.start(house);
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);

      fireEvent.keyDown(editButton('hallway'), { key });

      expect(menu('hallway')).toBeTruthy();
    });

    it('reveals an unrevealed location', async () => {
      const table = PlayTable.start(house);
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);
      fireEvent.click(editButton('hallway'));

      tap('Reveal');
      await act(async () => {});

      expect(table.board.location(hallway).revealed).toBe(true);
    });

    it.each([
      { button: 'Add a clue', clues: 3, doom: 1 },
      { button: 'Remove a clue', clues: 1, doom: 1 },
      { button: 'Add doom', clues: 2, doom: 2 },
      { button: 'Remove doom', clues: 2, doom: 0 },
    ])(
      'changes the study, with 2 clues and 1 doom, by "$button"',
      async ({ button, clues, doom }) => {
        const table = PlayTable.start(house);
        render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);
        fireEvent.click(editButton('study'));

        tap(button);
        await act(async () => {});

        const { clues: cluesLeft, doom: doomLeft = 0 } = table.board.location(study);
        expect({ clues: cluesLeft, doom: doomLeft }).toEqual({ clues, doom });
      },
    );

    it('turns off removing tokens at the hallway, which has no clues or doom', () => {
      const table = PlayTable.start(house);
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} />);
      fireEvent.click(editButton('hallway'));
      const disabled = (name: string) =>
        screen.getByRole('button', { name }).hasAttribute('disabled');

      expect(disabled('Remove a clue')).toBe(true);
      expect(disabled('Remove doom')).toBe(true);
      expect(disabled('Add a clue')).toBe(false);
    });

    it('turns every change off while a step is still queued', () => {
      const table = PlayTable.start(house);
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy />);
      fireEvent.click(editButton('hallway'));

      const enabled = within(menu('hallway'))
        .getAllByRole('button')
        .filter((button) => !button.hasAttribute('disabled'))
        .map((button) => button.textContent);
      expect(enabled).toEqual(['Close']);
    });
  });
});
