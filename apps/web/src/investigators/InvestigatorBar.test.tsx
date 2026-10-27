// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  attachedTo,
  blankAsset,
  blankEnemy,
  blankLocation,
  blankTreachery,
  cardImagePath,
  engagedWith,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  playAreaOf,
  resignAction,
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

    render(
      <InvestigatorBar
        board={table.board}
        actions={actionsOn(table)}
        busy={false}
        adjusting={false}
      />,
    );

    expect(within(panel('alder')).getByRole('heading', { name: 'alder' })).toBeTruthy();
    expect(countersOf('alder')).toEqual([
      ['Health', '4/7'],
      ['Sanity', '5/6'],
      ['Clues', '2'],
      // Resources are shortened to fit their column, the full name as the title.
      ['Res.', '4'],
      ['Doom', '1'],
    ]);
    expect(countersOf('brook').map(([label]) => label)).not.toContain('Doom');
    expect(within(panel('alder')).getByTitle('Resources').textContent).toBe('Res.');
  });

  it('shows the four skills in the printed order, each named for screen readers', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withInvestigator(alder, {
          locationId: study,
          skills: { willpower: 4, intellect: 3, combat: 1, agility: 2 },
        }),
    );

    render(
      <InvestigatorBar
        board={table.board}
        actions={actionsOn(table)}
        busy={false}
        adjusting={false}
      />,
    );

    const skills = within(within(panel('alder')).getByRole('list', { name: 'Skills' }))
      .getAllByRole('button')
      .map((skill) => [skill.getAttribute('aria-label'), skill.textContent]);
    expect(skills).toEqual([
      ['Willpower 4', '4'],
      ['Intellect 3', '3'],
      ['Combat 1', '1'],
      ['Agility 2', '2'],
    ]);
  });

  it('shows a boosted skill with its boost beside it, the printed value told apart', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withInvestigator(alder, {
          locationId: study,
          skills: { willpower: 4, intellect: 3, combat: 1, agility: 2 },
        }),
    );
    table.play({
      type: 'ManualAdjust',
      adjustment: { kind: 'skillBoost', investigatorId: alder, skill: 'combat', delta: 2 },
    });

    render(
      <InvestigatorBar
        board={table.board}
        actions={actionsOn(table)}
        busy={false}
        adjusting={false}
      />,
    );

    const combat = within(panel('alder')).getByRole('button', { name: 'Combat 3, boosted +2' });
    expect(
      [...combat.querySelectorAll('data')].map((data) => [data.value, data.textContent]),
    ).toEqual([
      ['3', '3'],
      ['2', '+2'],
    ]);
  });

  it('shows the art of the card picture once it has loaded', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withInvestigator(alder, {
          locationId: study,
          imageSrc: cardImagePath('/bundles/cards/alder.png'),
        }),
    );
    render(
      <InvestigatorBar
        board={table.board}
        actions={actionsOn(table)}
        busy={false}
        adjusting={false}
      />,
    );
    // The picture is decorative (`alt=""`), so it has no role to find it by.
    const art = within(panel('alder')).getByRole('article').querySelector('picture');
    const picture = art?.querySelector('img');
    if (!art || !picture) throw new Error("alder's card has no picture");
    const beforeLoading = art.hasAttribute('data-picture');

    // jsdom loads no images, so the test fires the load itself.
    fireEvent.load(picture);

    expect(picture.getAttribute('src')).toBe('https://arkhamdb.com/bundles/cards/alder.png');
    expect(beforeLoading).toBe(false);
    expect(art.getAttribute('data-picture')).toBe('shown');
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

      render(
        <InvestigatorBar
          board={played.board}
          actions={actionsOn(played)}
          busy={false}
          adjusting={false}
        />,
      );

      expect(within(panel('alder')).getByText(line)).toBeTruthy();
    });

    it.each([
      { status: 'defeated' as const, line: 'Defeated' },
      { status: 'resigned' as const, line: 'Resigned' },
    ])(
      'says alder is $status instead of where, and keeps their counters still',
      ({ status, line }) => {
        const table = PlayTable.start(
          newGame().withLocation(study, blankLocation('study')).withInvestigator(alder, { status }),
        );

        render(
          <InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} adjusting />,
        );

        expect(within(panel('alder')).getByText(line)).toBeTruthy();
        expect(within(panel('alder')).getByRole('button', { name: 'Take damage' })).toHaveProperty(
          'disabled',
          true,
        );
      },
    );

    it('says when alder is at no location', () => {
      const table = PlayTable.start(newGame().withInvestigator(alder));

      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      expect(within(panel('alder')).getByText('Not at a location')).toBeTruthy();
    });
  });

  describe('the lead and turn markers', () => {
    const alderAndBrook = () =>
      PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study', { actions: [resignAction()] }), {
            revealed: true,
          })
          .withInvestigator(alder, { locationId: study })
          .withInvestigator(brook, { locationId: study }),
      );

    /** The markers beside `name`'s name, by what they say. */
    const markersOf = (name: string) =>
      within(within(panel(name)).getByRole('article'))
        .queryAllByRole('img')
        .map((marker) => marker.getAttribute('aria-label'));

    it.each([
      {
        situation: 'on Brook’s turn, Alder leading',
        table: () => {
          const table = alderAndBrook();
          table.nextPhase();
          table.startTurn(brook);
          return table;
        },
        alderMarkers: ['Lead investigator'],
        brookMarkers: ['Their turn'],
      },
      {
        situation: 'once Alder has resigned, leaving the lead to Brook',
        table: () => {
          const table = alderAndBrook();
          table.nextPhase();
          table.startTurn(alder);
          table.useCardAction(alder, study);
          return table;
        },
        alderMarkers: [],
        brookMarkers: ['Lead investigator'],
      },
    ])('marks $situation', ({ table, alderMarkers, brookMarkers }) => {
      const played = table();

      render(
        <InvestigatorBar
          board={played.board}
          actions={actionsOn(played)}
          busy={false}
          adjusting={false}
        />,
      );

      expect(markersOf('alder')).toEqual(alderMarkers);
      expect(markersOf('brook')).toEqual(brookMarkers);
    });
  });

  describe('the focused panel and the other investigators’ avatars, for a phone', () => {
    const alderAndBrook = () =>
      PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'), { revealed: true })
          .withInvestigator(alder, { locationId: study })
          .withInvestigator(brook, { locationId: study }),
      );

    /** The names on the panels the phone shows (`data-focus`). */
    const focused = () =>
      screen
        .getAllByRole('region')
        .filter((region) => region.hasAttribute('data-focus'))
        .map((region) => within(region).getByRole('heading').textContent);

    const avatars = () =>
      within(screen.getByRole('list', { name: 'Other investigators' }))
        .getAllByRole('button')
        .map((avatar) => avatar.getAttribute('aria-label'));

    it.each([
      {
        situation: 'outside a turn, the lead investigator Alder',
        turnOf: undefined,
        shown: 'alder',
        others: ['Show brook'],
      },
      {
        situation: 'on Brook’s turn, Brook',
        turnOf: brook,
        shown: 'brook',
        others: ['Show alder'],
      },
    ])('focuses $situation, the other one as an avatar', ({ turnOf, shown, others }) => {
      const table = alderAndBrook();
      if (turnOf) {
        table.nextPhase();
        table.startTurn(turnOf);
      }

      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      expect(focused()).toEqual([shown]);
      expect(avatars()).toEqual(others);
    });

    it('focuses the investigator whose avatar is tapped, until the turn changes', () => {
      const table = alderAndBrook();
      table.nextPhase();
      table.startTurn(alder);
      const { rerender } = render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Show brook' }));
      const afterTap = focused();
      table.endTurn(alder);
      table.startTurn(brook);
      table.endTurn(brook);
      rerender(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      expect(afterTap).toEqual(['brook']);
      expect(focused()).toEqual(['alder']);
    });

    it('brings the turn investigator back to the front when their turn comes round again', () => {
      const table = alderAndBrook();
      table.nextPhase();
      table.startTurn(alder);
      const { rerender } = render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Show brook' }));
      table.endTurn(alder);
      table.startTurn(brook);
      table.endTurn(brook);
      table.nextPhase();
      table.nextPhase();
      table.nextPhase();
      table.nextPhase();
      table.startTurn(alder);
      rerender(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      expect(table.board.round).toBe(2);
      expect(focused()).toEqual(['alder']);
    });

    it('shows no avatars in a solo game', () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'))
          .withInvestigator(alder, { locationId: study }),
      );

      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      expect(screen.queryByRole('list', { name: 'Other investigators' })).toBeNull();
    });
  });

  describe('the steppers, while adjusting', () => {
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
        render(
          <InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} adjusting />,
        );

        fireEvent.click(within(panel('alder')).getByRole('button', { name: button }));

        await expect.poll(() => table.board.investigator(alder)[counter]).toBe(after);
      },
    );

    it.each([
      { button: 'Raise the Combat boost', boosts: { combat: 1 } },
      { button: 'Lower the Agility boost', boosts: { agility: -1 } },
    ])('"$button" leaves alder with the boosts $boosts', async ({ button, boosts }) => {
      const table = PlayTable.start(hurtAlder);
      render(
        <InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} adjusting />,
      );

      fireEvent.click(within(panel('alder')).getByRole('button', { name: button }));

      await expect.poll(() => table.board.investigator(alder).boosts).toEqual(boosts);
    });

    it('turns the boost steppers off while a step is queued', () => {
      const table = PlayTable.start(hurtAlder);
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy adjusting />);

      expect(
        within(panel('alder')).getByRole('button', { name: 'Raise the Combat boost' }),
      ).toHaveProperty('disabled', true);
    });

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

      render(
        <InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} adjusting />,
      );

      const off = within(panel('alder'))
        .getAllByRole('button')
        .filter((button) => (button as HTMLButtonElement).disabled)
        .map((button) => button.getAttribute('aria-label'));
      expect(off).toEqual(['Heal damage', 'Heal horror', 'Spend a resource']);
    });

    it('waits while a step is queued, turn controls too', () => {
      const table = PlayTable.start(hurtAlder.withTurnOf(alder));

      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy adjusting />);

      // The skills open a skill test, which changes nothing, so they need not wait.
      const skills = within(panel('alder')).getByRole('list', { name: 'Skills' });
      const on = within(panel('alder'))
        .getAllByRole('button')
        .filter((button) => !skills.contains(button))
        .filter((button) => !(button as HTMLButtonElement).disabled);
      expect(on).toEqual([]);
    });

    it('keeps the turn controls waiting while a step is queued', () => {
      const table = PlayTable.start(hurtAlder.withTurnOf(alder));

      render(
        <InvestigatorBar board={table.board} actions={actionsOn(table)} busy adjusting={false} />,
      );

      expect(within(panel('alder')).getByRole('button', { name: 'End turn' })).toHaveProperty(
        'disabled',
        true,
      );
    });

    it('keeps the turn controls waiting, since a turn step is no correction', () => {
      const table = PlayTable.start(hurtAlder.withTurnOf(alder));

      render(
        <InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} adjusting />,
      );

      expect(within(panel('alder')).getByRole('button', { name: 'End turn' })).toHaveProperty(
        'disabled',
        true,
      );
    });
  });

  it('shows no steppers outside adjust mode', () => {
    const table = PlayTable.start(newGame().withInvestigator(alder));

    render(
      <InvestigatorBar
        board={table.board}
        actions={actionsOn(table)}
        busy={false}
        adjusting={false}
      />,
    );

    expect(within(panel('alder')).queryByRole('button', { name: 'Take damage' })).toBeNull();
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

      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      expect(within(panel('alder')).getByRole('button', { name: 'Start turn' })).toBeTruthy();
      expect(within(panel('brook')).queryByRole('button', { name: 'Start turn' })).toBeNull();
    });

    it.each([
      {
        situation: 'resigned',
        table: () => {
          const table = PlayTable.start(
            newGame()
              .withLocation(study, blankLocation('study', { actions: [resignAction()] }), {
                revealed: true,
              })
              .withInvestigator(alder, { locationId: study })
              .withInvestigator(brook, { locationId: study }),
          );
          table.nextPhase();
          table.startTurn(alder);
          table.useCardAction(alder, study);
          return table;
        },
      },
      { situation: 'outside the investigation phase', table: () => PlayTable.start(twoAtStudy) },
    ])('offers no turn start to alder $situation', ({ table }) => {
      const played = table();

      render(
        <InvestigatorBar
          board={played.board}
          actions={actionsOn(played)}
          busy={false}
          adjusting={false}
        />,
      );

      expect(within(panel('alder')).queryByRole('button', { name: 'Start turn' })).toBeNull();
    });

    it('starts the turn of the investigator the players pick', async () => {
      const table = beforeTurns();
      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      fireEvent.click(within(panel('brook')).getByRole('button', { name: 'Start turn' }));

      await expect.poll(() => table.board.turn).toBe(brook);
    });

    it('shows a pip per action on the investigator whose turn it is, filled for each one left', () => {
      const table = PlayTable.start(twoAtStudy.withTurnOf(alder));
      table.adjustActions(alder, -1);

      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      const pips = within(panel('alder')).getByRole('list', { name: '2 actions left' });
      const filled = within(pips)
        .getAllByRole('listitem')
        .map((pip) => pip.hasAttribute('data-left'));
      expect(filled).toEqual([true, true, false]);
      expect(within(panel('brook')).queryByRole('group', { name: 'Turn' })).toBeNull();
      expect(within(panel('brook')).queryByRole('button', { name: 'Start turn' })).toBeNull();
    });

    it.each([{ button: 'End turn', after: { turnTaken: true } }])(
      '"$button" plays it for the investigator whose turn it is',
      async ({ button, after }) => {
        const table = PlayTable.start(twoAtStudy.withTurnOf(alder));
        render(
          <InvestigatorBar
            board={table.board}
            actions={actionsOn(table)}
            busy={false}
            adjusting={false}
          />,
        );

        fireEvent.click(within(panel('alder')).getByRole('button', { name: button }));

        await expect.poll(() => table.board.investigator(alder)).toMatchObject(after);
      },
    );

    it("names the study's two plain actions apart, as Action 1 and Action 2", () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(
            study,
            blankLocation('study', { actions: [{ effects: [] }, { effects: [] }] }),
            {
              revealed: true,
            },
          )
          .withInvestigator(alder, { locationId: study })
          .withTurnOf(alder),
      );

      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      const named = within(panel('alder'))
        .getAllByRole('button', { name: / · study$/ })
        .map((button) => [button.getAttribute('aria-label'), button.textContent]);
      expect(named).toEqual([
        ['Action 1 · study', 'Action 1'],
        ['Action 2 · study', 'Action 2'],
      ]);
    });

    it('"Resign · study" takes the study`s Resign for the investigator whose turn it is', async () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study', { actions: [resignAction()] }), {
            revealed: true,
          })
          .withInvestigator(alder, { locationId: study })
          .withInvestigator(brook, { locationId: study })
          .withTurnOf(alder),
      );
      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      fireEvent.click(within(panel('alder')).getByRole('button', { name: 'Resign · study' }));

      await expect
        .poll(() => table.board.investigator(alder))
        .toMatchObject({ status: 'resigned' });
    });

    it('offers no card action where no card has one', () => {
      const table = PlayTable.start(twoAtStudy.withTurnOf(alder));
      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      expect(within(panel('alder')).queryByRole('button', { name: / · study$/ })).toBeNull();
    });

    it('"Investigate" leaves the test of the investigation to the decision dialog', async () => {
      const table = PlayTable.start(twoAtStudy.withTurnOf(alder));
      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      fireEvent.click(within(panel('alder')).getByRole('button', { name: 'Investigate' }));

      await expect
        .poll(() => table.board.decisions)
        .toMatchObject([{ prompt: 'decision.investigate', for: alder }]);
    });

    it('turns "Play a card" off while dissonant voices in alder’s threat area forbid it', () => {
      const voices = blankTreachery('voices', {
        restrictions: [{ cannot: 'playAssetsOrEvents', who: 'threatArea' }],
      });
      const table = PlayTable.start(
        twoAtStudy.withCard(instanceId('voices'), voices, threatAreaOf(alder)).withTurnOf(alder),
      );
      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      expect(within(panel('alder')).getByRole('button', { name: 'Play a card' })).toHaveProperty(
        'disabled',
        true,
      );
    });

    it('turns "Investigate" off while a locked door on the study forbids it', () => {
      const lockedDoor = blankTreachery('locked_door', {
        restrictions: [{ cannot: 'investigate', of: 'host' }],
      });
      const table = PlayTable.start(
        twoAtStudy
          .withCard(instanceId('locked_door'), lockedDoor, attachedTo(study))
          .withTurnOf(alder),
      );
      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      expect(within(panel('alder')).getByRole('button', { name: 'Investigate' })).toHaveProperty(
        'disabled',
        true,
      );
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

      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

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

    it("opens an enemy's details from its card", () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'))
          .withInvestigator(alder, { locationId: study })
          .withCard(instanceId('ghoul'), blankEnemy('ghoul_minion'), engagedWith(alder)),
      );
      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      fireEvent.click(
        within(panel('alder')).getByRole('button', { name: 'Details of ghoul_minion' }),
      );

      expect(screen.getByRole('dialog', { name: 'ghoul_minion' })).toBeTruthy();
    });

    it('opens a treachery in the threat area to read', () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'))
          .withInvestigator(alder, { locationId: study })
          .withCard(instanceId('voices'), blankTreachery('dissonant_voices'), threatAreaOf(alder)),
      );
      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      fireEvent.click(
        within(panel('alder')).getByRole('button', { name: 'Read dissonant_voices' }),
      );

      const zoom = screen.getByRole('dialog', { name: 'dissonant_voices' });
      expect(within(zoom).getByText('Treachery')).toBeTruthy();
    });

    it("takes the action of a treachery in alder's threat area from its zoom and closes it", async () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'))
          .withInvestigator(alder, { locationId: study })
          .withCard(
            instanceId('fear'),
            blankTreachery('frozen_in_fear', { actions: [{ effects: [] }] }),
            threatAreaOf(alder),
          )
          .withTurnOf(alder),
      );
      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );
      fireEvent.click(within(panel('alder')).getByRole('button', { name: 'Read frozen_in_fear' }));
      const zoom = screen.getByRole('dialog', { name: 'frozen_in_fear' });

      fireEvent.click(within(zoom).getByRole('button', { name: 'Action · frozen_in_fear' }));
      await act(async () => {});

      expect(screen.queryByRole('dialog', { name: 'frozen_in_fear' })).toBeNull();
      expect(table.board.investigator(alder)).toMatchObject({ actions: 2 });
    });

    it('leaves the card whole while the threat area is empty', () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'))
          .withInvestigator(alder, { locationId: study }),
      );

      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

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

      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      const shown = within(panel('alder'))
        .queryAllByRole('button', { name: /threat area/ })
        .map((button) => button.getAttribute('aria-label'));
      expect(shown).toEqual(arrows);
    });
  });

  describe('the play area', () => {
    const lita = instanceId('lita_chantler');
    /** Alder controls Lita Chantler; brook controls nothing. */
    const aldersLita = () =>
      PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'))
          .withInvestigator(alder, { locationId: study })
          .withInvestigator(brook, { locationId: study })
          .withCard(lita, blankAsset('lita_chantler'), playAreaOf(alder)),
      );

    it('lists the cards alder controls under the card, and none for brook', () => {
      const table = aldersLita();

      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      const played = within(panel('alder')).getByRole('list', { name: 'Cards in play' });
      expect(within(played).getByRole('listitem').textContent).toBe('lita_chantler');
      expect(within(panel('brook')).queryByRole('list', { name: 'Cards in play' })).toBeNull();
    });

    it('opens a controlled card to read', () => {
      const table = aldersLita();
      render(
        <InvestigatorBar
          board={table.board}
          actions={actionsOn(table)}
          busy={false}
          adjusting={false}
        />,
      );

      fireEvent.click(within(panel('alder')).getByRole('button', { name: 'Read lita_chantler' }));

      expect(screen.getByRole('dialog', { name: 'lita_chantler' })).toBeTruthy();
    });
  });
});
