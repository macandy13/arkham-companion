import { expect, test } from './fixtures/test';
import { startQuickGame } from './fixtures/wizard';

// Journey: run the game clock from the header – read and correct the agenda's doom, move on a
// phase, see why a step is refused, and take a step back, then back the game up from the title bar.
test('play the phases from the header', { tag: '@flow' }, async ({ page }) => {
  await test.step('Start a quick game', async () => {
    await page.goto('/#/new');
    await startQuickGame(page);
    await expect(page.getByText('Round 0, Setup')).toBeVisible();
  });

  await test.step('Read the agenda and the act', async () => {
    await expect(page.getByRole('region', { name: 'Agenda' })).toContainText('Doom 0 / 3');
    await expect(page.getByRole('region', { name: 'Act' })).toContainText('Clues 0 / 2');
  });

  await test.step('Add doom to the agenda and take it off again', async () => {
    await page.getByRole('button', { name: 'Add doom' }).click();
    await expect(page.getByText('Doom 1 / 3')).toBeVisible();
    await page.getByRole('button', { name: 'Remove doom' }).click();
    await expect(page.getByText('Doom 0 / 3')).toBeVisible();
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
  });

  await test.step('Back up the game from the title bar', async () => {
    const download = page.waitForEvent('download');
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('button', { name: 'Export' })
      .click();
    expect((await download).suggestedFilename()).toMatch(/\.arkham\.json$/);
  });
});
