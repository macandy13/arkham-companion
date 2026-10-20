import { expect, test } from './fixtures/test';
import { startQuickGame } from './fixtures/wizard';

// Journey: run the game clock from the header – move on a phase, see why a step is refused, and
// take a step back.
test('play the phases from the header', { tag: '@flow' }, async ({ page }) => {
  await test.step('Start a quick game', async () => {
    await page.goto('/#/new');
    await startQuickGame(page);
    await expect(page.getByText('Round 0, Setup')).toBeVisible();
  });

  await test.step('Move on to the investigation phase', async () => {
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Round 1, Investigation')).toBeVisible();
  });

  await test.step('Try to move on before anyone took a turn', async () => {
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('alert')).toContainText(
      'Every investigator must take a turn first.',
    );
  });

  await test.step('Dismiss the reason', async () => {
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByRole('alert')).toBeHidden();
  });

  await test.step('Undo the phase change', async () => {
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Round 0, Setup')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});
