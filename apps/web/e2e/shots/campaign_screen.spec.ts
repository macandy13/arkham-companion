import { expect, test } from '../fixtures/test';
import { stepInvestigatorCounter } from '../fixtures/counter_bubble';

// Situations on the campaign log, each photographed as it ends; corner cases are in
// `e2e/states/` (coding guidelines §3).

test('the log of a campaign just started', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('link', { name: 'New campaign' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Fake Seeker/ }).click();
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page).toHaveURL(/#\/game\/.+/);

  await page.goto('/#/');
  await page.getByRole('button', { name: /^More for / }).click();
  await page.getByRole('button', { name: 'Read the log' }).click();

  await expect(page.getByRole('region', { name: 'Scenarios' })).toContainText('The Gathering');
});

test('the resolution of a game its only investigator lost to horror', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('link', { name: 'New campaign' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Fake Seeker/ }).click();
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.getByRole('region', { name: 'Fake Seeker' })).toBeVisible();
  await stepInvestigatorCounter(page, 'Fake Seeker', 'sanity', 'Take horror', 8);

  await expect(page.getByRole('dialog', { name: 'The scenario is over' })).toBeVisible();
});

test('the setup preview of The Midnight Masks', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('link', { name: 'New campaign' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Fake Seeker/ }).click();
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.getByRole('region', { name: 'Fake Seeker' })).toBeVisible();
  await stepInvestigatorCounter(page, 'Fake Seeker', 'sanity', 'Take horror', 8);
  const dialog = page.locator('#resolution');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: 'Write into the log' }).click();
  await page.getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: 'Set up The Midnight Masks' }).click();

  const preview = page.getByRole('dialog', { name: 'Set up The Midnight Masks' });
  await expect(preview.getByRole('region', { name: 'From the campaign log' })).toContainText(
    'The investigators start at Your House',
  );
  await expect(preview.getByRole('button', { name: 'Start game' })).toBeEnabled();
});
