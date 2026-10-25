// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { CardCatalog, InvestigatorDef } from '@arkham/carddata';
import { initI18n } from '../i18n';
import { InvestigatorPicker } from './InvestigatorPicker';

function makeInvestigator(overrides: Partial<InvestigatorDef>): InvestigatorDef {
  return {
    code: 'x',
    name: 'X',
    factionCode: 'neutral',
    health: 7,
    sanity: 7,
    skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
    packCode: 'pack1',
    cyclePosition: 1,
    parallel: false,
    chapter: 1,
    ...overrides,
  };
}

const catalog: CardCatalog = {
  packs: [
    { code: 'pack1', name: 'First Pack', position: 1, cyclePosition: 1, chapter: 1 },
    { code: 'pack2', name: 'Second Pack', position: 1, cyclePosition: 2, chapter: 2 },
  ],
  investigators: [
    makeInvestigator({
      code: 'a1',
      name: 'Alder',
      factionCode: 'seeker',
      health: 6,
      sanity: 8,
      skills: { willpower: 1, intellect: 4, combat: 2, agility: 3 },
      imageSrc: '/front.png',
      backImageSrc: '/back.png',
      otherChapterCode: 'a2',
    }),
    makeInvestigator({
      code: 'a2',
      name: 'Alder',
      factionCode: 'seeker',
      chapter: 2,
      packCode: 'pack2',
      cyclePosition: 2,
      otherChapterCode: 'a1',
    }),
    makeInvestigator({ code: 'b1', name: 'Birch', factionCode: 'rogue' }),
    makeInvestigator({ code: 'c1', name: 'Cedar', factionCode: 'mystic' }),
    makeInvestigator({ code: 'd1', name: 'Dogwood' }),
    makeInvestigator({ code: 'e1', name: 'Elm' }),
  ],
};

function Harness({
  initialSeats = [],
  ownedPacks,
  onSeats,
}: {
  initialSeats?: string[];
  ownedPacks?: ReadonlySet<string>;
  onSeats?: (codes: string[]) => void;
}) {
  const [seats, setSeats] = useState(initialSeats);
  return (
    <InvestigatorPicker
      catalog={catalog}
      seats={seats}
      ownedPacks={ownedPacks}
      onSeatsChange={(codes) => {
        setSeats(codes);
        onSeats?.(codes);
      }}
    />
  );
}

function seatsSection() {
  return screen.getByRole('region', { name: 'Seats' });
}

function seatNames() {
  return within(seatsSection())
    .queryAllByRole('listitem')
    .map((item) => item.querySelector('span')?.textContent);
}

function portraitNames() {
  const grid = screen.queryByRole('list', { name: 'Investigators' });
  if (!grid) return [];
  return within(grid)
    .getAllByRole('button')
    .map((b) => b.querySelector('span')?.textContent);
}

function openPortrait(name: string) {
  fireEvent.click(
    within(screen.getByRole('list', { name: 'Investigators' })).getAllByRole('button', {
      name: new RegExp(name),
    })[0]!,
  );
}

function openFilters() {
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
}

function selectInvestigator(name: string) {
  openPortrait(name);
  fireEvent.click(screen.getByRole('button', { name: 'Select' }));
}

