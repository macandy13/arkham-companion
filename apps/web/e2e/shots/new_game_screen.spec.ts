import { expect, test } from '../fixtures/test';

// Situations in the new game wizard, each photographed as it ends (`@shot`, coding guidelines §3).

test('the investigator picker with its filter menu open', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('link', { name: 'Quick game' }).first().click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByRole('button', { name: 'Seeker', exact: true }).click();

  await expect(page.getByRole('list', { name: 'Investigators' })).toContainText('Fake Seeker');
});

test('the detail sheet of an investigator', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('link', { name: 'Quick game' }).first().click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: /Fake Seeker/ }).click();

  await expect(page.getByRole('dialog', { name: 'Fake Seeker' })).toBeVisible();
});
