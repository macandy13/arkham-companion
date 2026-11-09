// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { blankLocation, instanceId, investigatorId, newGame, PlayTable } from '@arkham/engine';
import { initI18n } from '../i18n';
import { actionsOn } from '../state/gameActions.test_support';
import { ChaosBag } from './ChaosBag';

const study = instanceId('study');
const roland = investigatorId('roland');
const daisy = investigatorId('daisy');

describe('ChaosBag', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  /** Roland and Daisy in the study, with two −1s, a skull and an elder sign in the bag. */
  const game = newGame()
    .withLocation(study, blankLocation('study'), { revealed: true })
    .withInvestigator(roland, { name: 'Roland Banks', locationId: study })
    .withInvestigator(daisy, { name: 'Daisy Walker', locationId: study })
    .withChaosBag(['-1', 'skull', '-1', 'elderSign']);

  it('lists the tokens in the bag with their counts', () => {
    const table = PlayTable.start(game);

    render(<ChaosBag board={table.board} actions={actionsOn(table)} busy={false} />);

    const contents = screen.getByRole('list', { name: 'Tokens in the bag' });
    expect(
      within(contents)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['−1 ×2', 'Skull ×1', 'Elder Sign ×1']);
  });

  it.each([
    { what: 'without a number on the reference card', skull: undefined, row: 'Skull ×1 ? 25%' },
    { what: 'by the reference card', skull: -2, row: 'Skull ×1 −2 25%' },
  ])('lists each kind with its chance and a symbol $what with its value', ({ skull, row }) => {
    const table = PlayTable.start(
      game.withReferenceCard({
        easyStandard: { skull: { modifier: skull, effectKey: 'test.skull' } },
        hardExpert: {},
      }),
    );

    render(<ChaosBag board={table.board} actions={actionsOn(table)} busy={false} />);

    const contents = screen.getByRole('list', { name: 'Tokens in the bag' });
    expect(
      within(contents)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['−1 ×2 50%', row, 'Elder Sign ×1 ? 25%']);
  });

  it('seals the token tapped on the investigator picked', async () => {
    const table = PlayTable.start(game);
    render(<ChaosBag board={table.board} actions={actionsOn(table)} busy={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Elder Sign ×1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Seal Elder Sign on Daisy Walker' }));

    await waitFor(() =>
      expect(table.board.sealedTokens).toEqual([{ token: 'elderSign', investigatorId: daisy }]),
    );
  });

  it('releases a sealed token back into the bag', async () => {
    const table = PlayTable.start(game);
    table.play({ type: 'SealChaosToken', token: 'skull', investigatorId: roland });
    render(<ChaosBag board={table.board} actions={actionsOn(table)} busy={false} />);

    const sealed = screen.getByRole('list', { name: 'Sealed' });
    expect(within(sealed).getByRole('listitem').textContent).toBe('Skull on Roland Banks Release');
    fireEvent.click(
      within(sealed).getByRole('button', { name: 'Release Skull from Roland Banks' }),
    );

    await waitFor(() => expect(table.board.sealedTokens).toEqual([]));
    expect(table.board.chaosBag).toEqual(['-1', '-1', 'elderSign', 'skull']);
  });
});
