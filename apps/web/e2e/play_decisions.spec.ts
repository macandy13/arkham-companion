import { expect, test } from './fixtures/test';
import { investigationOpenExport, resumeImportedGame } from './fixtures/saved_games';

// Journey: the game asks the players something (here the result of Alder's investigation) and
// they answer it in the decision dialog, which then gives the board back.
test('answer a decision in its dialog', { tag: '@flow' }, async ({ page }) => {
  const decision = page.getByRole('dialog', { name: 'Investigate Hallway' });

  await test.step('Resume a game whose investigation waits for its result', async () => {
    await resumeImportedGame(page, 'Investigating', investigationOpenExport('Investigating'));
    await expect(decision.getByText('Intellect test (1)')).toBeVisible();
  });

  await test.step('Report the test as passed', async () => {
    await decision.getByRole('button', { name: 'Passed' }).click();
    await expect(decision).toBeHidden();
  });
});
