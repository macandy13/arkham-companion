// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
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

    render(<MapBoard board={table.board} />);

    expect(screen.getByRole('figure', { name: 'House' })).toBeTruthy();
    expect(within(tile('study')).getByText('Shroud 4 · Clues 2')).toBeTruthy();
    expect(within(tile('study')).getByText('Doom 1')).toBeTruthy();
    expect(within(tile('study')).getByText('Attachments 1')).toBeTruthy();
    expect(within(tile('hallway')).getByText('Unrevealed')).toBeTruthy();
    expect(within(tile('attic')).getByText('Unrevealed')).toBeTruthy();
  });

  it('names each connection after its locations and marks one-way ones', () => {
    render(<MapBoard board={PlayTable.start(house).board} />);

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

    render(<MapBoard board={table.board} />);

    expect(screen.getByRole('figure', { name: 'House' })).toBeTruthy();
    expect(screen.queryByRole('figure', { name: 'Cellar' })).toBeNull();
    expect(screen.queryByRole('figure', { name: 'Empty study' })).toBeNull();
  });

  it('shows one map without tabs', () => {
    render(<MapBoard board={PlayTable.start(house).board} />);

    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('gives several visible maps a tab each and shows the chosen one, the first at the start', () => {
    const table = PlayTable.start(
      house
        .withMap(mapId('cellar'), { name: 'Cellar' })
        .withLocation(instanceId('cellar'), blankLocation('cellar'), { map: mapId('cellar') }),
    );
    render(<MapBoard board={table.board} />);
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
    const { rerender } = render(<MapBoard board={withCellar.board} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Cellar' }));

    const cellarEmptied = PlayTable.start(house.withMap(cellar, { name: 'Cellar' }));
    rerender(<MapBoard board={cellarEmptied.board} />);

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

    render(<MapBoard board={table.board} />);

    expect(within(tile('study')).getByRole('img', { name: 'alder' })).toBeTruthy();
    expect(
      within(tile('study')).getByRole('img', {
        name: 'ghoul, engaged with alder, 2 damage, exhausted',
      }),
    ).toBeTruthy();
    expect(within(tile('hallway')).getByRole('img', { name: 'rats' })).toBeTruthy();
  });
});
