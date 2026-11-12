// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  blankLocation,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
  type ChaosToken,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { SkillTestDialog } from './SkillTestDialog';

const study = instanceId('study');
const alder = investigatorId('alder');

const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });
const result = () => screen.queryByRole('region', { name: 'Result' });
const outcome = () => within(result()!).getByRole('status').textContent;
/** The terms of the skill value before any token, and their sum, as the strip's left column lists them. */
const calculation = () =>
  within(screen.getByRole('list', { name: 'Skill value' }))
    .getAllByRole('listitem')
    .map((term) => term.textContent);
const pressedSkills = () =>
  within(screen.getByRole('region', { name: 'Skills' }))
    .getAllByRole('button', { pressed: true })
    .map((skill) => skill.getAttribute('aria-label'));

describe('SkillTestDialog', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  /**
   * Opens Alder's willpower test (willpower 3, agility 4) with `bag` as the chaos bag, so a draw
   * from a bag of one token kind is known in advance.
   */
  const renderWillpowerTest = (bag: ChaosToken[], onClose = () => {}) => {
    const table = PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'))
        .withInvestigator(alder, {
          name: 'Alder',
          locationId: study,
          skills: { willpower: 3, intellect: 2, combat: 1, agility: 4 },
        })
        .withChaosBag(bag),
    );
    const view = table.board.investigator(alder);
    if (!view) throw new Error('alder is at the table');
    render(
      <SkillTestDialog
        board={table.board}
        investigator={view}
        skill="willpower"
        onClose={onClose}
      />,
    );
  };

  it('tests the tapped skill and shows its value, but no outcome, before a token is drawn', () => {
    renderWillpowerTest(['-1']);

    const title = screen.getByRole('heading');
    expect(title.textContent).toBe('Skill test');
    const kicker = title.closest('hgroup')?.querySelector('p');
    expect(kicker?.textContent).toBe('Alder');
    expect(pressedSkills()).toEqual(['Willpower 3']);
    expect(calculation()).toEqual(['Willpower 3', '3']);
    expect(within(result()!).queryByRole('status')).toBeNull();
  });

  const chances = () =>
    screen.queryByRole('list', { name: 'Chance to pass' })
      ? within(screen.getByRole('list', { name: 'Chance to pass' }))
          .getAllByRole('listitem')
          .map((item) => item.textContent)
      : [];

  it.each<{ bag: ChaosToken[]; raises: number; shown: string[] }>([
    {
      bag: ['0', '-1', '-2', 'elderSign'],
      raises: 0,
      shown: ['25% to pass', '25% decided by a card', 'With +1: 50%', 'With +2: 75%'],
    },
    { bag: ['0', '-1'], raises: 0, shown: ['50% to pass', 'With +1: 100%'] },
    { bag: ['0', '-1'], raises: 1, shown: ['100% to pass'] },
  ])(
    'shows the chance to pass willpower 3 against 3 from $bag with the modifier raised $raises times',
    ({ bag, raises, shown }) => {
      renderWillpowerTest(bag);

      for (let i = 0; i < raises; i++) fireEvent.click(button('Raise the Modifier'));

      expect(chances()).toEqual(shown);
    },
  );

  it('shows no chance once the token is drawn', () => {
    renderWillpowerTest(['0']);

    fireEvent.click(button('Draw a token'));

    expect(chances()).toEqual([]);
  });

  it('hides the draw button once the token is drawn', () => {
    renderWillpowerTest(['-1']);

    fireEvent.click(button('Draw a token'));

    expect(screen.queryByRole('button', { name: 'Draw a token' })).toBeNull();
  });

  it.each<{ bag: ChaosToken[]; raises: number; shown: string }>([
    { bag: ['+1'], raises: 0, shown: 'Pass 4 ≥ 3 by 1' },
    { bag: ['+1'], raises: 1, shown: 'Pass 4 ≥ 4 by 0' },
    { bag: ['-2'], raises: 0, shown: 'Fail 1 < 3 by 2' },
    { bag: ['autoFail'], raises: 0, shown: 'Fail 0 < 3 by 3' },
  ])(
    'drawing from $bag with the difficulty raised $raises times from 3 shows "$shown"',
    ({ bag, raises, shown }) => {
      renderWillpowerTest(bag);

      for (let i = 0; i < raises; i++) fireEvent.click(button('Raise the Difficulty'));
      fireEvent.click(button('Draw a token'));

      expect(outcome()).toBe(shown);
    },
  );

  it('adds a second skill tapped to the tested one', () => {
    renderWillpowerTest(['-2']);

    fireEvent.click(button('Agility 4'));
    fireEvent.click(button('Draw a token'));

    expect(pressedSkills()).toEqual(['Willpower 3', 'Agility 4']);
    expect(calculation()).toEqual(['Willpower 3', 'Agility +4', '7']);
    expect(outcome()).toBe('Pass 5 ≥ 3 by 2');
  });

  it('tests another skill once the tapped one is dropped', () => {
    renderWillpowerTest(['0']);

    fireEvent.click(button('Agility 4'));
    fireEvent.click(button('Willpower 3'));
    fireEvent.click(button('Draw a token'));

    expect(pressedSkills()).toEqual(['Agility 4']);
    expect(outcome()).toBe('Pass 4 ≥ 3 by 1');
  });

  it("adds the players' modifier", () => {
    renderWillpowerTest(['0']);

    fireEvent.click(button('Raise the Modifier'));
    fireEvent.click(button('Raise the Modifier'));
    fireEvent.click(button('Draw a token'));

    expect(calculation()).toEqual(['Willpower 3', 'Modifier +2', '5']);
  });

  it('lists the tokens drawn in the order they came out, a symbol with its effect', () => {
    // Always the first token left, so the bless comes out first and reveals the skull.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderWillpowerTest(['bless', 'skull']);

    fireEvent.click(button('Draw a token'));

    const drawn = within(screen.getByRole('list', { name: 'Tokens drawn' }))
      .getAllByRole('listitem')
      .map((token) => token.textContent);
    expect(drawn).toEqual(['Bless +2', 'Skull ?']);
  });

  it('sums several tokens under them, a token the app cannot tell as "?"', () => {
    // Always the first token left: the bless, which reveals the elder sign, the investigator's own
    // ability.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderWillpowerTest(['bless', 'elderSign']);

    fireEvent.click(button('Draw a token'));

    expect(within(result()!).getByText('Tokens +2 ? = +2')).toBeTruthy();
    expect(within(result()!).getByText('Add the effect of Elder Sign yourself.')).toBeTruthy();
  });

  it('asks for another token when the bag runs out after a bless', () => {
    renderWillpowerTest(['bless']);

    fireEvent.click(button('Draw a token'));

    expect(outcome()).toBe('Reveal another token.');
  });

  it('cannot lower the difficulty below 0', () => {
    renderWillpowerTest(['0']);

    for (let i = 0; i < 3; i++) fireEvent.click(button('Lower the Difficulty'));

    expect(button('Lower the Difficulty').disabled).toBe(true);
  });

  it('closes with the × in its corner', () => {
    const onClose = vi.fn();
    renderWillpowerTest(['0'], onClose);

    fireEvent.click(button('Close'));

    expect(onClose).toHaveBeenCalledOnce();
  });

  describe('changing a drawn token as a card says', () => {
    const drawnTokens = () =>
      within(screen.getByRole('list', { name: 'Tokens drawn' }))
        .getAllByRole('listitem')
        .map((token) => token.textContent);

    it('ignores the −2, so willpower 3 passes difficulty 3 without it', () => {
      renderWillpowerTest(['-2']);
      fireEvent.click(button('Draw a token'));

      fireEvent.click(button('Change −2'));
      fireEvent.click(button('Ignore'));

      expect(outcome()).toBe('Pass 3 ≥ 3 by 0');
    });

    it('resolves an ignored token again', () => {
      renderWillpowerTest(['-2']);
      fireEvent.click(button('Draw a token'));
      fireEvent.click(button('Change −2'));
      fireEvent.click(button('Ignore'));

      fireEvent.click(button('Change −2'));
      fireEvent.click(button('Resolve'));

      expect(outcome()).toBe('Fail 1 < 3 by 2');
    });

    it('redraws the −2: back in the bag, the +1 comes out in its place', () => {
      // The first token left comes out first: the −2. For the redraw the last one left: the +1.
      vi.spyOn(Math, 'random').mockReturnValue(0);
      renderWillpowerTest(['-2', '+1']);
      fireEvent.click(button('Draw a token'));
      vi.spyOn(Math, 'random').mockReturnValue(0.9);

      fireEvent.click(button('Change −2'));
      fireEvent.click(button('Redraw'));

      expect(outcome()).toBe('Pass 4 ≥ 3 by 1');
    });

    it('replaces the skull with the +1 still in the bag', () => {
      // Always the first token left: the skull comes out, the +1 stays in the bag.
      vi.spyOn(Math, 'random').mockReturnValue(0);
      renderWillpowerTest(['skull', '+1']);
      fireEvent.click(button('Draw a token'));

      fireEvent.click(button('Change Skull'));
      fireEvent.click(button('Replace'));
      fireEvent.click(button('Replace with +1'));

      expect(drawnTokens()).toEqual(['+1']);
      expect(outcome()).toBe('Pass 4 ≥ 3 by 1');
    });

    it('puts the replaced skull back in the bag, so the next token revealed is the skull', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      renderWillpowerTest(['skull', '+1']);
      fireEvent.click(button('Draw a token'));
      fireEvent.click(button('Change Skull'));
      fireEvent.click(button('Replace'));
      fireEvent.click(button('Replace with +1'));

      fireEvent.click(button('Reveal another'));

      expect(drawnTokens()).toEqual(['+1', 'Skull ?']);
    });

    it('turns a replaced token back into itself', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      renderWillpowerTest(['skull', '+1']);
      fireEvent.click(button('Draw a token'));
      fireEvent.click(button('Change Skull'));
      fireEvent.click(button('Replace'));
      fireEvent.click(button('Replace with +1'));

      fireEvent.click(button('Change +1'));
      fireEvent.click(button('Replace'));
      fireEvent.click(button('Replace with Skull'));

      expect(drawnTokens()).toEqual(['Skull ?']);
    });

    it("offers no second +1 once another token was replaced with the bag's only one", () => {
      // The first token left comes out first: the skull; for the one revealed after it the last
      // one left: the −1, so the bag's only +1 stays in it.
      vi.spyOn(Math, 'random').mockReturnValue(0);
      renderWillpowerTest(['skull', '+1', '-1']);
      fireEvent.click(button('Draw a token'));
      fireEvent.click(button('Change Skull'));
      fireEvent.click(button('Replace'));
      fireEvent.click(button('Replace with +1'));
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      fireEvent.click(button('Reveal another'));

      fireEvent.click(button('Change −1'));
      fireEvent.click(button('Replace'));

      expect(screen.queryByRole('button', { name: 'Replace with +1' })).toBeNull();
      expect(button('Replace with Skull')).toBeTruthy();
    });

    it('offers no replacement once the bag holds no other token', () => {
      renderWillpowerTest(['-2']);
      fireEvent.click(button('Draw a token'));

      fireEvent.click(button('Change −2'));

      expect(button('Replace').disabled).toBe(true);
    });

    it('reveals the token a bless asks for again once the bless is resolved again', () => {
      // Always the first token left: the bless, then the −1 it reveals; once the −1 is back, again.
      vi.spyOn(Math, 'random').mockReturnValue(0);
      renderWillpowerTest(['bless', '-1']);
      fireEvent.click(button('Draw a token'));
      fireEvent.click(button('Change Bless'));
      fireEvent.click(button('Ignore'));

      fireEvent.click(button('Change Bless'));
      fireEvent.click(button('Resolve'));

      expect(drawnTokens()).toEqual(['Bless +2', '−1']);
      expect(outcome()).toBe('Pass 4 ≥ 3 by 1');
    });

    it('offers no other token while a bless still waits for its own', () => {
      renderWillpowerTest(['bless']);

      fireEvent.click(button('Draw a token'));

      expect(screen.queryByRole('button', { name: 'Reveal another' })).toBeNull();
    });

    it('reveals another token once the draw is done', () => {
      // Always the first token left: the −1, then the +1.
      vi.spyOn(Math, 'random').mockReturnValue(0);
      renderWillpowerTest(['-1', '+1']);
      fireEvent.click(button('Draw a token'));

      fireEvent.click(button('Reveal another'));

      expect(outcome()).toBe('Pass 3 ≥ 3 by 0');
      expect(screen.queryByRole('button', { name: 'Reveal another' })).toBeNull();
    });
  });
});
