import { expect, test } from './fixtures/test';

// Journey: the new game wizard from the entry points to a started game.
test('start a new game', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('button', { name: 'Seeker', exact: true }).click();
    await page.getByRole('button', { name: 'Filters (1 set)' }).click();
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
    await expect(page.getByRole('toolbar', { name: 'Zoom' })).toBeVisible();
  });
});

// Journey: a campaign from the wizard to its first game, then back to it from the home screen
// through its campaign log.
test('start a campaign and resume it from its log', { tag: '@flow' }, async ({ page }) => {
  await test.step('Choose a new campaign', async () => {
    await page.goto('/#/new');
    await page.getByRole('link', { name: 'New campaign' }).click();
    await expect(page.getByRole('radio', { name: 'Night of the Zealot' })).toBeChecked();
  });

  await test.step('Pick the difficulty and the team', async () => {
    await page.getByRole('radio', { name: 'Hard' }).check();
    await page.getByRole('button', { name: 'Next' }).click();
    await page
      .getByRole('list', { name: 'Investigators' })
      .getByRole('button', { name: /Fake Seeker/ })
      .click();
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.getByRole('button', { name: 'Next' }).click();
  });

  await test.step('Start the campaign with its first scenario', async () => {
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page).toHaveURL(/#\/game\/.+/);
  });

  let gameUrl = '';
  await test.step('The home screen lists the campaign', async () => {
    gameUrl = page.url();
    await page.goto('/#/');
    const campaigns = page.getByRole('list', { name: 'Campaigns' });
    await expect(campaigns).toContainText('Night of the Zealot – Fake Seeker');
    await expect(campaigns).toContainText('Scenario 1 of 3');
    await campaigns.getByRole('link', { name: 'Resume' }).click();
    await expect(page).toHaveURL(/#\/campaign\/.+/);
  });

  await test.step('The log shows the team and continues the first scenario', async () => {
    await expect(page.getByRole('heading', { name: 'Night of the Zealot' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Investigators' })).toContainText('Fake Seeker');
    await page.getByRole('link', { name: 'Continue The Gathering' }).click();
    await expect(page).toHaveURL(gameUrl);
  });
});
