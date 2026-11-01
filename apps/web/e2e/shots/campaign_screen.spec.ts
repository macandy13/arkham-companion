import { expect, test } from '../fixtures/test';

// Situations on the campaign log, each photographed as it ends (`@shot`, coding guidelines §3).

test('the log of a campaign just started', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('link', { name: 'New campaign' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Fake Seeker/ }).click();
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page).toHaveURL(/#\/game\/.+/);

  await page.goto('/#/');
  await page.getByRole('list', { name: 'Campaigns' }).getByRole('link', { name: 'Resume' }).click();

  await expect(page.getByRole('region', { name: 'Scenarios' })).toContainText('The Gathering');
});

test(
  'the resolution of a game its only investigator lost to horror',
  { tag: '@shot' },
  async ({ page }) => {
    await page.goto('/#/new');
    await page.getByRole('link', { name: 'New campaign' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: /Fake Seeker/ }).click();
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Start game' }).click();
    await page.getByRole('button', { name: 'Adjust board' }).click();
    for (let horror = 0; horror < 8; horror++)
      await page.getByRole('button', { name: 'Take horror' }).click();
    await page.getByRole('button', { name: 'Done' }).click();

    await expect(page.getByRole('dialog', { name: 'The scenario is over' })).toBeVisible();
  },
);
