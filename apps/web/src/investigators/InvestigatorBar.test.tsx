// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  advanceAct,
  advanceBySpendingClues,
  attachedTo,
  blankAct,
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
  perInvestigator,
  placeCluesOnSelf,
  PlayTable,
  playAreaOf,
  resignAction,
  threatAreaOf,
  whenTokensOnSelf,
} from '@arkham/engine';
import { range } from '@arkham/util';
import { initI18n } from '../i18n';
import { InvestigatorBar } from './InvestigatorBar';
import { DOUBLE_TAP_MS } from '../screens/useDoubleTap';
import { textLength } from './InvestigatorCard';
import { actionsOn } from '../state/gameActions.test_support';

const study = instanceId('study');
const alder = investigatorId('alder');
const brook = investigatorId('brook');

const panel = (name: string) => screen.getByRole('region', { name });

/**
 * The counters of `name`'s panel as [label, value] pairs, in the order the panel shows them: the
 * value as read out, the name of health's and sanity's printed symbol or else the token's number.
 */
const countersOf = (name: string) =>
  within(panel(name))
    .getAllByRole('term')
    .map((term) => {
      const value = term.nextElementSibling;
      const printed = value?.querySelector('[role="img"]');
      return [
        term.textContent,
        printed ? printed.getAttribute('aria-label') : value?.querySelector('data')?.textContent,
      ];
    });

