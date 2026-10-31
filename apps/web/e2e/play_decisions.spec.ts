import { expect, test } from './fixtures/test';
import { investigationOpenExport, resumeImportedGame } from './fixtures/saved_games';

// Journey: the game asks the players something (here the result of Roland Banks' investigation), they
// draw a chaos token for the test in the decision dialog and answer it, which gives the board back.
test('answer a decision in its dialog', async ({ page }) => {
  const decision = page.getByRole('dialog', { name: 'Investigate Hallway' });

  await test.step('Resume a game whose investigation waits for its result', async () => {
    await resumeImportedGame(page, 'Investigating', investigationOpenExport('Investigating'));
    await expect(decision.getByText('Intellect test (1)')).toBeVisible();
  });

  await test.step('Draw a token and see the calculation', async () => {
    await decision.getByRole('button', { name: 'Draw a token' }).click();
    await expect(decision.getByRole('status')).toBeVisible();
  });

  await test.step('Report the test as passed', async () => {
    await decision.getByRole('button', { name: 'Passed' }).click();
    await expect(decision).toBeHidden();
  });
});
