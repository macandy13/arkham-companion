// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  blankLocation,
  instanceId,
  investigatorId,
  mapId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { gameActions } from '../state/gameActions';
import { LocationFocus } from './LocationFocus';

const hallway = instanceId('hallway');
const study = instanceId('study');
const attic = instanceId('attic');
const cellar = instanceId('cellar');
const parlor = instanceId('parlor');
const alder = investigatorId('alder');

/** Actions that play on `table`; the location mode's neighbours only move the view, never play. */
const actionsOn = (table: PlayTable) =>
  gameActions(
    async (step) => step(table),
    async () => {},
    { start: async () => {}, finish: async () => {}, cancel: async () => {} },
  );

describe('LocationFocus', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  /**
   * The Hallway in the middle of the house, one card step from each neighbour: the Study above
   * (with Alder in it), the Attic left, the Parlor right (barred while unrevealed) and the Cellar
   * below, which a one-way connection leads to.
   */
  const table = PlayTable.start(
    newGame()
      .withMap(mapId('main'), { name: 'House' })
      .withLocation(hallway, blankLocation('hallway'), {
        revealed: true,
        at: { column: 3, row: 3 },
      })
      .withLocation(study, blankLocation('study'), { at: { column: 3, row: 0 } })
      .withLocation(attic, blankLocation('attic'), { at: { column: 0, row: 3 } })
      .withLocation(
        parlor,
        blankLocation('parlor', {
          restrictions: [{ cannot: 'moveInto', of: 'self', unrevealed: true }],
        }),
        { at: { column: 6, row: 3 } },
      )
      .withLocation(cellar, blankLocation('cellar'), { at: { column: 3, row: 6 } })
      .withConnection(hallway, study)
      .withConnection(attic, hallway)
      .withConnection(hallway, parlor)
      .withConnection(hallway, cellar, { oneWay: true })
      .withInvestigator(alder, { locationId: study }),
  );
  const renderHallway = (onGo = vi.fn()) =>
    render(
      <LocationFocus
        board={table.board}
        location={table.board.location(hallway)}
        actions={actionsOn(table)}
        busy={false}
        adjusting={false}
        onGo={onGo}
        onMap={() => {}}
      />,
    );

  it.each([
    { side: 'Above', neighbour: 'Go to study, alder' },
    { side: 'To the left', neighbour: 'Go to attic' },
    { side: 'To the right', neighbour: 'Go to parlor, barricaded' },
    { side: 'Below', neighbour: 'Go to cellar, one way from here' },
  ])('lists "$neighbour" under "$side" around the Hallway', ({ side, neighbour }) => {
    renderHallway();

    const list = screen.getByRole('list', { name: side });
    expect(
      within(list)
        .getAllByRole('button')
        .map((button) => button.ariaLabel),
    ).toEqual([neighbour]);
  });

  it('shows a neighbour in its place from a tap on it', () => {
    const onGo = vi.fn();
    renderHallway(onGo);

    fireEvent.click(screen.getByRole('button', { name: 'Go to attic' }));

    expect(onGo).toHaveBeenCalledWith(attic);
  });
});
