import { expect, test } from './fixtures/test';
import { startQuickGame } from './fixtures/wizard';

// Journey: take an investigator's turn from their panel – start it, see their actions, investigate, and end it,
// as the players do on the table.
test('take a turn from the investigator panel', async ({ page }) => {
  const bar = page.getByRole('region', { name: 'Investigators' });

  await test.step('Start a quick game in the investigation phase', async () => {
    await page.goto('/#/new');
    await startQuickGame(page);
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Round 1' })).toBeVisible();
  });

  await test.step('Start the turn', async () => {
    await bar.getByRole('button', { name: 'Start turn' }).click();
    await expect(bar.getByRole('list', { name: '3 actions left' })).toBeVisible();
  });

  await test.step('Investigate and report the test as passed', async () => {
    await bar.getByRole('button', { name: 'Investigate' }).click();
    const decision = page.getByRole('dialog', { name: 'Investigate Study' });
    await decision.getByRole('button', { name: 'Passed' }).click();
    await expect(decision).toBeHidden();
    await expect(bar.getByRole('list', { name: '2 actions left' })).toBeVisible();
  });

  await test.step('End the turn', async () => {
    await bar.getByRole('button', { name: 'End turn' }).click();
    await expect(bar.getByText(/^Turn taken · /)).toBeVisible();
  });
});
