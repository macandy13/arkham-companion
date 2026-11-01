import { expect, test } from './fixtures/test';

// Journey: a campaign's first game ends when its only investigator is driven out by horror; the
// players confirm the resolution the game reached, check what it writes into the campaign log and
// write it, read it there, take it back with Undo and write it again.
test('write a scenario resolution into the campaign log', { tag: '@flow' }, async ({ page }) => {
  await test.step('Start a campaign with Fake Seeker alone', async () => {
    await page.goto('/#/new');
    await page.getByRole('link', { name: 'New campaign' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: /Fake Seeker/ }).click();
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page).toHaveURL(/#\/game\/.+/);
  });

  await test.step('Fake Seeker takes 8 horror, all their sanity', async () => {
    await page.getByRole('button', { name: 'Adjust board' }).click();
    for (let horror = 0; horror < 8; horror++)
      await page.getByRole('button', { name: 'Take horror' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
  });

  const dialog = page.locator('#resolution');
  await test.step('The game reached no resolution; the players confirm it', async () => {
    await expect(dialog.getByRole('heading', { name: 'The scenario is over' })).toBeVisible();
    await expect(dialog.getByRole('radio', { name: 'No resolution from the game' })).toBeChecked();
    await dialog.getByRole('button', { name: 'Next' }).click();
  });

  await test.step('The game proposes what "no resolution" writes into the log', async () => {
    await expect(dialog.getByRole('heading', { name: 'Into the campaign log' })).toBeVisible();
    await expect(dialog).toContainText('The Gathering · No resolution');
    await expect(dialog).toContainText('Your house is still standing.');
    await expect(dialog).toContainText('Fake Seeker suffers 1 mental trauma');
  });

  await test.step('Write it into the log and read it there', async () => {
    await dialog.getByRole('button', { name: 'Write into the log' }).click();
    await expect(page).toHaveURL(/#\/campaign\/.+/);
    await expect(page.getByRole('region', { name: 'Scenarios' })).toContainText('no resolution');
    await expect(page.getByRole('region', { name: 'Campaign Notes' })).toContainText(
      'Your house is still standing.',
    );
  });

  const written = page.getByRole('status', { name: 'Written into the log' });
  await test.step('Undo takes it back out of the log', async () => {
    await written.getByRole('button', { name: 'Undo' }).click();
    await expect(written).toBeHidden();
    await expect(page.getByRole('region', { name: 'Scenarios' })).not.toContainText(
      'no resolution',
    );
  });

  await test.step('Back in the game, the resolution waits to be written again', async () => {
    await page.getByRole('link', { name: 'Continue The Gathering' }).click();
    await expect(dialog.getByRole('heading', { name: 'The scenario is over' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Next' }).click();
    await dialog.getByRole('button', { name: 'Write into the log' }).click();
    await written.getByRole('button', { name: 'OK' }).click();
    await expect(written).toBeHidden();
    await expect(page.getByRole('region', { name: 'Scenarios' })).toContainText('no resolution');
  });
});
