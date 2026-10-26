import { expect, test } from './fixtures/test';
import { inTheParlorExport, resumeImportedGame } from './fixtures/saved_games';
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

// Journey: resign through the card that offers it, the Parlor's "[action] Resign.", from the turn row.
test('resign at the Parlor', async ({ page }) => {
  const roland = page.getByRole('region', { name: 'Roland Banks' });

  await test.step('Resume a game with Roland Banks in the Parlor on their turn', async () => {
    await resumeImportedGame(page, 'In the Parlor', inTheParlorExport('In the Parlor'));
    await expect(roland.getByText(/^Turn · Parlor/)).toBeVisible();
  });

  await test.step('Resign', async () => {
    await roland.getByRole('button', { name: 'Resign · Parlor' }).click();
    await expect(roland.getByText('Resigned')).toBeVisible();
  });
});