describe('InvestigatorPicker', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('lists every investigator with its chapter badge', () => {
    render(<Harness />);

    expect(portraitNames()).toEqual(['Alder', 'Alder', 'Birch', 'Cedar', 'Dogwood', 'Elm']);
    const grid = screen.getByRole('list', { name: 'Investigators' });
    expect(within(grid).getAllByText('Ch. 2')).toHaveLength(1);
  });

  it('lazy-loads portrait images from the ArkhamDB host', () => {
    render(<Harness />);

    const image = document.querySelector('img')!;

    expect(image.getAttribute('src')).toBe('https://arkhamdb.com/front.png');
    expect(image.getAttribute('loading')).toBe('lazy');
  });

  it('filters by name', () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: 'bir' } });

    expect(portraitNames()).toEqual(['Birch']);
  });

  it('filters by class chip', () => {
    render(<Harness />);
    openFilters();

    fireEvent.click(screen.getByRole('button', { name: 'Mystic' }));

    expect(portraitNames()).toEqual(['Cedar']);
  });

  it('filters by chapter', () => {
    render(<Harness />);
    openFilters();

    fireEvent.change(screen.getByLabelText('Chapter'), { target: { value: '2' } });

    expect(portraitNames()).toEqual(['Alder']);
  });

  it('filters by cycle', () => {
    render(<Harness />);
    openFilters();

    fireEvent.change(screen.getByLabelText('Cycle'), { target: { value: '2' } });

    expect(portraitNames()).toEqual(['Alder']);
  });

  it('filters by pack', () => {
    render(<Harness />);
    openFilters();

    fireEvent.change(screen.getByLabelText('Pack'), { target: { value: 'pack1' } });

    expect(portraitNames()).toEqual(['Alder', 'Birch', 'Cedar', 'Dogwood', 'Elm']);
  });

  it('hides the collection filter without owned packs', () => {
    render(<Harness />);
    openFilters();

    expect(screen.queryByLabelText('My collection')).toBeNull();
  });

  it('filters by owned packs when they are given', () => {
    render(<Harness ownedPacks={new Set(['pack2'])} />);
    openFilters();

    fireEvent.click(screen.getByLabelText('My collection'));

    expect(portraitNames()).toEqual(['Alder']);
  });

  it('shows a message when no investigator matches', () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: 'zzz' } });

    expect(screen.getByText('No investigators match the filters.')).toBeTruthy();
  });

  it('shows health, sanity, skills and both card faces in the detail sheet', () => {
    render(<Harness />);

    openPortrait('Alder');
    const sheet = screen.getByRole('dialog', { name: 'Alder' });

    expect(within(sheet).getByText('Health').nextElementSibling?.textContent).toBe('6');
    expect(within(sheet).getByText('Sanity').nextElementSibling?.textContent).toBe('8');
    expect(within(sheet).getByText('Intellect').nextElementSibling?.textContent).toBe('4');
    expect(within(sheet).getByText('Ch. 1')).toBeTruthy();
    expect(within(sheet).getByAltText('Front')).toBeTruthy();
    expect(within(sheet).getByAltText('Back')).toBeTruthy();
  });

  it('counts the filters set on the filter button', () => {
    render(<Harness />);
    openFilters();

    fireEvent.click(screen.getByRole('button', { name: 'Mystic' }));
    fireEvent.change(screen.getByLabelText('Chapter'), { target: { value: '1' } });

    expect(screen.getByRole('button', { name: 'Filters (2 set)' })).toBeTruthy();
  });

  it('closes the filter menu with its button', () => {
    render(<Harness />);
    openFilters();

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));

    expect(screen.queryByLabelText('Chapter')).toBeNull();
  });

  it('shows no page arrows for ten investigators or fewer', () => {
    render(<Harness />);

    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
  });

  it('shows page arrows for more than ten investigators', () => {
    const eleven = [
      'Ash',
      'Beech',
      'Cherry',
      'Fir',
      'Hazel',
      'Larch',
      'Maple',
      'Oak',
      'Pine',
      'Rowan',
      'Willow',
    ];
    const trees = eleven.map((name) => makeInvestigator({ code: name, name }));
    render(
      <InvestigatorPicker
        catalog={{ packs: catalog.packs, investigators: trees }}
        seats={[]}
        onSeatsChange={() => {}}
      />,
    );

    expect(portraitNames()).toHaveLength(11);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeTruthy();
  });

  it('links the detail sheet to the other chapter version', () => {
    render(<Harness />);

    openPortrait('Alder');
    fireEvent.click(screen.getByRole('button', { name: 'Show Chapter 2 version' }));

    const sheet = screen.getByRole('dialog', { name: 'Alder' });
    expect(within(sheet).getByText('Ch. 2')).toBeTruthy();
  });

  it('closes the detail sheet', () => {
    render(<Harness />);

    openPortrait('Alder');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('assigns selected investigators to the next seats in order', () => {
    render(<Harness />);

    selectInvestigator('Birch');
    selectInvestigator('Cedar');

    expect(seatNames()).toEqual(['Birch', 'Cedar']);
    expect(screen.getByText('Lead investigator')).toBeTruthy();
  });

  it('does not seat an investigator twice', () => {
    render(<Harness initialSeats={['b1']} />);

    openPortrait('Birch');

    const sheet = screen.getByRole('dialog', { name: 'Birch' });
    expect(within(sheet).getByRole('button', { name: 'Seat 1' })).toHaveProperty('disabled', true);
  });

  it('allows at most four seats', () => {
    render(<Harness initialSeats={['a1', 'b1', 'c1', 'd1']} />);

    openPortrait('Elm');

    expect(screen.getByRole('button', { name: 'Select' })).toHaveProperty('disabled', true);
  });

  it('removes a seat', () => {
    const emitted: string[][] = [];
    render(<Harness initialSeats={['b1', 'c1']} onSeats={(c) => emitted.push(c)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Birch' }));

    expect(seatNames()).toEqual(['Cedar']);
    expect(emitted).toEqual([['c1']]);
  });

  it('reorders seats with the move buttons', () => {
    render(<Harness initialSeats={['b1', 'c1', 'd1']} />);

    fireEvent.click(screen.getByRole('button', { name: 'Move Birch down' }));
    expect(seatNames()).toEqual(['Cedar', 'Birch', 'Dogwood']);

    fireEvent.click(screen.getByRole('button', { name: 'Move Dogwood up' }));
    expect(seatNames()).toEqual(['Cedar', 'Dogwood', 'Birch']);
  });

  it('disables moving the first seat up and the last seat down', () => {
    render(<Harness initialSeats={['b1', 'c1']} />);

    expect(screen.getByRole('button', { name: 'Move Birch up' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Move Cedar down' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('reorders seats by dragging', () => {
    render(<Harness initialSeats={['b1', 'c1', 'd1']} />);
    const [first, , third] = within(seatsSection()).getAllByRole('listitem');

    fireEvent.dragStart(first!);
    fireEvent.drop(third!);

    expect(seatNames()).toEqual(['Cedar', 'Dogwood', 'Birch']);
  });
});
