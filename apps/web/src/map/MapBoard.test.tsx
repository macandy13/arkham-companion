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
  perInvestigator,
  PlayTable,
  resignAction,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { MapBoard } from './MapBoard';
import type { Point } from './mapLayout';
import { actionsOn } from '../state/gameActions.test_support';

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

    render(
      <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
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
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
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
      <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
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
      <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
    );

    const printed = within(tile('parlor'))
      .getAllByRole('paragraph')
      .map((line) => [within(line).getByRole('img').getAttribute('aria-label'), line.textContent]);
    expect(printed).toEqual([
      ['Action', ' Resign.'],
      ['Free', ' Action.'],
    ]);
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
      render(
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
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
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
      );

      fireEvent.load(requiredPictureOf('cellar'));

      expect(tile('cellar').getAttribute('data-picture')).toBe('shown');
    });

    it('cuts the art out of the picture into the art window of the tile', () => {
      const table = PlayTable.start(withCellar);
      render(
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
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
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
      );

      fireEvent.error(requiredPictureOf('cellar'));

      expect(tile('cellar').hasAttribute('data-picture')).toBe(false);
    });
  });

  it('names each connection after its locations and marks one-way ones', () => {
    const table = PlayTable.start(house);
    render(
      <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
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
      <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
    );

    expect(screen.getByRole('figure', { name: 'House' })).toBeTruthy();
    expect(screen.queryByRole('figure', { name: 'Cellar' })).toBeNull();
    expect(screen.queryByRole('figure', { name: 'Empty study' })).toBeNull();
  });

  it('offers zoom icons named for screen readers', () => {
    const table = PlayTable.start(house);
    render(
      <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
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
      <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
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
      <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
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
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
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
      <MapBoard
        board={withCellar.board}
        actions={actionsOn(withCellar)}
        busy={false}
        adjusting={false}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Cellar' }));

    const cellarEmptied = PlayTable.start(house.withMap(cellar, { name: 'Cellar' }));
    rerender(
      <MapBoard
        board={cellarEmptied.board}
        actions={actionsOn(cellarEmptied)}
        busy={false}
        adjusting={false}
      />,
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
      <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
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
      <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
    );

    const ghoulToken = within(tile('study')).getByRole('img', { name: /^ghoul,/ });
    expect(ghoulToken.dataset.engaged).toBe('true');
    expect(ghoulToken.dataset.exhausted).toBe('true');
    expect(ghoulToken.querySelector('[data-marker="damage"]')?.textContent).toBe('2');
    const ratsToken = within(tile('hallway')).getByRole('img', { name: 'rats' });
    expect(ratsToken.dataset.engaged).toBeUndefined();
    expect(ratsToken.dataset.exhausted).toBeUndefined();
    expect(ratsToken.querySelector('[data-marker]')).toBeNull();
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
      <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
    );

    expect(within(tile('study')).getByRole('img', { name: 'bea, lead investigator' })).toBeTruthy();
    expect(within(tile('study')).getByRole('img', { name: 'alder, their turn' })).toBeTruthy();
  });

  // The Study's tile spans 0–150 across and 0–210 down. Pieces stand in a row along its bottom
  // edge, investigators first: the first centred on (24, 186), an enemy engaged with them next on
  // (58, 186), and an enemy engaged with no one after a line, on (70, 186). The Hallway's tile
  // starts at x 180.
  describe('dragging pieces', () => {
    const firstPawn = { x: 24, y: 186 };
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
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
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
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
      );

      await drag('study', 'alder, lead investigator, their turn', firstPawn, x, y);

      expect(table.board.investigator(alder).at).toBe('study');
    });

    it('leaves the pawn in place while a step is still queued', async () => {
      const table = PlayTable.start(
        house.withInvestigator(alder, { locationId: study }).withTurnOf(alder),
      );
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy adjusting={false} />);

      await drag('study', 'alder, lead investigator, their turn', firstPawn, 255, 105);

      expect(table.board.investigator(alder).at).toBe('study');
    });

    it('leaves the pawn in place while the players adjust the board', async () => {
      const table = PlayTable.start(
        house.withInvestigator(alder, { locationId: study }).withTurnOf(alder),
      );
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting />);

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
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
      );

      await drag('study', 'bea, lead investigator', firstPawn, 255, 105);

      expect(table.board.investigator(bea).at).toBe('study');
    });

    it('moves an enemy to the location it is dropped on, connected or not', async () => {
      const table = PlayTable.start(
        house.withCard(rats, blankEnemy('rats', { health: fixed(1) }), atLocation(study)),
      );
      render(
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
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
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
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
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
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
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
      );

      await drag('study', 'rats', enemyAlone, x, y);

      expect(table.board.enemy(rats)).toEqual({ name: 'rats', at: 'study', health: 1 });
    });

    it('leaves an enemy in place while a step is still queued', async () => {
      const table = PlayTable.start(
        house.withCard(rats, blankEnemy('rats', { health: fixed(1) }), atLocation(study)),
      );
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy adjusting={false} />);

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
        .map((button) => button.getAttribute('aria-label'));

    /** Presses the piece named `name` on the tile of `location` and lets go where it went down. */
    async function tapPiece(location: string, name: string) {
      const piece = within(tile(location)).getByRole('img', { name });
      fireEvent.pointerDown(piece, { pointerId: 1, clientX: 50, clientY: 50 });
      fireEvent.pointerUp(piece, { pointerId: 1, clientX: 50, clientY: 50 });
      fireEvent.click(piece, { clientX: 50, clientY: 50 });
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

    it("opens the enemy's details, not the tile's, with engage for an aloof enemy at the investigator's location", async () => {
      const table = aldersTurnWithRats();
      render(
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
      );

      await tapPiece('study', 'rats');

      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(offered()).toEqual([
        'Read rats',
        'Close',
        'Engage · 1 action',
        'Deal 1 damage',
        'Defeat',
      ]);
    });

    it('engages the enemy as an action and keeps its details open', async () => {
      const table = aldersTurnWithRats();
      const { rerender } = render(
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
      );
      await tapPiece('study', 'rats');

      fireEvent.click(screen.getByRole('button', { name: 'Engage · 1 action' }));
      await act(async () => {});
      rerender(
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
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
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
      );
      await tapPiece('study', 'rats, engaged with bea');

      fireEvent.click(screen.getByRole('button', { name: 'Fight · 1 action' }));
      await act(async () => {});

      expect(table.board.decisions).toMatchObject([{ prompt: 'decision.fight', about: 'rats' }]);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('offers only the card effects for an enemy at another location', async () => {
      const table = PlayTable.start(
        house
          .withInvestigator(alder, { locationId: hallway })
          .withCard(rats, blankEnemy('rats', { health: fixed(2) }), atLocation(study))
          .withTurnOf(alder),
      );
      render(
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
      );

      await tapPiece('study', 'rats');

      expect(offered()).toEqual(['Read rats', 'Close', 'Deal 1 damage', 'Defeat']);
    });
  });

  describe('the location details', () => {
    const details = (name: string) => screen.getByRole('dialog', { name });
    const tap = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
    const offered = (name: string) =>
      within(details(name))
        .queryAllByRole('button')
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
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
      );

      fireEvent.click(tile('hallway'));
      expect(details('hallway')).toBeTruthy();

      tap('Close');
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('hands the tapped location to onPick instead of opening its details', () => {
      const table = PlayTable.start(house);
      const picked: string[] = [];
      render(
        <MapBoard
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
          onPick={(location) => picked.push(location)}
        />,
      );

      fireEvent.click(tile('hallway'));

      expect(picked).toEqual(['hallway']);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it.each([
      { pickable: undefined, lit: ['study', 'hallway'] },
      { pickable: [hallway], lit: ['hallway'] },
    ])('lights $lit while picking among $pickable', ({ pickable, lit }) => {
      const table = PlayTable.start(house);
      render(
        <MapBoard
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
          onPick={() => {}}
          pickable={pickable}
        />,
      );

      expect(
        ['study', 'hallway'].filter((name) => tile(name).hasAttribute('data-pickable')),
      ).toEqual(lit);
    });

    it('opens nothing when the press moves on, as a pan of the map does', () => {
      const table = PlayTable.start(house);
      render(
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
      );

      fireEvent.pointerDown(tile('hallway'), { clientX: 200, clientY: 100 });
      fireEvent.click(tile('hallway'), { clientX: 240, clientY: 100 });

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it.each(['Enter', ' '])('opens from the details button by the %j key', (key) => {
      const table = PlayTable.start(house);
      render(
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
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
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
      );

      fireEvent.click(tile('study'));

      expect(within(details('study')).getByText('Shroud 2 · Clues 2')).toBeTruthy();
      expect(
        within(details('study'))
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
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
      );

      fireEvent.click(tile('study'));

      expect(within(details('study')).getByRole('img', { name: 'The card of study' })).toBeTruthy();
      const attached = within(details('study')).getByRole('region', { name: 'Attached' });
      expect(within(attached).getByRole('listitem').textContent).toBe('obscuring_fog');
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
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
      );
      fireEvent.click(tile('study'));

      fireEvent.click(within(details('study')).getByRole('button', { name: 'Read obscuring_fog' }));
      fireEvent(screen.getByRole('dialog', { name: 'obscuring_fog' }), new Event('cancel'));

      expect(screen.queryByRole('dialog', { name: 'obscuring_fog' })).toBeNull();
      expect(details('study')).toBeTruthy();
    });

    it.each([
      {
        location: 'study',
        buttons: ['Close', 'Investigate · 1 action', 'Take a clue, no test'],
      },
      {
        location: 'hallway',
        buttons: ['Close', 'Move here · 1 action', 'Move here, no action'],
      },
      { location: 'attic', buttons: ['Close'] },
    ])('offers alder in the study at the $location: $buttons', ({ location, buttons }) => {
      const table = aldersTurn();
      render(
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
      );

      fireEvent.click(tile(location));

      expect(offered(location)).toEqual(buttons);
    });

    it('turns taking a clue off while an enemy engaged with alder forbids discovering clues', () => {
      const hunter = blankEnemy('hunter', {
        restrictions: [{ cannot: ['discover'], what: 'clues', who: 'threatArea' }],
      });
      const table = PlayTable.start(
        house
          .withInvestigator(alder, { locationId: study })
          .withCard(instanceId('hunter'), hunter, engagedWith(alder))
          .withTurnOf(alder),
      );
      render(
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
      );

      fireEvent.click(tile('study'));

      expect(
        within(details('study')).getByRole('button', { name: 'Take a clue, no test' }),
      ).toHaveProperty('disabled', true);
    });

    it('turns investigate off under a locked door and offers no move past a barrier', () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'), { revealed: true })
          .withLocation(
            hallway,
            blankLocation('hallway', {
              restrictions: [{ cannot: 'moveInto', of: 'self', unrevealed: true }],
            }),
          )
          .withConnection(study, hallway)
          .withCard(
            instanceId('locked_door'),
            blankTreachery('locked_door', {
              restrictions: [{ cannot: 'investigate', of: 'host' }],
            }),
            attachedTo(study),
          )
          .withInvestigator(alder, { locationId: study })
          .withTurnOf(alder),
      );
      render(
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
      );

      fireEvent.click(tile('study'));
      const investigate = within(details('study')).getByRole('button', {
        name: 'Investigate · 1 action',
      });
      expect(investigate).toHaveProperty('disabled', true);
      tap('Close');
      fireEvent.click(tile('hallway'));
      expect(offered('hallway')).toEqual(['Close']);
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
          <MapBoard
            board={table.board}
            actions={actionsOn(table)}
            busy={false}
            adjusting={false}
          />,
        );
        fireEvent.click(tile('parlor'));
        const cardActions = within(details('parlor')).getByRole('region', { name: 'Card actions' });

        fireEvent.click(within(cardActions).getByRole('button', { name: 'Resign · parlor' }));
        await act(async () => {});

        expect(table.board.investigator(alder).status).toBe('resigned');
        expect(screen.queryByRole('dialog')).toBeNull();
      });

      it('leaves it out while the players adjust the board', () => {
        const table = aldersTurnInTheParlor();
        render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting />);

        fireEvent.click(tile('parlor'));

        expect(
          within(details('parlor')).queryByRole('button', { name: 'Resign · parlor' }),
        ).toBeNull();
      });
    });

    it('moves alder to the hallway as an action and closes', async () => {
      const table = PlayTable.start(
        house.withInvestigator(alder, { locationId: study }).withTurnOf(alder),
      );
      render(
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
      );
      fireEvent.click(tile('hallway'));

      tap('Move here · 1 action');
      await act(async () => {});

      expect(table.board.investigator(alder)).toMatchObject({ at: 'hallway', actions: 2 });
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('gives alder a clue from the study and stays open for the next', async () => {
      const table = aldersTurn();
      render(
        <MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting={false} />,
      );
      fireEvent.click(tile('study'));

      tap('Take a clue, no test');
      await act(async () => {});

      expect(table.board.investigator(alder)).toMatchObject({ clues: 1, actions: 3 });
      expect(details('study')).toBeTruthy();
    });
  });

  describe('the location details, while adjusting', () => {
    const menu = (name: string) => screen.getByRole('dialog', { name });
    const tap = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

    it('offers corrections instead of alder’s actions', () => {
      const table = PlayTable.start(
        house.withInvestigator(alder, { locationId: study }).withTurnOf(alder),
      );
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting />);

      fireEvent.click(tile('study'));

      expect(
        within(menu('study'))
          .getAllByRole('button')
          .map((button) => button.getAttribute('aria-label')),
      ).toEqual(['Close', 'Remove a clue', 'Add a clue', 'Remove doom', 'Add doom']);
    });

    it('reveals an unrevealed location', async () => {
      const table = PlayTable.start(house);
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting />);
      fireEvent.click(tile('hallway'));

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
        render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting />);
        fireEvent.click(tile('study'));

        tap(button);
        await act(async () => {});

        const { clues: cluesLeft, doom: doomLeft = 0 } = table.board.location(study);
        expect({ clues: cluesLeft, doom: doomLeft }).toEqual({ clues, doom });
      },
    );

    it('turns off removing tokens at the hallway, which has no clues or doom', () => {
      const table = PlayTable.start(house);
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy={false} adjusting />);
      fireEvent.click(tile('hallway'));
      const disabled = (name: string) =>
        screen.getByRole('button', { name }).hasAttribute('disabled');

      expect(disabled('Remove a clue')).toBe(true);
      expect(disabled('Remove doom')).toBe(true);
      expect(disabled('Add a clue')).toBe(false);
    });

    it('turns every change off while a step is still queued', () => {
      const table = PlayTable.start(house);
      render(<MapBoard board={table.board} actions={actionsOn(table)} busy adjusting />);
      fireEvent.click(tile('hallway'));

      const enabled = within(menu('hallway'))
        .getAllByRole('button')
        .filter((button) => !button.hasAttribute('disabled'))
        .map((button) => button.getAttribute('aria-label') ?? button.textContent);
      expect(enabled).toEqual(['Close']);
    });
  });
});
