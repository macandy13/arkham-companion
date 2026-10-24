import { expect, test } from './fixtures/test';
import { startQuickGame } from './fixtures/wizard';

// Journey: run the game clock from the header and the status row – read the agenda's doom and the
// act's clues, correct them while adjusting the board and keep the correction with "Done", move on
// a phase, see why a step is refused, and take a step back, then back the game up from the menu.
test('play the phases from the header', { tag: '@flow' }, async ({ page }) => {
  await test.step('Start a quick game', async () => {
    await page.goto('/#/new');
    await startQuickGame(page);
    await expect(page.getByRole('heading', { name: 'Setup' })).toBeVisible();
  });

  await test.step('Read the agenda and the act', async () => {
    await expect(page.getByRole('region', { name: 'Agenda' })).toContainText('Doom 0 / 3');
    await expect(page.getByRole('region', { name: 'Act' })).toContainText('Clues 0 / 2');
  });

  await test.step('Adjust the board: add doom to the agenda and take it off again', async () => {
    await page.getByRole('button', { name: 'Adjust board' }).click();
    await page.getByRole('button', { name: 'Add doom' }).click();
    await expect(page.getByText('Doom 1 / 3')).toBeVisible();
    await page.getByRole('button', { name: 'Remove doom' }).click();
    await expect(page.getByText('Doom 0 / 3')).toBeVisible();
  });

  await test.step('Put a clue on the act and keep the correction with "Done"', async () => {
    await page.getByRole('button', { name: 'Add a clue' }).click();
    await expect(page.getByText('Clues 1 / 2')).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('button', { name: 'Add a clue' })).toBeHidden();
    await expect(page.getByText('Clues 1 / 2')).toBeVisible();
  });

  await test.step('Move on to the investigation phase', async () => {
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Round 1' })).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Phases' }).locator('[aria-current="step"]'),
    ).toHaveText('Investigation');
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

  await test.step('Undo the phase change, then the whole correction in one step', async () => {
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('heading', { name: 'Setup' })).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Clues 0 / 2')).toBeVisible();
  });

  await test.step('Back up the game from the menu', async () => {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('button', { name: 'Export' })
      .click();
    expect((await download).suggestedFilename()).toMatch(/\.arkham\.json$/);
  });
});
