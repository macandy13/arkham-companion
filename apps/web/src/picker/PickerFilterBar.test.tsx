// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { PackDef } from '@arkham/carddata';
import { initI18n } from '../i18n';
import { PickerFilterBar } from './PickerFilterBar';

const pack = (code: string, name: string, cyclePosition: number, position = 1): PackDef => ({
  code,
  name,
  position,
  cyclePosition,
  chapter: 1,
});

describe('PickerFilterBar', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('names each cycle: a campaign by its packs, a product line by its kind, an unknown one by its number', () => {
    const packs = [
      pack('eoep', 'Edge of the Earth Investigator Expansion', 8, 1),
      pack('eoec', 'Edge of the Earth Campaign Expansion', 8, 2),
      pack('nat', 'Nathaniel Cho', 60),
      pack('new_line', 'A Line ArkhamDB Adds Later', 95),
    ];
    render(
      <PickerFilterBar
        filters={{ search: '', factions: [], onlyOwned: false }}
        packs={packs}
        canFilterByCollection={false}
        onChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));

    const options = within(screen.getByLabelText('Cycle')).getAllByRole('option');

    expect(options.map((option) => option.textContent)).toEqual([
      'All',
      'Edge of the Earth',
      'Investigator Starter Decks',
      'Cycle 95',
    ]);
  });
});
