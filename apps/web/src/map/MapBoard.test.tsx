// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachedTo,
  atLocation,
  blankEnemy,
  blankAgenda,
  blankLocation,
  blankTreachery,
  cardImagePath,
  engagedWith,
  fixed,
  instanceId,
  investigatorId,
  mapId,
  newGame,
  perInvestigator,
  PlayTable,
  resignAction,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { MapBoard } from './MapBoard';
import { DOUBLE_TAP_MS } from '../screens/useDoubleTap';
import type { Point } from './mapLayout';
import { PlayingOn } from '../state/gameActions.test_support';
import { boardWhere, investigatorWhere, locationWhere } from '../state/boardWhere.test_support';

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

const tile = (name: string) => screen.getByRole('group', { name });
/**
 * A single tap on a tile (`init` its pointer), which opens the location's details once no second
 * tap came within `DOUBLE_TAP_MS`, so the wait runs on fake timers.
 */
const tapOnce = (element: Element, init?: MouseEventInit) => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  fireEvent.click(element, init);
  act(() => vi.advanceTimersByTime(DOUBLE_TAP_MS));
  vi.useRealTimers();
};

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

  it("draws a tile per location with the board's shroud and its clues once revealed, its doom and attachments", () => {
    const table = PlayTable.start(
      house.withCard(
        instanceId('obscuring_fog'),
        blankTreachery('obscuring_fog'),
        attachedTo(study),
      ),
    );
    const board = locationWhere(table.board, study, { shroud: 4 });

    render(
      <PlayingOn table={table}>
        <MapBoard board={board} />
      </PlayingOn>,
    );

    expect(screen.getByRole('figure', { name: 'House' })).toBeTruthy();
    const tokensOf = (name: string) =>
      within(tile(name))
        .queryAllByRole('img')
        .map((token) => [token.getAttribute('aria-label'), token.textContent]);
    expect(tokensOf('study')).toEqual([
      ['Shroud 4', '4'],
      ['Clue value 0', '0'],
      ['Clues 2', '2'],
      ['Doom 1', '1'],
      ['Attached: obscuring_fog', ''],
    ]);
    expect(within(tile('study')).getByText('Location')).toBeTruthy();
    expect(tokensOf('hallway')).toEqual([]);
    expect(within(tile('hallway')).getByText('Unrevealed')).toBeTruthy();
    expect(within(tile('attic')).getByText('Unrevealed')).toBeTruthy();
  });

  it.each([
    { clues: fixed(3), label: 'Clue value 3', perInvestigatorSymbol: false },
    {
      clues: perInvestigator(2),
      label: 'Clue value 2 per investigator',
      perInvestigatorSymbol: true,
    },
    {
      clues: { fixed: 1, perInvestigator: 2 },
      label: 'Clue value 1+2 per investigator',
      perInvestigatorSymbol: true,
    },
  ])(
    'prints the clue value of the parlor as "$label" under the clues left on it',
    ({ clues, label, perInvestigatorSymbol }) => {
      const parlor = instanceId('parlor');
      const table = PlayTable.start(
        newGame().withLocation(parlor, blankLocation('parlor', { clues }), { revealed: true }),
      );

      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      const value = within(tile('parlor')).getByRole('img', { name: label });
      expect(value.querySelector('[data-symbol="per_investigator"]') !== null).toBe(
        perInvestigatorSymbol,
      );
    },
  );

  it.each([
    { side: 'revealed', revealed: true },
    { side: 'unrevealed', revealed: false },
  ])('names the connection symbol on the $side side of a tile', ({ revealed }) => {
    const parlor = instanceId('parlor');
    const table = PlayTable.start(
      newGame().withLocation(parlor, blankLocation('parlor', { symbol: 'diamond' }), { revealed }),
    );

    render(
      <PlayingOn table={table}>
        <MapBoard board={table.board} />
      </PlayingOn>,
    );

    expect(
      within(tile('parlor')).getByRole('img', { name: 'Connection symbol: diamond' }),
    ).toBeTruthy();
  });

  it("prints the parlor's Resign and free action on its tile, though alder is not there", () => {
    const parlor = instanceId('parlor');
    const table = PlayTable.start(
      newGame()
        .withLocation(
          parlor,
          blankLocation('parlor', { actions: [resignAction(), { free: true, effects: [] }] }),
          { revealed: true },
        )
        .withInvestigator(alder),
    );

    render(
      <PlayingOn table={table}>
        <MapBoard board={table.board} />
      </PlayingOn>,
    );

    const printed = within(tile('parlor'))
      .getAllByRole('paragraph')
      .map((line) => [within(line).getByRole('img').getAttribute('aria-label'), line.textContent]);
    expect(printed).toEqual([
      ['Action', ' Resign.'],
      ['Free', ' Action.'],
    ]);
  });

  it("prints one action symbol for each of the library's two actions its ability costs", () => {
    const library = instanceId('library');
    const table = PlayTable.start(
      newGame()
        .withLocation(
          library,
          blankLocation('library', { actions: [{ actions: 2, effects: [] }] }),
          {
            revealed: true,
          },
        )
        .withInvestigator(alder),
    );

    render(
      <PlayingOn table={table}>
        <MapBoard board={table.board} />
      </PlayingOn>,
    );

    const line = within(tile('library')).getByRole('paragraph');
    expect(
      within(line)
        .getAllByRole('img')
        .map((symbol) => symbol.getAttribute('aria-label')),
    ).toEqual(['Action', 'Action']);
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
    // The tokens on a tile are images too, one face per token set.
    const pictureOf = (name: string) => tile(name).querySelector('image:not([data-token-face])');
    const requiredPictureOf = (name: string) => {
      const picture = pictureOf(name);
      if (!picture) throw new Error(`${name} has no picture`);
      return picture;
    };

    it('fetches the picture from ArkhamDB and keeps the pattern face until it has loaded', () => {
      const table = PlayTable.start(withCellar);
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      expect(pictureOf('cellar')?.getAttribute('href')).toBe(
        'https://arkhamdb.com/bundles/cards/cellar_back.png',
      );
      expect(tile('cellar').hasAttribute('data-picture')).toBe(false);
      expect(pictureOf('study')).toBeNull();
    });

    it('shows the picture once it has loaded', () => {
      const table = PlayTable.start(withCellar);
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      fireEvent.load(requiredPictureOf('cellar'));

      expect(tile('cellar').getAttribute('data-picture')).toBe('shown');
    });

    it('cuts the art out of the picture into the art window of the tile', () => {
      const table = PlayTable.start(withCellar);
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

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
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      fireEvent.error(requiredPictureOf('cellar'));

      expect(tile('cellar').hasAttribute('data-picture')).toBe(false);
    });
  });

  it('names each connection after its locations and marks one-way ones', () => {
    const table = PlayTable.start(house);
    render(
      <PlayingOn table={table}>
        <MapBoard board={table.board} />
      </PlayingOn>,
    );

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

    render(
      <PlayingOn table={table}>
        <MapBoard board={table.board} />
      </PlayingOn>,
    );

    expect(screen.getByRole('figure', { name: 'House' })).toBeTruthy();
    expect(screen.queryByRole('figure', { name: 'Cellar' })).toBeNull();
    expect(screen.queryByRole('figure', { name: 'Empty study' })).toBeNull();
  });

  it('offers zoom icons named for screen readers', () => {
    const table = PlayTable.start(house);
    render(
      <PlayingOn table={table}>
        <MapBoard board={table.board} />
      </PlayingOn>,
    );

    const zoom = within(screen.getByRole('toolbar', { name: 'Zoom' }));
    expect(zoom.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Zoom in',
      'Zoom out',
      'Fit map',
    ]);
  });

  it('shows one map without tabs', () => {
    const table = PlayTable.start(house);
    render(
      <PlayingOn table={table}>
        <MapBoard board={table.board} />
      </PlayingOn>,
    );

    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('gives several visible maps a tab each and shows the chosen one, the first at the start', () => {
    const table = PlayTable.start(
      house
        .withMap(mapId('cellar'), { name: 'Cellar' })
        .withLocation(instanceId('cellar'), blankLocation('cellar'), { map: mapId('cellar') }),
    );
    render(
      <PlayingOn table={table}>
        <MapBoard board={table.board} />
      </PlayingOn>,
    );
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

  it.each([
    { key: 'ArrowRight', from: 'House', to: 'Cellar' },
    { key: 'ArrowRight', from: 'Garden', to: 'House' },
    { key: 'ArrowLeft', from: 'House', to: 'Garden' },
    { key: 'Home', from: 'Garden', to: 'House' },
    { key: 'End', from: 'House', to: 'Garden' },
  ])(
    'chooses the $to tab with $key from the $from tab and moves the focus there',
    ({ key, from, to }) => {
      const table = PlayTable.start(
        house
          .withMap(mapId('cellar'), { name: 'Cellar' })
          .withLocation(instanceId('cellar'), blankLocation('cellar'), { map: mapId('cellar') })
          .withMap(mapId('garden'), { name: 'Garden' })
          .withLocation(instanceId('garden'), blankLocation('garden'), { map: mapId('garden') }),
      );
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );
      const tab = (name: string) => screen.getByRole('tab', { name });
      fireEvent.click(tab(from));

      fireEvent.keyDown(tab(from), { key });

      expect(tab(to).getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement).toBe(tab(to));
      expect(tab(from).tabIndex).toBe(-1);
    },
  );

  it('shows the first map again once the chosen one has no locations left', () => {
    const cellar = mapId('cellar');
    const withCellar = PlayTable.start(
      house
        .withMap(cellar, { name: 'Cellar' })
        .withLocation(instanceId('cellar'), blankLocation('cellar'), { map: cellar }),
    );
    const { rerender } = render(
      <PlayingOn table={withCellar}>
        <MapBoard board={withCellar.board} />
      </PlayingOn>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Cellar' }));

    const cellarEmptied = PlayTable.start(house.withMap(cellar, { name: 'Cellar' }));
    rerender(
      <PlayingOn table={cellarEmptied}>
        <MapBoard board={cellarEmptied.board} />
      </PlayingOn>,
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

    render(
      <PlayingOn table={table}>
        <MapBoard board={table.board} />
      </PlayingOn>,
    );

    expect(
      within(tile('study')).getByRole('img', { name: 'alder, lead investigator' }),
    ).toBeTruthy();
    expect(
      within(tile('study')).getByRole('img', {
        name: 'ghoul, engaged with alder, 2 damage, exhausted',
      }),
    ).toBeTruthy();
    expect(within(tile('hallway')).getByRole('img', { name: 'rats' })).toBeTruthy();
  });

  it('lets the clue taken from a location rise from its count, and marks no count first shown', () => {
    const table = PlayTable.start(house.withInvestigator(alder, { locationId: study }));
    const board = () => (
      <PlayingOn table={table}>
        <MapBoard board={table.board} />
      </PlayingOn>
    );
    const { rerender } = render(board());
    expect(tile('study').querySelector('[data-changed]')).toBeNull();

    table.play({ type: 'DiscoverClues', investigatorId: alder, locationId: study, amount: 1 });
    rerender(board());

    const clues = within(tile('study')).getByRole('img', { name: 'Clues 1' });
    expect(clues.dataset.changed).toBe('');
    expect(clues.querySelector('[data-rising]')?.textContent).toBe('−1');
    expect(within(tile('study')).getByRole('img', { name: 'Doom 1' }).dataset.changed).toBe(
      undefined,
    );
  });

  it("lets the damage dealt to an enemy rise from its token's damage badge", () => {
    const ghoul = instanceId('ghoul');
    const table = PlayTable.start(
      house
        .withInvestigator(alder, { locationId: study })
        .withCard(ghoul, blankEnemy('ghoul', { health: fixed(3) }), atLocation(study)),
    );
    const board = () => (
      <PlayingOn table={table}>
        <MapBoard board={table.board} />
      </PlayingOn>
    );
    const { rerender } = render(board());

    table.play({ type: 'DamageEnemy', enemyId: ghoul, amount: 2 });
    rerender(board());

    const badge = tile('study').querySelector<SVGElement>('[data-marker="damage"]');
    expect(badge?.dataset.changed).toBe('');
    expect(badge?.querySelector('[data-rising]')?.textContent).toBe('+2');
  });

  it('fades an engaged enemy token, and shows its damage as a badge and its exhaustion on its initial', () => {
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

    render(
      <PlayingOn table={table}>
        <MapBoard board={table.board} />
      </PlayingOn>,
    );

    const ghoulToken = within(tile('study')).getByRole('img', { name: /^ghoul,/ });
    expect(ghoulToken.dataset.engaged).toBe('true');
    expect(ghoulToken.dataset.exhausted).toBe('true');
    // The badge lies beside the token, so a drag off it leaves the enemy in place.
    const damageBadge = tile('study').querySelector<SVGElement>('[data-marker="damage"]');
    expect(damageBadge?.textContent).toBe('2');
    expect(damageBadge?.dataset['engaged']).toBe('true');
    const ratsToken = within(tile('hallway')).getByRole('img', { name: 'rats' });
    expect(ratsToken.dataset.engaged).toBeUndefined();
    expect(ratsToken.dataset.exhausted).toBeUndefined();
    expect(tile('hallway').querySelector('[data-marker]')).toBeNull();
  });

  it('marks the lead investigator’s pawn and the pawn of the investigator whose turn it is', () => {
    const bea = investigatorId('bea');
    // The first investigator seated leads, as the first seat does at setup.
    const table = PlayTable.start(
      house
        .withInvestigator(bea, { locationId: study })
        .withInvestigator(alder, { locationId: study })
        .withTurnOf(alder),
    );

    render(
      <PlayingOn table={table}>
        <MapBoard board={table.board} />
      </PlayingOn>,
    );

    expect(within(tile('study')).getByRole('img', { name: 'bea, lead investigator' })).toBeTruthy();
    expect(within(tile('study')).getByRole('img', { name: 'alder, their turn' })).toBeTruthy();
  });

  // The Study's tile spans 0–150 across and 0–210 down. Pieces stand in a row along its bottom
  // edge, investigators first: the first centred on (24, 186), an enemy engaged with them next on
  // (58, 186), and an enemy engaged with no one after a line, on (70, 186). The Study's clue count
  // sits on its clue value, centred on (127, 122). The Hallway's tile starts at x 180.
  describe('dragging pieces', () => {
    const firstPawn = { x: 24, y: 186 };
    const clueCount = { x: 127, y: 122 };
    const enemyAlone = { x: 24, y: 186 };
    const enemyEngagedWithAlder = { x: 58, y: 186 };
    const enemyPastAlder = { x: 70, y: 186 };
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
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      await drag('study', 'alder, lead investigator, their turn', firstPawn, 255, 105);

      expect(table.board.investigator(alder).at).toBe('hallway');
    });

    it.each([
      { where: 'on their own location', x: 75, y: 105 },
      { where: 'between two tiles', x: 165, y: 105 },
    ])('leaves the investigator in place when dropped $where', async ({ x, y }) => {
      const table = PlayTable.start(
        house.withInvestigator(alder, { locationId: study }).withTurnOf(alder),
      );
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      await drag('study', 'alder, lead investigator, their turn', firstPawn, x, y);

      expect(table.board.investigator(alder).at).toBe('study');
    });

    it('leaves the pawn in place while a step is still queued', async () => {
      const table = PlayTable.start(
        house.withInvestigator(alder, { locationId: study }).withTurnOf(alder),
      );
      render(
        <PlayingOn table={table} busy>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      await drag('study', 'alder, lead investigator, their turn', firstPawn, 255, 105);

      expect(table.board.investigator(alder).at).toBe('study');
    });

    it('leaves the pawns of the other investigators in place', async () => {
      const table = PlayTable.start(
        house
          .withInvestigator(bea, { locationId: study })
          .withInvestigator(alder, { locationId: study })
          .withTurnOf(alder),
      );
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      await drag('study', 'bea, lead investigator', firstPawn, 255, 105);

      expect(table.board.investigator(bea).at).toBe('study');
    });

    // jsdom lays nothing out, so the hit test for an investigator's panel under the pointer finds
    // what a test puts under it, nothing unless it says so.
    describe('a clue', () => {
      let underPointer: Element | null = null;
      beforeEach(() => {
        underPointer = null;
        document.elementFromPoint = () => underPointer;
      });
      afterEach(() => {
        Reflect.deleteProperty(document, 'elementFromPoint');
      });

      it("gives a clue dragged off the study to the investigator whose pawn it is dropped on, whoever's turn it is", async () => {
        const table = PlayTable.start(
          house
            .withInvestigator(bea, { locationId: study })
            .withInvestigator(alder, { locationId: study })
            .withTurnOf(alder),
        );
        render(
          <PlayingOn table={table}>
            <MapBoard board={table.board} />
          </PlayingOn>,
        );

        // bea came first, so the first pawn is bea's, not that of alder, whose turn it is.
        await drag('study', 'Clues 2', clueCount, firstPawn.x, firstPawn.y);

        expect(table.board.investigator(bea).clues).toBe(1);
        expect(table.board.location(study).clues).toBe(1);
      });

      it("opens the study's details on a tap on its clue count", async () => {
        const table = PlayTable.start(
          house.withInvestigator(alder, { locationId: study }).withTurnOf(alder),
        );
        render(
          <PlayingOn table={table}>
            <MapBoard board={table.board} />
          </PlayingOn>,
        );

        await drag('study', 'Clues 2', clueCount, clueCount.x, clueCount.y);
        tapOnce(within(tile('study')).getByRole('img', { name: 'Clues 2' }), {
          clientX: clueCount.x,
          clientY: clueCount.y,
        });

        expect(screen.getByRole('dialog', { name: 'study' })).toBeTruthy();
        expect(table.board.location(study).clues).toBe(2);
      });

      it.each([
        { where: 'on another location', x: 255, y: 105 },
        { where: 'on the study, off any pawn', x: 75, y: 105 },
      ])('leaves the clue on the study when dropped $where', async ({ x, y }) => {
        const table = PlayTable.start(
          house.withInvestigator(alder, { locationId: study }).withTurnOf(alder),
        );
        render(
          <PlayingOn table={table}>
            <MapBoard board={table.board} />
          </PlayingOn>,
        );

        await drag('study', 'Clues 2', clueCount, x, y);

        expect(table.board.location(study).clues).toBe(2);
        expect(table.board.investigator(alder).clues).toBe(0);
      });

      it("gives a clue dropped on bea's panel beside the map to bea", async () => {
        const table = PlayTable.start(
          house
            .withInvestigator(bea, { locationId: study })
            .withInvestigator(alder, { locationId: study })
            .withTurnOf(alder),
        );
        render(
          <>
            <PlayingOn table={table}>
              <MapBoard board={table.board} />
            </PlayingOn>
            <section data-investigator="bea">
              <h3>bea</h3>
            </section>
          </>,
        );
        underPointer = screen.getByRole('heading', { name: 'bea' });

        await drag('study', 'Clues 2', clueCount, 600, 400);

        expect(table.board.investigator(bea).clues).toBe(1);
      });

      it("gives the clue to alder when alder's panel lies over bea's pawn, panned out of sight", async () => {
        const table = PlayTable.start(
          house
            .withInvestigator(bea, { locationId: study })
            .withInvestigator(alder, { locationId: study })
            .withTurnOf(alder),
        );
        render(
          <>
            <PlayingOn table={table}>
              <MapBoard board={table.board} />
            </PlayingOn>
            <section data-investigator="alder">
              <h3>alder</h3>
            </section>
          </>,
        );
        underPointer = screen.getByRole('heading', { name: 'alder' });

        await drag('study', 'Clues 2', clueCount, firstPawn.x, firstPawn.y);

        expect(table.board.investigator(alder).clues).toBe(1);
        expect(table.board.investigator(bea).clues).toBe(0);
      });

      it('shows a clue token over the page while it is dragged, and none once it is dropped', () => {
        const table = PlayTable.start(
          house.withInvestigator(alder, { locationId: study }).withTurnOf(alder),
        );
        render(
          <PlayingOn table={table}>
            <MapBoard board={table.board} />
          </PlayingOn>,
        );
        const clues = within(tile('study')).getByRole('img', { name: 'Clues 2' });

        fireEvent.pointerDown(clues, { pointerId: 1, clientX: clueCount.x, clientY: clueCount.y });
        fireEvent.pointerMove(clues, { pointerId: 1, clientX: 600, clientY: 400 });
        const dragged = document.body.querySelector<HTMLElement>('[data-token-ghost="clue"]');
        fireEvent.pointerUp(clues, { pointerId: 1, clientX: 600, clientY: 400 });

        expect(dragged?.style.getPropertyValue('--ghost-x')).toBe('600px');
        expect(dragged?.style.getPropertyValue('--ghost-y')).toBe('400px');
        expect(document.body.querySelector('[data-token-ghost]')).toBeNull();
      });
    });

    // The Study's doom sits under its clue count, centred on (136, 141). jsdom lays nothing out,
    // so the hit test for the agenda or the token pool under the pointer finds what a test puts
    // under it.
    describe('doom and the token pool', () => {
      const doomToken = { x: 136, y: 141 };
      let underPointer: Element | null = null;
      beforeEach(() => {
        underPointer = null;
        document.elementFromPoint = () => underPointer;
      });
      afterEach(() => {
        Reflect.deleteProperty(document, 'elementFromPoint');
      });

      it('moves a doom dragged off the study to the hallway it is dropped on', async () => {
        const table = PlayTable.start(house.withInvestigator(alder, { locationId: study }));
        render(
          <PlayingOn table={table}>
            <MapBoard board={table.board} />
          </PlayingOn>,
        );

        await drag('study', 'Doom 1', doomToken, 255, 105);

        expect(table.board.location(study).doom).toBeUndefined();
        expect(table.board.location(hallway).doom).toBe(1);
        expect(table.board.doomInPlay).toBe(1);
      });

      it('moves a doom dropped on the agenda in the header off the study onto the agenda', async () => {
        const agenda = instanceId('agenda');
        const table = PlayTable.start(
          house
            .withAgenda(agenda, blankAgenda('agenda', fixed(3)))
            .withInvestigator(alder, { locationId: study }),
        );
        render(
          <>
            <PlayingOn table={table}>
              <MapBoard board={table.board} />
            </PlayingOn>
            <section data-slot="agenda">
              <h3>agenda</h3>
            </section>
          </>,
        );
        underPointer = screen.getByRole('heading', { name: 'agenda' });

        await drag('study', 'Doom 1', doomToken, 600, 40);

        expect(table.board.location(study).doom).toBeUndefined();
        expect(table.board.agenda?.doom).toBe(1);
      });

      it.each([
        { token: 'doom', name: 'Doom 1', from: doomToken, clues: 2, doom: 0 },
        { token: 'clue', name: 'Clues 2', from: { x: 127, y: 122 }, clues: 1, doom: 1 },
      ])(
        'gives a $token dropped on the token pool in the header back to it: the study keeps $clues clues and $doom doom',
        async ({ name, from, clues, doom }) => {
          const table = PlayTable.start(house.withInvestigator(alder, { locationId: study }));
          render(
            <>
              <PlayingOn table={table}>
                <MapBoard board={table.board} />
              </PlayingOn>
              <section data-pool>
                <h3>pool</h3>
              </section>
            </>,
          );
          underPointer = screen.getByRole('heading', { name: 'pool' });

          await drag('study', name, from, 600, 40);

          expect(table.board.location(study).clues).toBe(clues);
          expect(table.board.location(study).doom ?? 0).toBe(doom);
        },
      );

      it('leaves the doom on the study when dropped on the study itself', async () => {
        const table = PlayTable.start(house.withInvestigator(alder, { locationId: study }));
        render(
          <PlayingOn table={table}>
            <MapBoard board={table.board} />
          </PlayingOn>,
        );

        await drag('study', 'Doom 1', doomToken, 75, 105);

        expect(table.board.location(study).doom).toBe(1);
      });

      describe('on a cultist', () => {
        const ghoul = instanceId('ghoul');
        /**
         * The house with a ghoul in the study that carries one doom, as a cultist gains it, beside
         * the study's own doom. Alder
         * waits in the hallway, so the ghoul engages no one.
         */
        const cultistInStudy = house
          .withInvestigator(alder, { locationId: hallway })
          .withCard(ghoul, blankEnemy('ghoul'), atLocation(study), { tokens: { doom: 1 } });
        const ghoulToken = () => within(tile('study')).getByRole('img', { name: 'ghoul, Doom 1' });

        /** Where the ghoul's doom badge is pressed; jsdom lays nothing out, so any point does. */
        const ghoulDoomBadge = { x: 100, y: 160 };

        /** Drags the doom badge off the ghoul in the study and lets go at (`x`, `y`). */
        async function dragGhoulDoom(x: number, y: number) {
          const badge = tile('study').querySelector<SVGElement>('[data-marker="doom"]');
          if (!badge) throw new Error('The ghoul shows no doom badge');
          fireEvent.pointerDown(badge, {
            pointerId: 1,
            clientX: ghoulDoomBadge.x,
            clientY: ghoulDoomBadge.y,
          });
          fireEvent.pointerMove(badge, { pointerId: 1, clientX: x, clientY: y });
          fireEvent.pointerUp(badge, { pointerId: 1, clientX: x, clientY: y });
          await act(async () => {});
        }

        it('shows the doom as a badge on the ghoul that can be dragged off', () => {
          const table = PlayTable.start(cultistInStudy);
          render(
            <PlayingOn table={table}>
              <MapBoard board={table.board} />
            </PlayingOn>,
          );

          const badge = tile('study').querySelector<SVGElement>('[data-marker="doom"]');
          expect(badge?.textContent).toBe('1');
          expect(badge?.dataset['drag']).toBe('doom');
          expect(badge?.querySelector('[data-svg-game-token="doom"]')).not.toBeNull();
        });

        it("opens the ghoul's details, not the study's, on a tap on its doom badge", async () => {
          const table = PlayTable.start(cultistInStudy);
          render(
            <PlayingOn table={table}>
              <MapBoard board={table.board} />
            </PlayingOn>,
          );
          const badge = tile('study').querySelector<SVGElement>('[data-marker="doom"]');
          if (!badge) throw new Error('The ghoul shows no doom badge');

          // The details open once no second tap came, so the wait runs on fake timers.
          vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
          fireEvent.pointerDown(badge, {
            pointerId: 1,
            clientX: ghoulDoomBadge.x,
            clientY: ghoulDoomBadge.y,
          });
          fireEvent.pointerUp(badge, {
            pointerId: 1,
            clientX: ghoulDoomBadge.x,
            clientY: ghoulDoomBadge.y,
          });
          fireEvent.click(badge, { clientX: ghoulDoomBadge.x, clientY: ghoulDoomBadge.y });
          act(() => vi.advanceTimersByTime(DOUBLE_TAP_MS));
          vi.useRealTimers();
          await act(async () => {});

          expect(screen.getByRole('dialog', { name: 'ghoul' })).toBeTruthy();
          expect(screen.queryByRole('dialog', { name: 'study' })).toBeNull();
        });

        it('moves the doom dragged off the ghoul to the hallway it is dropped on', async () => {
          const table = PlayTable.start(cultistInStudy);
          render(
            <PlayingOn table={table}>
              <MapBoard board={table.board} />
            </PlayingOn>,
          );

          await dragGhoulDoom(255, 105);

          expect(table.board.enemy(ghoul).doom).toBeUndefined();
          expect(table.board.location(hallway).doom).toBe(1);
        });

        it('moves a doom dragged off the study onto the ghoul under the pointer', async () => {
          const table = PlayTable.start(cultistInStudy);
          render(
            <PlayingOn table={table}>
              <MapBoard board={table.board} />
            </PlayingOn>,
          );
          underPointer = ghoulToken();

          await drag('study', 'Doom 1', doomToken, ghoulDoomBadge.x, ghoulDoomBadge.y);

          expect(table.board.location(study).doom).toBeUndefined();
          expect(table.board.enemy(ghoul).doom).toBe(2);
        });

        it("gives the ghoul's doom dropped on the token pool back to it", async () => {
          const table = PlayTable.start(cultistInStudy);
          render(
            <>
              <PlayingOn table={table}>
                <MapBoard board={table.board} />
              </PlayingOn>
              <section data-pool>
                <h3>pool</h3>
              </section>
            </>,
          );
          underPointer = screen.getByRole('heading', { name: 'pool' });

          await dragGhoulDoom(600, 40);

          expect(table.board.enemy(ghoul).doom).toBeUndefined();
          expect(table.board.location(study).doom).toBe(1);
          expect(table.board.doomInPlay).toBe(1);
        });
      });

      it("heals the ghoul's damage dragged off its damage badge onto the token pool", async () => {
        const ghoul = instanceId('ghoul');
        const table = PlayTable.start(
          house
            .withInvestigator(alder, { locationId: hallway })
            .withCard(ghoul, blankEnemy('ghoul', { health: fixed(3) }), atLocation(study), {
              tokens: { damage: 2 },
            }),
        );
        render(
          <>
            <PlayingOn table={table}>
              <MapBoard board={table.board} />
            </PlayingOn>
            <section data-pool>
              <h3>pool</h3>
            </section>
          </>,
        );
        underPointer = screen.getByRole('heading', { name: 'pool' });
        const badge = tile('study').querySelector<SVGElement>('[data-marker="damage"]');
        if (!badge) throw new Error('The ghoul shows no damage badge');

        fireEvent.pointerDown(badge, { pointerId: 1, clientX: 100, clientY: 160 });
        fireEvent.pointerMove(badge, { pointerId: 1, clientX: 600, clientY: 40 });
        fireEvent.pointerUp(badge, { pointerId: 1, clientX: 600, clientY: 40 });
        await act(async () => {});

        expect(table.board.enemy(ghoul).damage).toBe(1);
      });

      it('shows a doom token over the page while it is dragged', () => {
        const table = PlayTable.start(house.withInvestigator(alder, { locationId: study }));
        render(
          <PlayingOn table={table}>
            <MapBoard board={table.board} />
          </PlayingOn>,
        );
        const doom = within(tile('study')).getByRole('img', { name: 'Doom 1' });

        fireEvent.pointerDown(doom, { pointerId: 1, clientX: doomToken.x, clientY: doomToken.y });
        fireEvent.pointerMove(doom, { pointerId: 1, clientX: 600, clientY: 40 });

        expect(document.body.querySelector('[data-token-ghost="doom"]')).not.toBeNull();
      });
    });

    it('moves an enemy to the location it is dropped on, connected or not', async () => {
      const table = PlayTable.start(
        house.withCard(rats, blankEnemy('rats', { health: fixed(1) }), atLocation(study)),
      );
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      await drag('study', 'rats', enemyAlone, 255, 105);

      expect(table.board.enemy(rats)).toEqual({ name: 'rats', at: 'hallway', health: 1 });
    });

    it('disengages an engaged enemy and moves it to the location it is dropped on', async () => {
      const table = PlayTable.start(
        house
          .withInvestigator(alder, { locationId: study })
          .withCard(rats, blankEnemy('rats', { health: fixed(1) }), engagedWith(alder)),
      );
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      await drag('study', 'rats, engaged with alder', enemyEngagedWithAlder, 255, 105);

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
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      await drag('study', 'aloof_rats', enemyPastAlder, 24, 186);

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
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      await drag('study', 'rats', enemyAlone, x, y);

      expect(table.board.enemy(rats)).toEqual({ name: 'rats', at: 'study', health: 1 });
    });

    it('leaves an enemy in place while a step is still queued', async () => {
      const table = PlayTable.start(
        house.withCard(rats, blankEnemy('rats', { health: fixed(1) }), atLocation(study)),
      );
      render(
        <PlayingOn table={table} busy>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      await drag('study', 'rats', enemyAlone, 255, 105);

      expect(table.board.enemy(rats)).toEqual({ name: 'rats', at: 'study', health: 1 });
    });
  });

  describe('tapping an enemy', () => {
    const rats = instanceId('rats');
    const enemyDetails = () => screen.getByRole('dialog', { name: 'rats' });
    const offered = () =>
      within(enemyDetails())
        .queryAllByRole('button')
        .map((button) => button.getAttribute('aria-label') ?? button.textContent);

    /**
     * Presses the piece named `name` on the tile of `location` and lets go where it went down,
     * `times` times in quick succession, then waits out a second tap (`DOUBLE_TAP_MS`, on fake
     * timers).
     */
    async function tapPiece(location: string, name: string, times = 1) {
      const piece = within(tile(location)).getByRole('img', { name });
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      for (let tap = 0; tap < times; tap++) {
        fireEvent.pointerDown(piece, { pointerId: 1, clientX: 50, clientY: 50 });
        fireEvent.pointerUp(piece, { pointerId: 1, clientX: 50, clientY: 50 });
        fireEvent.click(piece, { clientX: 50, clientY: 50 });
      }
      act(() => vi.advanceTimersByTime(DOUBLE_TAP_MS));
      vi.useRealTimers();
      await act(async () => {});
    }

    /**
     * Alder's turn in the Study, with aloof rats (health 2) there, which stay unengaged until
     * someone engages them.
     */
    const aldersTurnWithRats = () =>
      PlayTable.start(
        house
          .withInvestigator(alder, { locationId: study })
          .withCard(
            rats,
            blankEnemy('rats', { health: fixed(2), keywords: [{ name: 'aloof' }] }),
            atLocation(study),
          )
          .withTurnOf(alder),
      );

    it.each([
      { button: 'Deal 1 damage', damage: 1, doom: 0 },
      { button: 'Add doom', damage: 0, doom: 1 },
    ])(
      'opens the damage and doom bubble of the rats on a double tap, where "$button" leaves $damage damage and $doom doom',
      async ({ button, damage, doom }) => {
        const table = aldersTurnWithRats();
        render(
          <PlayingOn table={table}>
            <MapBoard board={table.board} />
          </PlayingOn>,
        );

        await tapPiece('study', 'rats', 2);
        fireEvent.click(
          within(screen.getByRole('complementary', { name: 'rats' })).getByRole('button', {
            name: button,
          }),
        );

        expect(screen.queryByRole('dialog')).toBeNull();
        await expect.poll(() => table.board.enemy(rats).damage ?? 0).toBe(damage);
        expect(table.board.enemy(rats).doom ?? 0).toBe(doom);
      },
    );

    it("opens the enemy's details, not the tile's, with engage for an aloof enemy at the investigator's location", async () => {
      const table = aldersTurnWithRats();
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      await tapPiece('study', 'rats');

      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(offered()).toEqual([
        'Read rats',
        'Close',
        'Ways to fight',
        'Ways to evade',
        'Engage · 1 action',
        'Deal 1 damage',
        'Exhaust',
        'Evaded by alder',
        'Engages alder',
        'Defeat',
        'Attach a card',
      ]);
    });

    it('engages the enemy as an action and keeps its details open', async () => {
      const table = aldersTurnWithRats();
      const { rerender } = render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );
      await tapPiece('study', 'rats');

      fireEvent.click(screen.getByRole('button', { name: 'Engage · 1 action' }));
      await act(async () => {});
      rerender(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      expect(table.board.enemy(rats)).toMatchObject({ engagedWith: alder });
      expect(table.board.investigator(alder).actions).toBe(2);
      expect(screen.getByText('Engaged with alder')).toBeTruthy();
      expect(offered()).not.toContain('Engage · 1 action');
    });

    it("fights an enemy engaged with another investigator at the investigator's location", async () => {
      const bea = investigatorId('bea');
      const table = PlayTable.start(
        house
          .withInvestigator(alder, { locationId: study })
          .withInvestigator(bea, { locationId: study })
          .withCard(rats, blankEnemy('rats', { health: fixed(2) }), engagedWith(bea))
          .withTurnOf(alder),
      );
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );
      await tapPiece('study', 'rats, engaged with bea');

      fireEvent.click(screen.getByRole('button', { name: 'Fight · 1 action' }));
      await act(async () => {});

      expect(table.board.decisions).toMatchObject([{ prompt: 'decision.fight', about: 'rats' }]);
    });

    it('offers only the card effects for an enemy at another location', async () => {
      const table = PlayTable.start(
        house
          .withInvestigator(alder, { locationId: hallway })
          .withCard(rats, blankEnemy('rats', { health: fixed(2) }), atLocation(study))
          .withTurnOf(alder),
      );
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      await tapPiece('study', 'rats');

      expect(offered()).toEqual([
        'Read rats',
        'Close',
        'Ways to fight',
        'Ways to evade',
        'Deal 1 damage',
        'Exhaust',
        'Ways to swap places',
        'Defeat',
        'Attach a card',
      ]);
    });
  });

  describe('the location details', () => {
    const details = (name: string) => screen.getByRole('dialog', { name });
    const tap = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
    /** The details' buttons, leaving out the card beside the page, which every location has. */
    const offered = (name: string) =>
      within(details(name))
        .queryAllByRole('button')
        .filter((button) => button.dataset['part'] !== 'subject')
        .map((button) => button.getAttribute('aria-label') ?? button.textContent);
    /**
     * Alder's turn in the study, with a ghoul engaged with Alder there. The house connects the
     * study with the hallway, and the hallway with the attic one way only.
     */
    const aldersTurn = () =>
      PlayTable.start(
        house
          .withInvestigator(alder, { locationId: study })
          .withCard(instanceId('ghoul'), blankEnemy('ghoul'), engagedWith(alder))
          .withTurnOf(alder),
      );

    it('opens from a tap on the tile and closes again', () => {
      const table = PlayTable.start(house);
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      tapOnce(tile('hallway'));
      expect(details('hallway')).toBeTruthy();

      tap('Close');
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('hands the tapped location to onPick instead of opening its details', () => {
      const table = PlayTable.start(house);
      const picked: string[] = [];
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} onPick={(location) => picked.push(location)} />
        </PlayingOn>,
      );

      tapOnce(tile('hallway'));

      expect(picked).toEqual(['hallway']);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it.each([
      { pickable: undefined, lit: ['study', 'hallway'] },
      { pickable: [hallway], lit: ['hallway'] },
    ])('lights $lit while picking among $pickable', ({ pickable, lit }) => {
      const table = PlayTable.start(house);
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} onPick={() => {}} pickable={pickable} />
        </PlayingOn>,
      );

      expect(
        ['study', 'hallway'].filter((name) => tile(name).hasAttribute('data-pickable')),
      ).toEqual(lit);
    });

    it('opens nothing when the press moves on, as a pan of the map does', () => {
      const table = PlayTable.start(house);
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      fireEvent.pointerDown(tile('hallway'), { clientX: 200, clientY: 100 });
      fireEvent.click(tile('hallway'), { clientX: 240, clientY: 100 });

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it.each(['Enter', ' '])('opens from the details button by the %j key', (key) => {
      const table = PlayTable.start(house);
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      fireEvent.keyDown(
        within(tile('hallway')).getByRole('button', { name: 'Details of hallway' }),
        { key },
      );

      expect(details('hallway')).toBeTruthy();
    });

    it('shows the shroud, the clues and who is there', () => {
      const table = aldersTurn();
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      tapOnce(tile('study'));

      const texts = (role: 'term' | 'definition') =>
        within(details('study'))
          .getAllByRole(role)
          .map((value) => value.textContent);
      expect(texts('term')).toEqual(['Shroud', 'Clues']);
      // The blank study prints no clue value; its 2 clues were put on it by hand.
      expect(texts('definition')).toEqual(['2', '2 / 0']);
      expect(
        within(within(details('study')).getByRole('region', { name: 'Here' }))
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual(['alder', 'ghoul, engaged with alder']);
    });

    it('draws the card and names the cards attached to the study', () => {
      const table = PlayTable.start(
        house.withCard(
          instanceId('obscuring_fog'),
          blankTreachery('obscuring_fog'),
          attachedTo(study),
        ),
      );
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      tapOnce(tile('study'));

      expect(within(details('study')).getByRole('img', { name: 'The card of study' })).toBeTruthy();
      const attached = within(details('study')).getByRole('region', { name: 'Attached' });
      expect(
        within(attached)
          .getAllByRole('button')
          .map((button) => button.getAttribute('aria-label')),
      ).toEqual(['Read obscuring_fog', 'Attach a card']);
    });

    it('opens an attached card to read, and Escape there leaves the study open', () => {
      const table = PlayTable.start(
        house.withCard(
          instanceId('obscuring_fog'),
          blankTreachery('obscuring_fog'),
          attachedTo(study),
        ),
      );
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );
      tapOnce(tile('study'));

      fireEvent.click(within(details('study')).getByRole('button', { name: 'Read obscuring_fog' }));
      fireEvent(screen.getByRole('dialog', { name: 'obscuring_fog' }), new Event('cancel'));

      expect(screen.queryByRole('dialog', { name: 'obscuring_fog' })).toBeNull();
      expect(details('study')).toBeTruthy();
    });

    it.each([
      {
        location: 'study',
        buttons: [
          'Close',
          'hallway',
          'Investigate · 1 action',
          'Ways to investigate',
          'Take a clue, no test',
          'Attach a card',
        ],
      },
      {
        location: 'hallway',
        buttons: [
          'Close',
          'study · attic',
          'Move here · 1 action',
          'Ways to move here',
          'Reveal',
          'Attach a card',
        ],
      },
      { location: 'attic', buttons: ['Close', 'No location', 'Reveal', 'Attach a card'] },
    ])('offers alder in the study at the $location: $buttons', ({ location, buttons }) => {
      const table = aldersTurn();
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      tapOnce(tile(location));

      expect(offered(location)).toEqual(buttons);
    });

    /** Opens the menu of `location`'s connections from the line that names them. */
    const changeConnections = (location: string) =>
      fireEvent.click(
        within(within(details(location)).getByRole('region', { name: 'Connected to' })).getByRole(
          'button',
          { expanded: false },
        ),
      );
    /** Ticks or unticks `other` in the open menu of connections. */
    const toggleConnection = (other: string) =>
      fireEvent.click(
        within(screen.getByRole('list', { name: 'Change connections' })).getByRole('button', {
          name: other,
        }),
      );

    it('names where a move from the study goes under who is there', () => {
      const table = PlayTable.start(house);
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      tapOnce(tile('study'));

      expect(
        within(within(details('study')).getByRole('region', { name: 'Connected to' })).getByRole(
          'button',
        ).textContent,
      ).toBe('hallway');
    });

    it('ticks the other locations a move from the study goes to in the menu of its connections', () => {
      const table = PlayTable.start(house);
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      tapOnce(tile('study'));
      changeConnections('study');

      const connections = within(details('study')).getByRole('list', {
        name: 'Change connections',
      });
      expect(
        within(connections)
          .getAllByRole('button')
          .map((button) => [button.textContent, button.getAttribute('aria-pressed')]),
      ).toEqual([
        ['hallway', 'true'],
        ['attic', 'false'],
      ]);
    });

    it('connects the study to the attic, as a card that connects them does', async () => {
      const table = PlayTable.start(house);
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      tapOnce(tile('study'));
      changeConnections('study');
      toggleConnection('attic');

      await expect.poll(() => table.board.connectedTo(study)).toEqual([hallway, attic]);
    });

    it('disconnects the study from the hallway', async () => {
      const table = PlayTable.start(house);
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      tapOnce(tile('study'));
      changeConnections('study');
      toggleConnection('hallway');

      await expect.poll(() => table.board.connectedTo(study)).toEqual([]);
    });

    it('disconnects the hallway from the attic, which leads only one way', async () => {
      const table = PlayTable.start(house);
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      tapOnce(tile('hallway'));
      changeConnections('hallway');
      toggleConnection('attic');

      await expect.poll(() => table.board.connectedTo(hallway)).toEqual([study]);
    });

    it('reveals the unrevealed hallway from its details', async () => {
      const table = PlayTable.start(house);
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      tapOnce(tile('hallway'));
      tap('Reveal');

      await expect.poll(() => table.board.location(hallway).revealed).toBe(true);
    });

    it("offers the hallway's move as an action, and lists it first in its ways, then the free move", () => {
      const table = aldersTurn();
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      tapOnce(tile('hallway'));
      const moves = within(details('hallway')).getByRole('region', { name: 'Actions' });
      const move = within(moves).getByRole('button', { name: 'Move here · 1 action' });
      fireEvent.click(within(moves).getByRole('button', { name: 'Ways to move here' }));
      const ways = within(moves).getByRole('list', { name: 'Ways to move here' });

      expect(move.dataset['cost']).toBe('action');
      expect(
        within(ways)
          .getAllByRole('button')
          .map((button) => button.textContent),
      ).toEqual(['Move here · 1 action', 'Move here, no action']);
    });

    it("marks the hallway's move with two arrows while a move costs alder two, and its ways name the extra action of the free move", () => {
      const table = aldersTurn();
      const board = boardWhere(table.board, {
        actionCost: (_investigator, _action, cost) => (cost?.free ? 1 : 2),
      });
      render(
        <PlayingOn table={table}>
          <MapBoard board={board} />
        </PlayingOn>,
      );

      tapOnce(tile('hallway'));

      const moves = within(details('hallway')).getByRole('region', { name: 'Actions' });
      const move = within(moves).getByRole('button', { name: 'Move here · 2 actions' });
      fireEvent.click(within(moves).getByRole('button', { name: 'Ways to move here' }));
      const ways = within(moves).getByRole('list', { name: 'Ways to move here' });

      expect(move.dataset['actions']).toBe('2');
      expect(
        within(ways)
          .getAllByRole('button')
          .map((button) => button.textContent),
      ).toEqual(['Move here · 2 actions', 'Move here without an action · 1 extra action']);
    });

    it('prices the move by its destination, so a card that taxes entering the hallway marks it', () => {
      const table = aldersTurn();
      const board = boardWhere(table.board, {
        actionCost: (_investigator, _action, cost) => (cost?.to === hallway ? 2 : 1),
      });
      render(
        <PlayingOn table={table}>
          <MapBoard board={board} />
        </PlayingOn>,
      );

      tapOnce(tile('hallway'));

      const moves = within(details('hallway')).getByRole('region', { name: 'Actions' });
      expect(within(moves).getByRole('button', { name: 'Move here · 2 actions' })).toBeTruthy();
    });

    describe('alder and bea in the study, entering the unrevealed hallway costs 4 clues as a group', () => {
      const bea = investigatorId('bea');
      const guarded = blankLocation('hallway', {
        enterCost: { spend: 'groupClues', amount: fixed(4) },
      });
      const beforeTheGuardedHallway = (clues: number) =>
        PlayTable.start(
          newGame()
            .withMap(mapId('main'), { name: 'House' })
            .withLocation(study, blankLocation('study'), {
              revealed: true,
              at: { column: 0, row: 0 },
            })
            .withLocation(hallway, guarded, { at: { column: 3, row: 0 } })
            .withConnection(study, hallway)
            .withInvestigator(alder, { locationId: study, clues })
            .withInvestigator(bea, { locationId: study, clues })
            .withTurnOf(alder),
        );

      it('asks who pays the 4 clues as alder moves there, and moves him once they pay', async () => {
        const table = beforeTheGuardedHallway(3);
        render(
          <PlayingOn table={table}>
            <MapBoard board={table.board} />
          </PlayingOn>,
        );
        tapOnce(tile('hallway'));

        fireEvent.click(screen.getByRole('button', { name: 'Move here · 1 action' }));
        const dialog = screen.getByRole('dialog', { name: 'Who pays the clues?' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Split evenly' }));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Pay' }));

        await expect.poll(() => table.board.investigator(alder).at).toBe('hallway');
        expect(table.board.investigator(alder)).toMatchObject({ clues: 1, actions: 2 });
        expect(table.board.investigator(bea).clues).toBe(1);
      });

      it('turns the move off while alder and bea hold only 2 clues between them', () => {
        const table = beforeTheGuardedHallway(1);
        render(
          <PlayingOn table={table}>
            <MapBoard board={table.board} />
          </PlayingOn>,
        );

        tapOnce(tile('hallway'));

        const moves = within(details('hallway')).getByRole('region', { name: 'Actions' });
        expect(
          within(moves).getByRole<HTMLButtonElement>('button', { name: 'Move here · 1 action' })
            .disabled,
        ).toBe(true);
      });
    });

    it.each([
      {
        button: 'Take a clue, no test',
        state: 'alder may not discover clues',
        board: (table: PlayTable) =>
          investigatorWhere(table.board, alder, { forbidden: { clues: ['discover'] } }),
      },
      {
        button: 'Investigate · 1 action',
        state: 'the study forbids investigating it',
        board: (table: PlayTable) =>
          locationWhere(table.board, study, { forbidden: ['investigate'] }),
      },
    ])('turns "$button" in the study off while $state', ({ button, board }) => {
      const table = aldersTurn();
      render(
        <PlayingOn table={table}>
          <MapBoard board={board(table)} />
        </PlayingOn>,
      );

      tapOnce(tile('study'));

      expect(within(details('study')).getByRole('button', { name: button })).toHaveProperty(
        'disabled',
        true,
      );
    });

    it('offers no move into the hallway while it bars moving in', () => {
      const table = aldersTurn();
      render(
        <PlayingOn table={table}>
          <MapBoard board={locationWhere(table.board, hallway, { forbidden: ['moveInto'] })} />
        </PlayingOn>,
      );

      tapOnce(tile('hallway'));

      expect(offered('hallway')).toEqual(['Close', 'study · attic', 'Reveal', 'Attach a card']);
    });

    describe("the parlor's Resign", () => {
      const parlor = instanceId('parlor');
      const aldersTurnInTheParlor = () =>
        PlayTable.start(
          newGame()
            .withLocation(parlor, blankLocation('parlor', { actions: [resignAction()] }), {
              revealed: true,
            })
            .withInvestigator(alder, { locationId: parlor })
            .withTurnOf(alder),
        );

      it('offers it among the card actions, resigns alder and closes', async () => {
        const table = aldersTurnInTheParlor();
        render(
          <PlayingOn table={table}>
            <MapBoard board={table.board} />
          </PlayingOn>,
        );
        tapOnce(tile('parlor'));
        const cardActions = within(details('parlor')).getByRole('region', { name: 'Card actions' });

        fireEvent.click(within(cardActions).getByRole('button', { name: 'Resign · parlor' }));
        await act(async () => {});

        expect(table.board.investigator(alder).status).toBe('resigned');
        expect(screen.queryByRole('dialog')).toBeNull();
      });
    });

    it('moves alder to the hallway as an action and closes', async () => {
      const table = PlayTable.start(
        house.withInvestigator(alder, { locationId: study }).withTurnOf(alder),
      );
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );
      tapOnce(tile('hallway'));

      tap('Move here · 1 action');
      await act(async () => {});

      expect(table.board.investigator(alder)).toMatchObject({ at: 'hallway', actions: 2 });
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('gives alder a clue from the study and stays open for the next', async () => {
      const table = aldersTurn();
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );
      tapOnce(tile('study'));

      tap('Take a clue, no test');
      await act(async () => {});

      expect(table.board.investigator(alder)).toMatchObject({ clues: 1, actions: 3 });
      expect(details('study')).toBeTruthy();
    });
  });

  describe('the − / + bubble a double tap on a tile opens', () => {
    const doubleTap = (element: Element) => {
      fireEvent.click(element);
      fireEvent.click(element);
    };
    const bubble = (name: string) => screen.getByRole('complementary', { name });

    it.each([
      { button: 'Add a clue', clues: 3, doom: 1 },
      { button: 'Remove a clue', clues: 1, doom: 1 },
      { button: 'Add doom', clues: 2, doom: 2 },
      { button: 'Remove doom', clues: 2, doom: 0 },
    ])(
      'on the study with 2 clues and 1 doom, "$button" leaves $clues clues and $doom doom',
      async ({ button, clues, doom }) => {
        const table = PlayTable.start(house);
        render(
          <PlayingOn table={table}>
            <MapBoard board={table.board} />
          </PlayingOn>,
        );

        doubleTap(tile('study'));
        fireEvent.click(within(bubble('study')).getByRole('button', { name: button }));

        await expect.poll(() => table.board.location(study).clues).toBe(clues);
        expect(table.board.location(study).doom ?? 0).toBe(doom);
      },
    );

    it('names the counts it steps, clues and doom, and opens no details', () => {
      const table = PlayTable.start(house);
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      doubleTap(tile('study'));
      act(() => vi.advanceTimersByTime(DOUBLE_TAP_MS));
      vi.useRealTimers();

      expect(
        within(bubble('study'))
          .getAllByRole('heading', { level: 3 })
          .map((name) => name.textContent),
      ).toEqual(['Clues', 'Doom']);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('offers only doom on the unrevealed hallway, which holds no clues yet', () => {
      const table = PlayTable.start(house);
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      doubleTap(tile('hallway'));

      expect(
        within(bubble('hallway'))
          .getAllByRole('button')
          .map((button) => button.getAttribute('aria-label')),
      ).toEqual(['Remove doom', 'Add doom']);
    });

    it('turns off removing doom at the hallway, which has none', () => {
      const table = PlayTable.start(house);
      render(
        <PlayingOn table={table}>
          <MapBoard board={table.board} />
        </PlayingOn>,
      );

      doubleTap(tile('hallway'));

      const off = within(bubble('hallway'))
        .getAllByRole('button')
        .filter((button) => button.hasAttribute('disabled'))
        .map((button) => button.getAttribute('aria-label'));
      expect(off).toEqual(['Remove doom']);
    });

    it.each([
      { why: 'a step is queued', busy: true, onPick: undefined },
      { why: 'the players pick a location', busy: false, onPick: () => {} },
    ])('stays shut while $why', ({ busy, onPick }) => {
      const table = PlayTable.start(house);
      render(
        <PlayingOn table={table} busy={busy}>
          <MapBoard board={table.board} onPick={onPick} />
        </PlayingOn>,
      );

      doubleTap(tile('study'));

      expect(screen.queryByRole('complementary')).toBeNull();
    });
  });
});
