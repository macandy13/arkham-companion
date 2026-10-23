// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { blankLocation, instanceId, investigatorId, newGame, PlayTable } from '@arkham/engine';
import { initI18n } from '../i18n';
import { gameActions } from '../state/gameActions';
import { InvestigatorBar } from './InvestigatorBar';

const study = instanceId('study');
const alder = investigatorId('alder');
const brook = investigatorId('brook');

/** Actions that play on `table`, as the store's play on the open game; undo is never used here. */
const actionsOn = (table: PlayTable) =>
  gameActions(
    async (step) => step(table),
    async () => {},
  );

const panel = (name: string) => screen.getByRole('region', { name });

/** The counters of `name`'s panel as [label, value] pairs, in the order the panel shows them. */
const countersOf = (name: string) =>
  within(panel(name))
    .getAllByRole('term')
    .map((term) => [term.textContent, term.nextElementSibling?.querySelector('data')?.textContent]);

describe('InvestigatorBar', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('shows a panel per investigator with health and sanity left, clues, resources and doom', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withInvestigator(alder, {
          locationId: study,
          health: { max: 7, damage: 3 },
          sanity: { max: 6, horror: 1 },
          clues: 2,
          resources: 4,
          doomOnPlayerCards: 1,
        })
        .withInvestigator(brook, { locationId: study }),
    );

    render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

    expect(within(panel('alder')).getByRole('heading', { name: 'alder' })).toBeTruthy();
    expect(countersOf('alder')).toEqual([
      ['Health', '4/7'],
      ['Sanity', '5/6'],
      ['Clues', '2'],
      ['Resources', '4'],
      ['Doom', '1'],
    ]);
    expect(countersOf('brook').map(([label]) => label)).not.toContain('Doom');
  });

  describe('the line on their round', () => {
    const atStudy = newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alder, { locationId: study })
      .withInvestigator(brook, { locationId: study });

    it.each([
      {
        situation: 'their turn',
        table: () => PlayTable.start(atStudy.withTurnOf(alder)),
        line: 'Turn · study',
      },
      {
        situation: 'another turn',
        table: () => PlayTable.start(atStudy.withTurnOf(brook)),
        line: 'study',
      },
      {
        situation: 'their turn taken',
        table: () => {
          const table = PlayTable.start(atStudy.withTurnOf(alder));
          table.endTurn(alder);
          return table;
        },
        line: 'Turn taken · study',
      },
    ])('says where alder is on $situation', ({ table, line }) => {
      const played = table();

      render(<InvestigatorBar board={played.board} actions={actionsOn(played)} busy={false} />);

      expect(within(panel('alder')).getByText(line)).toBeTruthy();
    });

    it.each([
      { status: 'defeated' as const, line: 'Defeated' },
      { status: 'resigned' as const, line: 'Resigned' },
    ])('says alder is $status instead of where', ({ status, line }) => {
      const table = PlayTable.start(
        newGame().withLocation(study, blankLocation('study')).withInvestigator(alder, { status }),
      );

      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      expect(within(panel('alder')).getByText(line)).toBeTruthy();
      expect(within(panel('alder')).getByRole('button', { name: 'Take damage' })).toHaveProperty(
        'disabled',
        true,
      );
    });

    it('says when alder is at no location', () => {
      const table = PlayTable.start(newGame().withInvestigator(alder));

      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      expect(within(panel('alder')).getByText('Not at a location')).toBeTruthy();
    });
  });

  describe('the steppers', () => {
    // Alder has 2 damage of 7 health, 2 horror of 6 sanity and 3 resources.
    const hurtAlder = newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alder, {
        locationId: study,
        health: { max: 7, damage: 2 },
        sanity: { max: 6, horror: 2 },
        resources: 3,
      });

    it.each([
      { button: 'Take damage', counter: 'damage', after: 3 },
      { button: 'Heal damage', counter: 'damage', after: 1 },
      { button: 'Take horror', counter: 'horror', after: 3 },
      { button: 'Heal horror', counter: 'horror', after: 1 },
      { button: 'Spend a resource', counter: 'resources', after: 2 },
      { button: 'Gain a resource', counter: 'resources', after: 4 },
    ] as const)(
      '"$button" leaves alder with $after $counter',
      async ({ button, counter, after }) => {
        const table = PlayTable.start(hurtAlder);
        render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

        fireEvent.click(within(panel('alder')).getByRole('button', { name: button }));

        await expect.poll(() => table.board.investigator(alder)[counter]).toBe(after);
      },
    );

    it('cannot heal or spend below none', () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'))
          .withInvestigator(alder, {
            locationId: study,
            health: { max: 7, damage: 0 },
            sanity: { max: 6, horror: 0 },
            resources: 0,
          }),
      );

      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      const off = within(panel('alder'))
        .getAllByRole('button')
        .filter((button) => (button as HTMLButtonElement).disabled)
        .map((button) => button.getAttribute('aria-label'));
      expect(off).toEqual(['Heal damage', 'Heal horror', 'Spend a resource']);
    });

    it('waits while a step is queued', () => {
      const table = PlayTable.start(hurtAlder);

      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy />);

      const on = within(panel('alder'))
        .getAllByRole('button')
        .filter((button) => !(button as HTMLButtonElement).disabled);
      expect(on).toEqual([]);
    });
  });
});
