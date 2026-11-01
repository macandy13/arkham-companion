import { expect, test } from './fixtures/test';

// Journey: a campaign's first game ends when its only investigator is driven out by horror; the
// players check what the resolution writes into the campaign log and write it, then read it there.
test('write a scenario resolution into the campaign log', async ({ page }) => {
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

  const dialog = page.getByRole('dialog', { name: 'Into the campaign log' });
  await test.step('The game proposes what "no resolution" writes into the log', async () => {
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
});
