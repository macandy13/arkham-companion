// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { blankLocation, instanceId, investigatorId, newGame, PlayTable } from '@arkham/engine';
import { initI18n } from '../i18n';
import { SkillTestDialog } from './SkillTestDialog';

const study = instanceId('study');
const alder = investigatorId('alder');

const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });
const result = () => screen.queryByRole('region', { name: 'Result' });

describe('SkillTestDialog', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  // Alder tests willpower 3; the bag holds +1, −2 twice and the auto-fail.
  const table = PlayTable.start(
    newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alder, {
        locationId: study,
        skills: { willpower: 3, intellect: 2, combat: 1, agility: 4 },
      })
      .withChaosBag(['+1', '-2', '-2', 'autoFail']),
  );
  const alderView = () => {
    const view = table.board.investigator(alder);
    if (!view) throw new Error('alder is at the table');
    return view;
  };
  const renderDialog = () =>
    render(
      <SkillTestDialog
        board={table.board}
        investigator={alderView()}
        skill="willpower"
        onClose={() => {}}
      />,
    );

  it('offers each token of the bag once and shows no result before one is picked', () => {
    renderDialog();

    const tokens = within(screen.getByRole('region', { name: 'Chaos token' }))
      .getAllByRole('button', { pressed: false })
      .map((token) => token.textContent);
    expect(screen.getByRole('heading').textContent).toBe('Willpower test · alder');
    expect(tokens).toEqual(['+1', '−2', 'Auto-fail']);
    expect(result()).toBeNull();
  });

  it.each([
    { raises: 0, token: '+1', outcome: 'Pass: 4 against 3, by 1' },
    { raises: 1, token: '+1', outcome: 'Pass: 4 against 4, by 0' },
    { raises: 0, token: '−2', outcome: 'Fail: 1 against 3, by 2' },
    { raises: 0, token: 'Auto-fail', outcome: 'Fail: 0 against 3, by 3' },
  ])(
    'with the difficulty raised $raises times from 3 and $token drawn: "$outcome"',
    ({ raises, token, outcome }) => {
      renderDialog();

      for (let i = 0; i < raises; i++) fireEvent.click(button('Raise the Difficulty'));
      fireEvent.click(button(token));

      expect(within(result()!).getByRole('status').textContent).toBe(outcome);
    },
  );

  it('shows the calculation step by step, the modifier included', () => {
    renderDialog();

    fireEvent.click(button('Raise the Modifier'));
    fireEvent.click(button('Raise the Modifier'));
    fireEvent.click(button('−2'));

    const steps = within(result()!)
      .getAllByRole('listitem')
      .map((step) => step.textContent);
    // The skill's steps come first, then the difficulty's.
    expect(steps).toEqual(['Willpower 3', 'Modifier +2: 5', 'Token −2 (−2): 3', 'Difficulty 3']);
  });

  it('cannot lower the difficulty below 0', () => {
    renderDialog();

    for (let i = 0; i < 3; i++) fireEvent.click(button('Lower the Difficulty'));

    expect(button('Lower the Difficulty').disabled).toBe(true);
  });

  it('draws a token from the bag', () => {
    renderDialog();

    fireEvent.click(button('Draw a token'));

    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
    expect(result()).not.toBeNull();
  });
});
