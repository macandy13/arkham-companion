// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  cardName,
  instanceId,
  investigatorId,
  mapId,
  type InvestigatorView,
  type MapView,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { MapBoard } from './MapBoard';

const study = instanceId('study');
const hallway = instanceId('hallway');
const attic = instanceId('attic');

const house: MapView = {
  id: mapId('house'),
  name: 'House',
  visible: true,
  locations: [
    {
      id: study,
      name: cardName('Study'),
      map: mapId('house'),
      revealed: true,
      shroud: 2,
      clues: 2,
      doom: 1,
      attachments: [cardName('Obscuring Fog')],
    },
    { id: hallway, name: cardName('Hallway'), map: mapId('house'), revealed: false, clues: 0 },
    { id: attic, name: cardName('Attic'), map: mapId('house'), revealed: false, clues: 0 },
  ],
  cells: { [study]: { column: 0, row: 0 }, [hallway]: { column: 3, row: 0 } },
  connections: [
    { from: study, to: hallway, oneWay: false },
    { from: hallway, to: attic, oneWay: true },
  ],
  enemies: {},
};

const tile = (name: string) => screen.getByRole('group', { name });

describe('MapBoard', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('draws a tile per location with its shroud and clues once revealed, its doom and attachments', () => {
    render(<MapBoard maps={[house]} investigators={[]} />);

    expect(screen.getByRole('figure', { name: 'House' })).toBeTruthy();
    expect(within(tile('Study')).getByText('Shroud 2 · Clues 2')).toBeTruthy();
    expect(within(tile('Study')).getByText('Doom 1')).toBeTruthy();
    expect(within(tile('Study')).getByText('Attachments 1')).toBeTruthy();
    expect(within(tile('Hallway')).getByText('Unrevealed')).toBeTruthy();
    expect(within(tile('Attic')).getByText('Unrevealed')).toBeTruthy();
  });

  it('names each connection after its locations and marks one-way ones', () => {
    render(<MapBoard maps={[house]} investigators={[]} />);

    const lines = screen.getAllByRole('img').map((line) => line.getAttribute('aria-label'));
    expect(lines).toEqual(['Study – Hallway', 'Hallway to Attic, one way']);
  });

  it('leaves out hidden maps and maps without locations', () => {
    const cellar: MapView = { ...house, id: mapId('cellar'), name: 'Cellar', visible: false };
    const emptyStudy: MapView = { ...house, id: mapId('study'), name: 'Study', locations: [] };

    render(<MapBoard maps={[house, cellar, emptyStudy]} investigators={[]} />);

    expect(screen.getByRole('figure', { name: 'House' })).toBeTruthy();
    expect(screen.queryByRole('figure', { name: 'Cellar' })).toBeNull();
    expect(screen.queryByRole('figure', { name: 'Study' })).toBeNull();
  });

  it('stands a pawn for each investigator and a chip for each enemy on their location', () => {
    const alder = investigatorId('alder');
    const alderView: InvestigatorView = {
      id: alder,
      name: cardName('Alder'),
      status: 'active',
      at: cardName('Study'),
      clues: 0,
      resources: 5,
      damage: 0,
      horror: 0,
      actions: 3,
    };
    const houseWithPieces: MapView = {
      ...house,
      locations: house.locations.map((location) =>
        location.id === study ? { ...location, investigators: [alder] } : location,
      ),
      enemies: {
        [study]: [
          {
            name: cardName('Ghoul Minion'),
            at: cardName('Study'),
            engagedWith: alder,
            damage: 2,
            exhausted: true,
          },
        ],
        [hallway]: [{ name: cardName('Swarm of Rats'), at: cardName('Hallway') }],
      },
    };

    render(<MapBoard maps={[houseWithPieces]} investigators={[alderView]} />);

    expect(within(tile('Study')).getByRole('img', { name: 'Alder' })).toBeTruthy();
    expect(
      within(tile('Study')).getByRole('img', {
        name: 'Ghoul Minion, engaged with Alder, 2 damage, exhausted',
      }),
    ).toBeTruthy();
    expect(within(tile('Hallway')).getByRole('img', { name: 'Swarm of Rats' })).toBeTruthy();
  });
});
