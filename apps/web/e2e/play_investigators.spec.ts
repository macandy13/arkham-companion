import { expect, test } from './fixtures/test';
import { startQuickGame } from './fixtures/wizard';

// Journey: take an investigator's turn from their panel – start it, take damage and heal it, and
// end it, as the players do on the table.
test('take a turn from the investigator panel', { tag: '@flow' }, async ({ page }) => {
  const bar = page.getByRole('region', { name: 'Investigators' });

  await test.step('Start a quick game in the investigation phase', async () => {
    await page.goto('/#/new');
    await startQuickGame(page);
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Round 1, Investigation')).toBeVisible();
  });

  await test.step('Start the turn', async () => {
    await bar.getByRole('button', { name: 'Start turn' }).click();
    await expect(bar.getByRole('list', { name: '3 actions left' })).toBeVisible();
  });

  await test.step('Take a damage and heal it', async () => {
    const health = bar.getByRole('definition').first();
    const before = await health.locator('data').textContent();
    await bar.getByRole('button', { name: 'Take damage' }).click();
    await expect(health.locator('data')).not.toHaveText(before ?? '');
    await bar.getByRole('button', { name: 'Heal damage' }).click();
    await expect(health.locator('data')).toHaveText(before ?? '');
  });

  await test.step('End the turn', async () => {
    await bar.getByRole('button', { name: 'End turn' }).click();
    await expect(bar.getByText(/^Turn taken · /)).toBeVisible();
  });
});
