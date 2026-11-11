import { expect, test } from '../fixtures/test';

// Situations in the new game wizard, each photographed as it ends; corner cases are in
// `e2e/states/` (coding guidelines §3).

test("a new campaign's first step: Night of the Zealot's cover with its key art, then Brethren of Ash's", async ({
  page,
}) => {
  await page.goto('/#/new');
  await page.getByRole('link', { name: 'New campaign' }).click();

  await expect(page.getByRole('radio', { name: 'Night of the Zealot' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Brethren of Ash' })).toBeVisible();
});

test('the investigator picker with its filter menu open, a cycle picked by its name', async ({
  page,
}) => {
  await page.goto('/#/new');
  await page.getByRole('link', { name: 'Quick game' }).first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByRole('button', { name: 'Seeker', exact: true }).click();
  await page.getByLabel('Cycle').selectOption({ label: 'Core Set' });

  await expect(page.getByRole('list', { name: 'Investigators' })).toContainText('Fake Seeker');
});

test('the detail sheet of an investigator, with the traits and abilities their card prints', async ({
  page,
}) => {
  await page.goto('/#/new');
  await page.getByRole('link', { name: 'Quick game' }).first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: /Roland Banks/ }).click();

  const sheet = page.getByRole('dialog', { name: 'Roland Banks' });
  await expect(sheet.getByRole('region', { name: 'Card text' })).toContainText('Invented. Traits.');
});

test('the summary of a quick game with two investigators', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('link', { name: 'Quick game' }).first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('radio', { name: 'Hard' }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  const portraits = page.getByRole('list', { name: 'Investigators' });
  for (const name of ['Roland Banks', 'Fake Seeker']) {
    await portraits.getByRole('button', { name: new RegExp(name) }).click();
    await page.getByRole('button', { name: 'Select', exact: true }).click();
  }

  await page.getByRole('button', { name: 'Next' }).click();

  const summary = page.getByRole('region', { name: 'Summary' });
  await expect(summary).toContainText('Hard');
  // Roland's card has a picture, so his portrait shows; the Fake Seeker's has none: their initial.
  await expect(summary.locator('picture[data-picture="shown"]')).toHaveCount(1);
});