describe('InvestigatorBar', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

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
      // Resources are shortened to fit their column, the full name as the title.
      ['Res.', '4'],
      ['Doom', '1'],
    ]);
    expect(countersOf('brook').map(([label]) => label)).not.toContain('Doom');
    expect(within(panel('alder')).getByTitle('Resources').textContent).toBe('Res.');
  });

  it.each([
    { stat: 'Health', name: '4/7', left: '4', pips: 7, greyed: 3 },
    { stat: 'Sanity', name: '5/6', left: '5', pips: 6, greyed: 1 },
  ])(
    'draws $stat as the card prints it, $left left on its symbol in a ring of $pips pips, $greyed greyed',
    ({ stat, name, left, pips, greyed }) => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'))
          .withInvestigator(alder, {
            locationId: study,
            health: { max: 7, damage: 3 },
            sanity: { max: 6, horror: 1 },
          }),
      );
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      const symbol = within(panel('alder')).getByRole('img', { name });
      expect(symbol.closest('[data-stat]')?.querySelector('dt')?.textContent).toBe(stat);
      expect(symbol.querySelector('data')?.textContent).toBe(left);
      expect(symbol.querySelectorAll('[data-pips] path')).toHaveLength(pips);
      expect(symbol.querySelectorAll('[data-pips] [data-taken]')).toHaveLength(greyed);
    },
  );

  it('marks the health left on its symbol when damage is taken', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withInvestigator(alder, { locationId: study, health: { max: 7, damage: 3 } }),
    );
    const bar = () => (
      <InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />
    );
    const { rerender } = render(bar());

    table.takeDamage(alder, 1);
    rerender(bar());

    const health = within(panel('alder')).getByRole('img', { name: '3/7' });
    expect(health.querySelector('data')?.getAttribute('data-delta')).toBe('−1');
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

    render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

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

    render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

    const combat = within(panel('alder')).getByRole('button', { name: 'Combat 3, boosted +2' });
    expect(
      [...combat.querySelectorAll('data')].map((data) => [data.value, data.textContent]),
    ).toEqual([
      ['3', '3'],
      ['2', '+2'],
    ]);
  });

  it('shows the card picture once it has loaded, landscape like the card', async () => {
    // jsdom loads no images: the probe the picture hook reads an SVG picture's shape with
    // loads at once, at the size of a landscape scan.
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 419;
        naturalHeight = 300;
        onload: (() => void) | null = null;
        set src(_url: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withInvestigator(alder, {
          locationId: study,
          imageSrc: cardImagePath('/bundles/cards/alder.png'),
        }),
    );
    render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);
    // The face is decorative (`aria-hidden`), so its picture has no role to find it by.
    const card = within(panel('alder')).getByRole('article');
    const picture = card.querySelector('svg[data-face="investigator"] image');
    if (!picture) throw new Error("alder's card has no picture");
    const beforeLoading = card.hasAttribute('data-picture');

    // jsdom loads no images, so the test fires the load itself.
    await act(async () => {
      fireEvent.load(picture);
      await Promise.resolve();
    });

    expect(picture.getAttribute('href')).toBe('https://arkhamdb.com/bundles/cards/alder.png');
    expect(beforeLoading).toBe(false);
    expect(card.getAttribute('data-picture')).toBe('shown');
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
    ])(
      'says alder is $status instead of where, and keeps their counters still',
      ({ status, line }) => {
        const table = PlayTable.start(
          newGame()
            .withLocation(study, blankLocation('study'))
            .withInvestigator(alder, { status, health: { max: 7, damage: 2 } }),
        );

        render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);
        const health = within(panel('alder')).getByRole('img', { name: '5/7' });
        fireEvent.click(health);
        fireEvent.click(health);

        expect(within(panel('alder')).getByText(line)).toBeTruthy();
        expect(screen.queryByRole('complementary', { name: /^alder · / })).toBeNull();
      },
    );

    it('says when alder is at no location', () => {
      const table = PlayTable.start(newGame().withInvestigator(alder));

      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      expect(within(panel('alder')).getByText('Not at a location')).toBeTruthy();
    });
  });

  it("prints the subname and class of the investigator's card, looked up by its code", () => {
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
        printed={(code) =>
          code === 'alder' ? { subname: 'The Tester', factionCode: 'guardian' } : undefined
        }
      />,
    );

    const card = within(panel('alder')).getByRole('article');
    // The class shows only on the decorative face, which has no role to find it by.
    expect(within(card).getByText('The Tester')).toBeTruthy();
    expect(card.querySelector('[data-class-icon]')?.getAttribute('data-class-icon')).toBe(
      'guardian',
    );
  });

  it('opens the whole card from a tap on the art, its traits, abilities and flavour on its notebook page', () => {
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
        printed={() => ({
          factionCode: 'guardian',
          traits: 'Tester. Hero.',
          text: '[reaction] After you pass a test: gain 1 resource.\n<b>Forced</b> – Nothing.',
          flavor: 'It always works in the tests.',
        })}
      />,
    );

    fireEvent.click(within(panel('alder')).getByRole('button', { name: "Show alder's card" }));

    const card = screen.getByRole('dialog', { name: 'alder' });
    // The page is a plain block of the card's paragraphs, with no role of its own; each symbol
    // reads as its name in braces.
    for (const icon of card.querySelectorAll('[data-page] [role="img"]')) {
      icon.textContent = `{${icon.getAttribute('aria-label') ?? ''}}`;
    }
    const page = Array.from(card.querySelectorAll('[data-page] > *'), (part) => part.textContent);
    expect(page).toEqual([
      'Tester. Hero.',
      '{Reaction} After you pass a test: gain 1 resource.',
      'Forced – Nothing.',
      'It always works in the tests.',
    ]);
  });

  it.each([
    { size: 'short', text: 'x'.repeat(200) },
    { size: 'long', text: 'x'.repeat(300) },
    { size: 'longest', text: 'x'.repeat(450) },
  ])('sets a page of $text.length characters in its $size size', ({ size, text }) => {
    expect(textLength({ factionCode: 'seeker', text })).toBe(size);
  });

  it.each([
    {
      view: "the phone's compact view, which opens the detail view",
      onOpen: vi.fn(),
      shape: 'strip',
    },
    { view: 'a wider screen', onOpen: undefined, shape: 'banner' },
  ])('draws the card as the $shape on $view', ({ onOpen, shape }) => {
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
        onOpen={onOpen}
      />,
    );

    // The shape is the stylesheet's to draw, so only its mark on the card says which one shows.
    expect(
      panel('alder').querySelector('[data-card="investigator"]')?.getAttribute('data-shape'),
    ).toBe(shape);
  });

  it("shows the whole card in the panel on the phone's expanded bar, its page text with it", () => {
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
        whole
        printed={() => ({ factionCode: 'guardian', traits: 'Tester. Hero.' })}
      />,
    );

    const card = panel('alder').querySelector('[data-card="investigator"]');
    expect(card?.getAttribute('data-shape')).toBe('full');
    expect(card?.querySelector('[data-page]')?.textContent).toBe('Tester. Hero.');
    expect(within(panel('alder')).queryByRole('button', { name: "Show alder's card" })).toBeNull();
  });

  describe('the lead marker', () => {
    const alderAndBrook = () =>
      PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study', { actions: [resignAction()] }), {
            revealed: true,
          })
          .withInvestigator(alder, { locationId: study })
          .withInvestigator(brook, { locationId: study }),
      );

    /** The markers before where `name` is, by what they say. */
    // The markers open the status line under the card, which has no role to find it by.
    const markersOf = (name: string) =>
      Array.from(panel(name).querySelectorAll('[data-whereabouts] [role="img"]'), (marker) =>
        marker.getAttribute('aria-label'),
      );

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
        brookMarkers: [],
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

      render(<InvestigatorBar board={played.board} actions={actionsOn(played)} busy={false} />);

      expect(markersOf('alder')).toEqual(alderMarkers);
      expect(markersOf('brook')).toEqual(brookMarkers);
    });
  });

  describe('the focused panel, swiped to on a phone', () => {
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

    // jsdom has no IntersectionObserver: this one records what each panel watches, so a test
    // can say which panel the players swiped into view.
    const watching = new Map<Element, IntersectionObserverCallback>();
    beforeEach(() => {
      watching.clear();
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(private readonly callback: IntersectionObserverCallback) {}
          observe(panel: Element) {
            watching.set(panel, this.callback);
          }
          disconnect() {}
        },
      );
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const swipeTo = (name: string) =>
      act(() => {
        const shown = panel(name);
        watching.get(shown)?.(
          [{ target: shown, isIntersecting: true } as unknown as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      });

    /** The compact view's bar, a row of panels to swipe between (its `onOpen`). */
    const phoneBar = (table: PlayTable) => (
      <InvestigatorBar
        board={table.board}
        actions={actionsOn(table)}
        busy={false}
        onOpen={() => {}}
      />
    );

    it.each([
      {
        situation: 'outside a turn, the lead investigator Alder',
        turnOf: undefined,
        shown: 'alder',
      },
      { situation: 'on Brook’s turn, Brook', turnOf: brook, shown: 'brook' },
    ])('focuses $situation', ({ turnOf, shown }) => {
      const table = alderAndBrook();
      if (turnOf) {
        table.nextPhase();
        table.startTurn(turnOf);
      }

      render(phoneBar(table));

      expect(focused()).toEqual([shown]);
    });

    it('focuses the investigator swiped into view, until the turn changes', () => {
      const table = alderAndBrook();
      table.nextPhase();
      table.startTurn(alder);
      const { rerender } = render(phoneBar(table));

      swipeTo('brook');
      const afterSwipe = focused();
      table.endTurn(alder);
      table.startTurn(brook);
      table.endTurn(brook);
      rerender(phoneBar(table));

      expect(afterSwipe).toEqual(['brook']);
      expect(focused()).toEqual(['alder']);
    });

    it('brings the turn investigator back to the front when their turn comes round again', () => {
      const table = alderAndBrook();
      table.nextPhase();
      table.startTurn(alder);
      const { rerender } = render(phoneBar(table));

      swipeTo('brook');
      table.endTurn(alder);
      table.startTurn(brook);
      table.endTurn(brook);
      table.nextPhase();
      table.nextPhase();
      table.nextPhase();
      table.nextPhase();
      table.startTurn(alder);
      rerender(phoneBar(table));

      expect(table.board.round).toBe(2);
      expect(focused()).toEqual(['alder']);
    });

    it("dots each panel with its seat in the row, brook's second of two filled on brook's panel", () => {
      render(phoneBar(alderAndBrook()));

      const dots = panel('brook').querySelector('ol[data-dots]')?.querySelectorAll('li');
      expect([...(dots ?? [])].map((dot) => dot.hasAttribute('data-current'))).toEqual([
        false,
        true,
      ]);
    });

    it('keeps the focus on a wider screen, whose panels all show', () => {
      const table = alderAndBrook();
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      swipeTo('brook');

      expect(watching.size).toBe(0);
      expect(focused()).toEqual(['alder']);
    });
  });

  describe('the − / + bubble a double tap opens on a counter', () => {
    // Alder has 2 damage of 7 health, 2 horror of 6 sanity, 1 clue and 3 resources, in the
    // revealed study, which holds 2 clues.
    const alderInStudy = newGame()
      .withLocation(study, blankLocation('study', { clues: perInvestigator(2) }), {
        revealed: true,
      })
      .withInvestigator(alder, {
        locationId: study,
        health: { max: 7, damage: 2 },
        sanity: { max: 6, horror: 2 },
        clues: 1,
        resources: 3,
      });
    const bubble = () => screen.getByRole('complementary', { name: /^alder · / });
    const doubleTap = (counter: HTMLElement) => {
      fireEvent.click(counter);
      fireEvent.click(counter);
    };

    it.each([
      { counter: '5/7', button: 'Take damage', stat: 'damage', after: 3 },
      { counter: '5/7', button: 'Heal damage', stat: 'damage', after: 1 },
      { counter: '4/6', button: 'Take horror', stat: 'horror', after: 3 },
      { counter: '4/6', button: 'Heal horror', stat: 'horror', after: 1 },
      { counter: '1', button: 'Take a clue from their location', stat: 'clues', after: 2 },
      { counter: '1', button: 'Place a clue on their location', stat: 'clues', after: 0 },
      { counter: '3', button: 'Spend a resource', stat: 'resources', after: 2 },
      { counter: '3', button: 'Gain a resource', stat: 'resources', after: 4 },
    ] as const)(
      'on the counter "$counter", "$button" leaves alder with $after $stat',
      async ({ counter, button, stat, after }) => {
        const table = PlayTable.start(alderInStudy);
        render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

        doubleTap(within(panel('alder')).getByRole('img', { name: counter }));
        fireEvent.click(within(bubble()).getByRole('button', { name: button }));

        await expect.poll(() => table.board.investigator(alder)[stat]).toBe(after);
      },
    );

    it.each([
      { stat: 'health', off: 'Heal damage' },
      { stat: 'sanity', off: 'Heal horror' },
      { stat: 'resources', off: 'Spend a resource' },
    ])('turns "$off" off on the $stat counter, which holds none', ({ stat, off }) => {
      // Alder has taken no damage or horror and holds no resource or clue.
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

      const counter = panel('alder').querySelector<HTMLElement>(`[data-stat="${stat}"] dd > *`);
      if (!counter) throw new Error(`alder has no ${stat} counter`);
      doubleTap(counter);

      expect(within(bubble()).getByRole('button', { name: off })).toHaveProperty('disabled', true);
    });

    it('keeps its buttons off while a step is queued', () => {
      const table = PlayTable.start(alderInStudy);
      const { rerender } = render(
        <InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />,
      );
      doubleTap(within(panel('alder')).getByRole('img', { name: '3' }));

      rerender(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy />);

      const on = within(bubble())
        .getAllByRole('button')
        .filter((button) => !(button as HTMLButtonElement).disabled);
      expect(on).toEqual([]);
    });

    it('is titled with whose counter it changes', () => {
      const table = PlayTable.start(alderInStudy);
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      doubleTap(within(panel('alder')).getByRole('img', { name: '5/7' }));

      expect(within(bubble()).getByRole('heading').textContent).toBe('alder · Health');
    });

    it.each([
      { button: 'Raise the Combat boost', boosts: { combat: 1 } },
      { button: 'Lower the Combat boost', boosts: { combat: -1 } },
    ])('on the Combat skill, "$button" leaves alder with $boosts', async ({ button, boosts }) => {
      const table = PlayTable.start(alderInStudy);
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      doubleTap(within(panel('alder')).getByRole('button', { name: /^Combat/ }));
      fireEvent.click(
        within(screen.getByRole('complementary', { name: 'alder · Combat boost' })).getByRole(
          'button',
          { name: button },
        ),
      );

      await expect.poll(() => table.board.investigator(alder).boosts).toEqual(boosts);
    });

    it('opens the skill test on a single tap on a skill, once no second tap came', () => {
      const table = PlayTable.start(alderInStudy);
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      fireEvent.click(within(panel('alder')).getByRole('button', { name: /^Combat/ }));
      const beforeTheWait = screen.queryByRole('dialog');
      act(() => vi.advanceTimersByTime(DOUBLE_TAP_MS));
      vi.useRealTimers();

      expect(beforeTheWait).toBeNull();
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.queryByRole('complementary')).toBeNull();
    });

    it('opens on a double tap only, not on a single tap', () => {
      const table = PlayTable.start(alderInStudy);
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      fireEvent.click(within(panel('alder')).getByRole('img', { name: '3' }));

      expect(screen.queryByRole('complementary', { name: /^alder · / })).toBeNull();
    });

    it.each([
      { how: 'a press beside it', close: () => fireEvent.pointerDown(document.body) },
      { how: 'Escape', close: () => fireEvent.keyDown(document, { key: 'Escape' }) },
    ])('closes on $how', ({ close }) => {
      const table = PlayTable.start(alderInStudy);
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);
      doubleTap(within(panel('alder')).getByRole('img', { name: '3' }));

      act(close);

      expect(screen.queryByRole('complementary', { name: /^alder · / })).toBeNull();
    });
  });

  it('waits while a step is queued, turn controls too', () => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withInvestigator(alder, { locationId: study })
        .withTurnOf(alder),
    );

    render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy />);

    // The skills open a skill test and the art the whole card; neither changes anything, so they
    // need not wait.
    const skills = within(panel('alder')).getByRole('list', { name: 'Skills' });
    const card = within(panel('alder')).getByRole('button', { name: "Show alder's card" });
    const on = within(panel('alder'))
      .getAllByRole('button')
      .filter((button) => !skills.contains(button) && button !== card)
      .filter((button) => !(button as HTMLButtonElement).disabled);
    expect(on).toEqual([]);
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
      { situation: 'before anyone’s turn', table: beforeTurns, primary: ['Start turn'] },
      {
        situation: 'on alder’s turn',
        table: () => PlayTable.start(twoAtStudy.withTurnOf(alder)),
        primary: ['End turn'],
      },
    ])('marks only the turn’s own step as the primary button $situation', ({ table, primary }) => {
      const played = table();
      render(<InvestigatorBar board={played.board} actions={actionsOn(played)} busy={false} />);

      const primaries = within(panel('alder'))
        .getAllByRole('button')
        .filter((button) => button.hasAttribute('data-primary'))
        .map((button) => button.getAttribute('aria-label') ?? button.textContent);
      expect(primaries).toEqual(primary);
    });

    it.each([{ button: 'End turn', after: { turnTaken: true } }])(
      '"$button" plays it for the investigator whose turn it is',
      async ({ button, after }) => {
        const table = PlayTable.start(twoAtStudy.withTurnOf(alder));
        render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

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

      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

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
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      fireEvent.click(within(panel('alder')).getByRole('button', { name: 'Resign · study' }));

      await expect
        .poll(() => table.board.investigator(alder))
        .toMatchObject({ status: 'resigned' });
    });

    it('offers no card action where no card has one', () => {
      const table = PlayTable.start(twoAtStudy.withTurnOf(alder));
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      expect(within(panel('alder')).queryByRole('button', { name: / · study$/ })).toBeNull();
    });

    it('"Investigate" leaves the test of the investigation to the decision dialog', async () => {
      const table = PlayTable.start(twoAtStudy.withTurnOf(alder));
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      fireEvent.click(within(panel('alder')).getByRole('button', { name: 'Investigate' }));

      await expect
        .poll(() => table.board.decisions)
        .toMatchObject([{ prompt: 'decision.investigate', for: alder }]);
    });

    it('turns "Play a card" off while dissonant voices in alder’s threat area forbid it', () => {
      const voices = blankTreachery('voices', {
        restrictions: [{ cannot: ['play'], what: 'cards', who: 'threatArea' }],
      });
      const table = PlayTable.start(
        twoAtStudy.withCard(instanceId('voices'), voices, threatAreaOf(alder)).withTurnOf(alder),
      );
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      expect(within(panel('alder')).getByRole('button', { name: 'Play a card' })).toHaveProperty(
        'disabled',
        true,
      );
    });

    describe('"Play a card" with alder holding 5 resources on their turn', () => {
      const aldersTurnWithFive = () =>
        PlayTable.start(
          newGame()
            .withLocation(study, blankLocation('study'))
            .withInvestigator(alder, { locationId: study, resources: 5 })
            .withTurnOf(alder),
        );
      const playSheet = () => screen.getByRole('dialog', { name: 'Play a card' });

      it.each([
        { tapped: 'resource 3', button: 'Play · pay 3', left: 2 },
        { tapped: 'resource 5', button: 'Play · pay 5', left: 0 },
        { tapped: 'resource 1', button: 'Play without paying', left: 5 },
      ])('taps $tapped, plays with "$button" and keeps $left', async ({ tapped, button, left }) => {
        const table = aldersTurnWithFive();
        render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

        fireEvent.click(within(panel('alder')).getByRole('button', { name: 'Play a card' }));
        fireEvent.click(within(playSheet()).getByRole('button', { name: tapped }));
        fireEvent.click(within(playSheet()).getByRole('button', { name: button }));

        await expect
          .poll(() => table.board.investigator(alder))
          .toMatchObject({ resources: left, actions: 2 });
      });

      it('closes with × without playing, so alder keeps all three actions', () => {
        const table = aldersTurnWithFive();
        render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

        fireEvent.click(within(panel('alder')).getByRole('button', { name: 'Play a card' }));
        fireEvent.click(within(playSheet()).getByRole('button', { name: 'Close' }));

        expect(screen.queryByRole('dialog', { name: 'Play a card' })).toBeNull();
        expect(table.board.investigator(alder)).toMatchObject({ resources: 5, actions: 3 });
      });
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
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      expect(within(panel('alder')).getByRole('button', { name: 'Investigate' })).toHaveProperty(
        'disabled',
        true,
      );
    });
  });

  // jsdom lays nothing out, so the hit test for the location under the pointer finds what a test
  // puts under it: a stand-in for a location's tile on the map. It has no pointer capture either.
  describe('dragging a clue off the card', () => {
    const hallway = instanceId('hallway');
    beforeEach(() => {
      HTMLElement.prototype.setPointerCapture = () => {};
    });
    afterEach(() => {
      Reflect.deleteProperty(document, 'elementFromPoint');
      Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture');
    });

    /** Drags alder's clue count from (10, 10) to (300, 200) and lets go there. */
    function dragAlderClue() {
      const clues = panel('alder').querySelector('[data-drag="clues"]');
      if (!clues) throw new Error("alder's clue count is not draggable");
      fireEvent.pointerDown(clues, { pointerId: 1, clientX: 10, clientY: 10 });
      fireEvent.pointerMove(clues, { pointerId: 1, clientX: 300, clientY: 200 });
      fireEvent.pointerUp(clues, { pointerId: 1, clientX: 300, clientY: 200 });
    }

    it.each([
      { where: 'on the study, where alder is', tile: study, after: { alder: 1, study: 1 } },
      { where: 'on the hallway, where alder is not', tile: hallway, after: { alder: 2, study: 0 } },
    ])('places a clue dropped $where: $after', async ({ tile, after }) => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'), { revealed: true })
          .withLocation(hallway, blankLocation('hallway'), { revealed: true })
          .withInvestigator(alder, { locationId: study, clues: 2 }),
      );
      render(
        <>
          <InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />
          <svg>
            <g data-location={tile}>
              <title>{tile}</title>
            </g>
          </svg>
        </>,
      );
      document.elementFromPoint = () => document.querySelector(`[data-location="${tile}"] > title`);

      dragAlderClue();
      await act(async () => {});

      expect(table.board.investigator(alder).clues).toBe(after.alder);
      expect(table.board.location(study).clues).toBe(after.study);
    });

    it('places nothing on a tap on the clue count over the study, where alder is', async () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'), { revealed: true })
          .withInvestigator(alder, { locationId: study, clues: 2 }),
      );
      render(
        <>
          <InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />
          <svg>
            <g data-location={study}>
              <title>study</title>
            </g>
          </svg>
        </>,
      );
      document.elementFromPoint = () => document.querySelector('[data-location] > title');
      const clues = panel('alder').querySelector('[data-drag="clues"]');
      if (!clues) throw new Error("alder's clue count is not draggable");

      fireEvent.pointerDown(clues, { pointerId: 1, clientX: 10, clientY: 10 });
      fireEvent.pointerUp(clues, { pointerId: 1, clientX: 10, clientY: 10 });
      await act(async () => {});

      expect(table.board.investigator(alder).clues).toBe(2);
    });

    describe('onto the act', () => {
      const firstAct = instanceId('first_act');
      /** Renders the bar over `table` beside a stand-in for the header's act, under the pointer. */
      function renderWithAct(table: PlayTable) {
        render(
          <>
            <InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />
            <section data-slot="act">
              <h2>Act</h2>
            </section>
          </>,
        );
        document.elementFromPoint = () => screen.getByRole('heading', { name: 'Act' });
      }

      it('leaves an act for 2 clues current while alder holds only 1', async () => {
        const table = PlayTable.start(
          newGame()
            .withLocation(study, blankLocation('study'), { revealed: true })
            .withAct(
              firstAct,
              blankAct('first_act', { actions: [advanceBySpendingClues(perInvestigator(2))] }),
            )
            .withAct(instanceId('second_act'), blankAct('second_act'))
            .withInvestigator(alder, { locationId: study, clues: 1 })
            .withTurnOf(alder),
        );
        renderWithAct(table);

        dragAlderClue();
        await act(async () => {});

        expect(table.board.act?.name).toBe('first_act');
        expect(table.board.investigator(alder).clues).toBe(1);
      });

      it("advances an act for 2 clues alder holds on alder's turn, like its button", async () => {
        const table = PlayTable.start(
          newGame()
            .withLocation(study, blankLocation('study'), { revealed: true })
            .withAct(
              firstAct,
              blankAct('first_act', { actions: [advanceBySpendingClues(perInvestigator(2))] }),
            )
            .withAct(instanceId('second_act'), blankAct('second_act'))
            .withInvestigator(alder, { locationId: study, clues: 2 })
            .withTurnOf(alder),
        );
        renderWithAct(table);

        dragAlderClue();
        await act(async () => {});

        expect(table.board.act?.name).toBe('second_act');
        expect(table.board.investigator(alder).clues).toBe(0);
      });

      /** An act that takes clues on it: its action costs 1 clue and places 1 clue on it. */
      const ritualAct = blankAct('ritual_act', {
        actions: [{ cost: { spend: 'clues', amount: 1 }, effects: [placeCluesOnSelf(1)] }],
        abilities: [whenTokensOnSelf('clue', fixed(3), advanceAct())],
      });

      it.each([
        { whose: "alder's turn", turn: alder, alderKeeps: 1, onAct: 1 },
        { whose: "brook's turn", turn: brook, alderKeeps: 2, onAct: 0 },
      ])(
        'drops a clue on an act that takes clues on it on $whose: alder keeps $alderKeeps and the act holds $onAct',
        async ({ turn, alderKeeps, onAct }) => {
          const table = PlayTable.start(
            newGame()
              .withLocation(study, blankLocation('study'), { revealed: true })
              .withAct(firstAct, ritualAct)
              .withInvestigator(alder, { locationId: study, clues: 2 })
              .withInvestigator(brook, { locationId: study })
              .withTurnOf(turn),
          );
          renderWithAct(table);

          dragAlderClue();
          await act(async () => {});

          expect(table.board.investigator(alder).clues).toBe(alderKeeps);
          expect(table.board.act?.clues).toBe(onAct);
        },
      );
    });

    it('shows a clue token over the page while it is dragged', () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'), { revealed: true })
          .withInvestigator(alder, { locationId: study, clues: 2 }),
      );
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);
      const clues = panel('alder').querySelector('[data-drag="clues"]');
      if (!clues) throw new Error("alder's clue count is not draggable");

      fireEvent.pointerDown(clues, { pointerId: 1, clientX: 10, clientY: 10 });
      fireEvent.pointerMove(clues, { pointerId: 1, clientX: 300, clientY: 200 });

      expect(
        document.body
          .querySelector<HTMLElement>('[data-token-ghost="clue"]')
          ?.style.getPropertyValue('--ghost-y'),
      ).toBe('200px');
    });

    it.each([
      { why: 'holding no clue', clues: 0, busy: false },
      { why: 'while a step is queued', clues: 2, busy: true },
    ])('leaves the clue count undraggable $why', ({ clues, busy }) => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'), { revealed: true })
          .withInvestigator(alder, { locationId: study, clues }),
      );
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={busy} />);

      expect(panel('alder').querySelector('[data-stat="clues"] [data-drag]')).toBeNull();
    });
  });

  describe('dragging damage, horror or a resource back to the token pool', () => {
    beforeEach(() => {
      HTMLElement.prototype.setPointerCapture = () => {};
    });
    afterEach(() => {
      Reflect.deleteProperty(document, 'elementFromPoint');
      Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture');
    });

    /** Alder with 2 damage of 7 health, 2 horror of 6 sanity and 3 resources. */
    const hurtAlder = () =>
      PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'), { revealed: true })
          .withInvestigator(alder, {
            locationId: study,
            health: { max: 7, damage: 2 },
            sanity: { max: 6, horror: 2 },
            resources: 3,
          }),
      );

    /** Drags alder's `stat` off the card from (10, 10) and lets go at (300, 40) over `under`. */
    async function dragOffAlder(stat: 'health' | 'sanity' | 'resources', under: Element | null) {
      document.elementFromPoint = () => under;
      const counter = panel('alder').querySelector(`[data-stat="${stat}"] [data-drag]`);
      if (!counter) throw new Error(`alder's ${stat} is not draggable`);
      fireEvent.pointerDown(counter, { pointerId: 1, clientX: 10, clientY: 10 });
      fireEvent.pointerMove(counter, { pointerId: 1, clientX: 300, clientY: 40 });
      fireEvent.pointerUp(counter, { pointerId: 1, clientX: 300, clientY: 40 });
      await act(async () => {});
    }

    // The damage lies on the heart (health), the horror on the brain (sanity).
    it.each([
      { stat: 'health', after: { damage: 1, horror: 2, resources: 3 } },
      { stat: 'sanity', after: { damage: 2, horror: 1, resources: 3 } },
      { stat: 'resources', after: { damage: 2, horror: 2, resources: 2 } },
    ] as const)(
      "takes one off alder's $stat dropped on the pool: $after",
      async ({ stat, after }) => {
        const table = hurtAlder();
        render(
          <>
            <InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />
            <section data-pool>
              <h2>Token pool</h2>
            </section>
          </>,
        );

        await dragOffAlder(stat, screen.getByRole('heading', { name: 'Token pool' }));

        expect(table.board.investigator(alder)).toMatchObject(after);
      },
    );

    it('keeps the damage when it is dropped anywhere but the pool', async () => {
      const table = hurtAlder();
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      await dragOffAlder('health', null);

      expect(table.board.investigator(alder).damage).toBe(2);
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

    it.each([
      { card: 'dissonant_voices', picture: 'https://arkhamdb.com/bundles/cards/voices.png' },
      { card: 'ghoul_minion', picture: 'https://arkhamdb.com/bundles/cards/ghoul.png' },
    ])("shows $card's picture in its art strip once it has loaded", async ({ card, picture }) => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'))
          .withInvestigator(alder, { locationId: study })
          .withCard(
            instanceId('voices'),
            blankTreachery('dissonant_voices', {
              imageSrc: cardImagePath('/bundles/cards/voices.png'),
            }),
            threatAreaOf(alder),
          )
          .withCard(
            instanceId('ghoul'),
            blankEnemy('ghoul_minion', { imageSrc: cardImagePath('/bundles/cards/ghoul.png') }),
            engagedWith(alder),
          ),
      );
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);
      const threatArea = within(panel('alder')).getByRole('list', { name: 'Threat area' });
      const smallCard = within(threatArea)
        .getAllByRole('listitem')
        .find((item) => item.querySelector('p')?.textContent === card);
      // The art is decorative (`alt=""`), so it has no role to find it by.
      const art = smallCard?.querySelector('img');
      if (!art) throw new Error(`${card} has no art strip`);
      const beforeLoading = art.hasAttribute('data-shown');

      // jsdom loads no images, so the test fires the load itself.
      fireEvent.load(art);

      expect(art.getAttribute('src')).toBe(picture);
      expect(beforeLoading).toBe(false);
      expect(art.hasAttribute('data-shown')).toBe(true);
    });

    it('marks the damage dealt to an engaged enemy on the health it has left', () => {
      const ghoul = instanceId('ghoul');
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'))
          .withInvestigator(alder, { locationId: study })
          .withCard(ghoul, blankEnemy('ghoul_minion', { health: fixed(3) }), engagedWith(alder)),
      );
      const bar = () => (
        <InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />
      );
      const { rerender } = render(bar());

      table.play({ type: 'DamageEnemy', enemyId: ghoul, amount: 1 });
      rerender(bar());

      const threatArea = within(panel('alder')).getByRole('list', { name: 'Threat area' });
      const healthLeft = within(threatArea).getByRole('listitem').querySelector('data');
      expect(healthLeft?.textContent).toBe('2/3');
      expect(healthLeft?.dataset.delta).toBe('−1');
    });

    it("opens an enemy's details from its card", async () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'))
          .withInvestigator(alder, { locationId: study })
          .withCard(instanceId('ghoul'), blankEnemy('ghoul_minion'), engagedWith(alder)),
      );
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      fireEvent.click(
        within(panel('alder')).getByRole('button', { name: 'Details of ghoul_minion' }),
      );

      // Once no second tap came, which would have opened its − / + bubble instead.
      expect(await screen.findByRole('dialog', { name: 'ghoul_minion' })).toBeTruthy();
    });

    it.each([
      { button: 'Deal 1 damage', stat: 'damage', after: 2 },
      { button: 'Heal 1 damage', stat: 'damage', after: 0 },
      { button: 'Add doom', stat: 'doom', after: 2 },
      { button: 'Remove doom', stat: 'doom', after: 0 },
    ] as const)(
      'on a ghoul minion with 1 damage and 1 doom, "$button" in its bubble leaves $after $stat',
      async ({ button, stat, after }) => {
        const table = PlayTable.start(
          newGame()
            .withLocation(study, blankLocation('study'))
            .withInvestigator(alder, { locationId: study })
            .withCard(
              instanceId('ghoul'),
              blankEnemy('ghoul_minion', { health: perInvestigator(3) }),
              engagedWith(alder),
              { tokens: { damage: 1, doom: 1 } },
            ),
        );
        render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);
        const card = within(panel('alder')).getByRole('button', {
          name: 'Details of ghoul_minion',
        });

        fireEvent.click(card);
        fireEvent.click(card);
        fireEvent.click(
          within(screen.getByRole('complementary', { name: 'ghoul_minion' })).getByRole('button', {
            name: button,
          }),
        );

        await expect.poll(() => table.board.enemy(instanceId('ghoul'))[stat] ?? 0).toBe(after);
      },
    );

    it("opens a treachery on the card shell, in alder's threat area by the kicker", () => {
      const table = PlayTable.start(
        newGame()
          .withLocation(study, blankLocation('study'))
          .withInvestigator(alder, { locationId: study })
          .withCard(instanceId('voices'), blankTreachery('dissonant_voices'), threatAreaOf(alder)),
      );
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      fireEvent.click(
        within(panel('alder')).getByRole('button', { name: 'Read dissonant_voices' }),
      );

      const details = screen.getByRole('dialog', { name: 'dissonant_voices' });
      expect(within(details).getByText("In alder's threat area")).toBeTruthy();
    });

    it("takes the action of a treachery in alder's threat area from its details, which stay open", async () => {
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
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);
      fireEvent.click(within(panel('alder')).getByRole('button', { name: 'Read frozen_in_fear' }));
      const details = screen.getByRole('dialog', { name: 'frozen_in_fear' });

      fireEvent.click(within(details).getByRole('button', { name: 'Action · frozen_in_fear' }));
      await act(async () => {});

      expect(screen.getByRole('dialog', { name: 'frozen_in_fear' })).toBeTruthy();
      expect(table.board.investigator(alder)).toMatchObject({ actions: 2 });
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

      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      const played = within(panel('alder')).getByRole('list', { name: 'Cards in play' });
      expect(within(played).getByRole('listitem').textContent).toBe('lita_chantler');
      expect(within(panel('brook')).queryByRole('list', { name: 'Cards in play' })).toBeNull();
    });

    it("opens a controlled card on the card shell, in alder's play area by the kicker", () => {
      const table = aldersLita();
      render(<InvestigatorBar board={table.board} actions={actionsOn(table)} busy={false} />);

      fireEvent.click(within(panel('alder')).getByRole('button', { name: 'Read lita_chantler' }));

      const details = screen.getByRole('dialog', { name: 'lita_chantler' });
      expect(within(details).getByText("In alder's play area")).toBeTruthy();
    });
  });
});
