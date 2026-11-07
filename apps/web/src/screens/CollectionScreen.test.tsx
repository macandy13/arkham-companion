// @vitest-environment jsdom
import type { PackDef } from '@arkham/carddata';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initI18n } from '../i18n';
import { loadSettings } from '../settings/settings';
import { CollectionScreen } from './CollectionScreen';

const packs: PackDef[] = [
  { code: 'core', name: 'Core Set', position: 1, cyclePosition: 1, chapter: 1 },
  { code: 'rcore', name: 'Revised Core Set', position: 2, cyclePosition: 1, chapter: 1 },
  { code: 'dwl', name: 'The Dunwich Legacy', position: 1, cyclePosition: 2, chapter: 1 },
];

describe('CollectionScreen', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('lists only the packs of campaigns the app plays, grouped by campaign', () => {
    render(<CollectionScreen packs={packs} />);

    expect(screen.getAllByRole('group').map((g) => g.textContent)).toEqual([
      'Night of the ZealotCore SetRevised Core Set',
    ]);
  });

  it('saves the owned packs', () => {
    render(<CollectionScreen packs={packs} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Revised Core Set' }));

    expect(loadSettings().ownedPacks).toEqual(['rcore']);
  });

  it('removes a pack that is unchecked again', () => {
    render(<CollectionScreen packs={packs} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Revised Core Set' }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Revised Core Set' }));

    expect(loadSettings().ownedPacks).toEqual([]);
  });

  it('explains that the pack list is missing without catalog packs', () => {
    render(<CollectionScreen />);

    expect(screen.getByText(/pack list appears/i)).toBeTruthy();
  });
});
