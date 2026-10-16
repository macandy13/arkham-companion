import { expect, test } from './fixtures/test';

// Journey: the new game wizard from the entry points to a started game.
test('start a new game', { tag: '@flow' }, async ({ page }) => {
  const portraits = page.getByRole('list', { name: 'Investigators' });
  const seats = page.getByRole('region', { name: 'Seats' });
  const search = page.getByRole('searchbox', { name: 'Search by name' });

  await test.step('Choose a quick game', async () => {
    await page.goto('/#/new');
    await expect(page.getByRole('heading', { level: 1, name: 'New game' })).toBeVisible();
    await page.getByRole('link', { name: 'Quick game' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Quick game' })).toBeVisible();
  });

  await test.step('Pick the difficulty', async () => {
    await page.getByRole('radio', { name: 'Hard' }).check();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(portraits.getByRole('listitem')).toHaveCount(2);
  });

  await test.step('Search for an investigator by name', async () => {
    await search.fill('guardian');
    await expect(portraits.getByRole('listitem')).toHaveCount(1);
    await expect(portraits).toContainText('Fake Guardian');
  });

  await test.step('Seat the guardian', async () => {
    await portraits.getByRole('button', { name: /Fake Guardian/ }).click();
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await expect(seats.getByRole('listitem')).toHaveCount(1);
  });

  await test.step('Filter by class and seat the seeker', async () => {
    await search.clear();
    await page.getByRole('button', { name: 'Seeker', exact: true }).click();
    await expect(portraits.getByRole('listitem')).toHaveCount(1);
    await portraits.getByRole('button', { name: /Fake Seeker/ }).click();
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await expect(seats).toContainText('Fake Seeker');
  });

  await test.step('Reload: the choices are kept', async () => {
    await page.reload();
    await expect(seats.getByRole('listitem')).toHaveCount(2);
  });

  await test.step('Go back to the setup', async () => {
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('radio', { name: 'Hard' })).toBeChecked();
  });

  await test.step('Review the summary', async () => {
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    const summary = page.getByRole('region', { name: 'Summary' });
    await expect(summary).toContainText('Hard');
    await expect(page.getByRole('listitem').filter({ hasText: 'Fake Guardian' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Fake Seeker' })).toBeVisible();
  });

  await test.step('Start the game', async () => {
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page).toHaveURL(/#\/game\/.+/);
    await expect(page.getByRole('heading', { level: 2, name: 'Map' })).toBeVisible();
  });
});
