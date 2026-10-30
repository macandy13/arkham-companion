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

  it('tests the tapped skill and shows no result before a token is drawn', () => {
    renderWillpowerTest(['-1']);

    const heading = screen.getByRole('heading');
    expect(heading.textContent).toBe('Skill test');
    expect(heading.previousElementSibling?.textContent).toBe('Alder');
    expect(pressedSkills()).toEqual(['Willpower 3']);
    expect(result()).toBeNull();
  });

  it.each<{ bag: ChaosToken[]; raises: number; shown: string }>([
    { bag: ['+1'], raises: 0, shown: 'Pass: 4 against 3, by 1' },
    { bag: ['+1'], raises: 1, shown: 'Pass: 4 against 4, by 0' },
    { bag: ['-2'], raises: 0, shown: 'Fail: 1 against 3, by 2' },
    { bag: ['autoFail'], raises: 0, shown: 'Fail: 0 against 3, by 3' },
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

    const steps = within(result()!)
      .getAllByRole('listitem')
      .map((step) => step.textContent);
    expect(pressedSkills()).toEqual(['Willpower 3', 'Agility 4']);
    // The skill's steps come first, then the difficulty's.
    expect(steps).toEqual(['Willpower 3', '+ Agility +4: 7', 'Token −2 (−2): 5', 'Difficulty 3']);
  });

  it('tests another skill once the tapped one is dropped', () => {
    renderWillpowerTest(['0']);

    fireEvent.click(button('Agility 4'));
    fireEvent.click(button('Willpower 3'));
    fireEvent.click(button('Draw a token'));

    expect(pressedSkills()).toEqual(['Agility 4']);
    expect(outcome()).toBe('Pass: 4 against 3, by 1');
  });

  it("adds the players' modifier", () => {
    renderWillpowerTest(['0']);

    fireEvent.click(button('Raise the Modifier'));
    fireEvent.click(button('Raise the Modifier'));
    fireEvent.click(button('Draw a token'));

    expect(within(result()!).getByText('Modifier +2: 5')).toBeTruthy();
  });

  it('lists the tokens drawn by name, in the order they came out', () => {
    // Always the first token left, so the bless comes out first and reveals the skull.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderWillpowerTest(['bless', 'skull']);

    fireEvent.click(button('Draw a token'));

    const drawn = within(screen.getByRole('list', { name: 'Tokens drawn' }))
      .getAllByRole('listitem')
      .map((token) => token.textContent);
    expect(drawn).toEqual(['Bless', 'Skull']);
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
});
