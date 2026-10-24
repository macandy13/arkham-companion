// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  blankEnemy,
  blankLocation,
  blankTreachery,
  engagedWith,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  threatAreaOf,
} from '@arkham/engine';
import { range } from '@arkham/util';
import { initI18n } from '../i18n';
import { gameActions } from '../state/gameActions';
import { InvestigatorBar } from './InvestigatorBar';

const study = instanceId('study');
const alder = investigatorId('alder');
const brook = investigatorId('brook');

/**
 * Actions that play on `table`, as the store's play on the open game; undo and adjusting are never
 * used here.
 */
const actionsOn = (table: PlayTable) =>
  gameActions(
    async (step) => step(table),
    async () => {},
    { start: async () => {}, finish: async () => {}, cancel: async () => {} },
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

    it('waits while a step is queued, turn controls too', () => {
      const table = PlayTable.start(hurtAlder.withTurnOf(alder));

      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy />);

      const on = within(panel('alder'))
        .getAllByRole('button')
        .filter((button) => !(button as HTMLButtonElement).disabled);
      expect(on).toEqual([]);
    });
  });

  describe('the turn controls', () => {
    const twoAtStudy = newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alder, { locationId: study })
      .withInvestigator(brook, { locationId: study });

    /** The table in round 1's investigation phase, before anyone's turn. */
    const beforeTurns = () => {
      const table = PlayTable.start(twoAtStudy);
      table.nextPhase();
      return table;
    };

    it('offers to start the turn of each investigator who has not taken one', () => {
      const table = beforeTurns();
      table.startTurn(brook);
      table.endTurn(brook);

      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      expect(within(panel('alder')).getByRole('button', { name: 'Start turn' })).toBeTruthy();
      expect(within(panel('brook')).queryByRole('button', { name: 'Start turn' })).toBeNull();
    });

    it.each([
      {
        situation: 'resigned',
        table: () => {
          const table = beforeTurns();
          table.startTurn(alder);
          table.resign(alder);
          return table;
        },
      },
      { situation: 'outside the investigation phase', table: () => PlayTable.start(twoAtStudy) },
    ])('offers no turn start to alder $situation', ({ table }) => {
      const played = table();

      render(<InvestigatorBar board={played.board} actions={actionsOn(played)} busy={false} />);

      expect(within(panel('alder')).queryByRole('button', { name: 'Start turn' })).toBeNull();
    });

    it('starts the turn of the investigator the players pick', async () => {
      const table = beforeTurns();
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      fireEvent.click(within(panel('brook')).getByRole('button', { name: 'Start turn' }));

      await expect.poll(() => table.board.turn).toBe(brook);
    });

    it('shows a pip per action on the investigator whose turn it is, filled for each one left', () => {
      const table = PlayTable.start(twoAtStudy.withTurnOf(alder));
      table.adjustActions(alder, -1);

      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      const pips = within(panel('alder')).getByRole('list', { name: '2 actions left' });
      const filled = within(pips)
        .getAllByRole('listitem')
        .map((pip) => pip.hasAttribute('data-left'));
      expect(filled).toEqual([true, true, false]);
      expect(within(panel('brook')).queryByRole('group', { name: 'Turn' })).toBeNull();
      expect(within(panel('brook')).queryByRole('button', { name: 'Start turn' })).toBeNull();
    });

    it.each([
      { button: 'End turn', after: { turnTaken: true } },
      { button: 'Resign', after: { status: 'resigned' } },
    ])('"$button" plays it for the investigator whose turn it is', async ({ button, after }) => {
      const table = PlayTable.start(twoAtStudy.withTurnOf(alder));
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      fireEvent.click(within(panel('alder')).getByRole('button', { name: button }));

      await expect.poll(() => table.board.investigator(alder)).toMatchObject(after);
    });
  });

  describe('the threat area', () => {
    it("lists alder's treacheries, then the enemies engaged with alder with their health left", () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'))
          .withInvestigator(alder, { locationId: study })
          .withInvestigator(brook, { locationId: study })
          .withCard(instanceId('voices'), blankTreachery('dissonant_voices'), threatAreaOf(alder))
          .withCard(
            instanceId('ghoul'),
            blankEnemy('ghoul_minion', { health: fixed(3) }),
            engagedWith(alder),
            { tokens: { damage: 2 } },
          )
          .withCard(instanceId('rat'), blankEnemy('swarm_of_rats'), engagedWith(brook)),
      );

      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      const threatArea = within(panel('alder')).getByRole('list', { name: 'Threat area' });
      const cards = within(threatArea).getAllByRole('listitem');
      expect(cards.map((card) => card.textContent)).toEqual([
        'dissonant_voices',
        'ghoul_minion1/3',
      ]);
      expect(cards[1]?.getAttribute('aria-label')).toBe(
        'ghoul_minion, 1 of 3 health left, 2 damage',
      );
    });

    it('leaves the card whole while the threat area is empty', () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'))
          .withInvestigator(alder, { locationId: study }),
      );

      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      expect(within(panel('alder')).queryByRole('list', { name: 'Threat area' })).toBeNull();
    });

    it.each([
      { treacheries: 4, arrows: [] },
      {
        treacheries: 5,
        arrows: ['Earlier cards in the threat area', 'Later cards in the threat area'],
      },
    ])('offers scroll arrows with $treacheries cards only past four', ({ treacheries, arrows }) => {
      const frozenInFear = blankTreachery('frozen_in_fear');
      const game = newGame()
        .withLocation(study, blankLocation('study'))
        .withInvestigator(alder, { locationId: study });
      const table = PlayTable.start(
        range(treacheries).reduce(
          (withCards, index) =>
            withCards.withCard(
              instanceId(`frozen_in_fear_${index}`),
              frozenInFear,
              threatAreaOf(alder),
            ),
          game,
        ),
      );

      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      const shown = within(panel('alder'))
        .queryAllByRole('button', { name: /threat area/ })
        .map((button) => button.getAttribute('aria-label'));
      expect(shown).toEqual(arrows);
    });
  });
});
