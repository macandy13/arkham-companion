// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cardName, instanceId, mapId, type MapView } from '@arkham/engine';
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
    { id: study, name: cardName('Study'), map: mapId('house'), revealed: true, clues: 2 },
    { id: hallway, name: cardName('Hallway'), map: mapId('house'), revealed: false, clues: 0 },
    { id: attic, name: cardName('Attic'), map: mapId('house'), revealed: false, clues: 0 },
  ],
  cells: { [study]: { column: 0, row: 0 }, [hallway]: { column: 1, row: 0 } },
  connections: [
    { from: study, to: hallway, oneWay: false },
    { from: hallway, to: attic, oneWay: true },
  ],
};

const tile = (name: string) => screen.getByRole('group', { name });

describe('MapBoard', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('draws a tile per location with its clues once revealed', () => {
    render(<MapBoard maps={[house]} />);

    expect(screen.getByRole('figure', { name: 'House' })).toBeTruthy();
    expect(within(tile('Study')).getByText('Clues 2')).toBeTruthy();
    expect(within(tile('Hallway')).getByText('Unrevealed')).toBeTruthy();
    expect(within(tile('Attic')).getByText('Unrevealed')).toBeTruthy();
  });

  it('names each connection after its locations and marks one-way ones', () => {
    render(<MapBoard maps={[house]} />);

    const lines = screen.getAllByRole('img').map((line) => line.getAttribute('aria-label'));
    expect(lines).toEqual(['Study – Hallway', 'Hallway to Attic, one way']);
  });

  it('leaves hidden maps out', () => {
    const cellar: MapView = { ...house, id: mapId('cellar'), name: 'Cellar', visible: false };

    render(<MapBoard maps={[house, cellar]} />);

    expect(screen.getByRole('figure', { name: 'House' })).toBeTruthy();
    expect(screen.queryByRole('figure', { name: 'Cellar' })).toBeNull();
  });
});
