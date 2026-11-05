import { expect, test } from '../fixtures/test';

// Situations in the new game wizard, each photographed as it ends (`@shot`, coding guidelines §3).

test(
  "a quick game's setup step: the scenario, the difficulty and what the app tells the players",
  { tag: '@shot' },
  async ({ page }) => {
    await page.goto('/#/new');
    await page.getByRole('link', { name: 'Quick game' }).first().click();

    await page
      .getByRole('radio', { name: 'Changes to investigators and enemies, and the cards drawn' })
      .check();

    await expect(page.getByRole('group', { name: 'What the app tells you' })).toBeVisible();
  },
);

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
