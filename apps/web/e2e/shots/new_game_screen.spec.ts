import { expect, test } from '../fixtures/test';

// Situations in the new game wizard, each photographed as it ends (`@shot`, coding guidelines §3).

test(
  "a quick game's setup step after the scenario: only the difficulty",
  { tag: '@shot' },
  async ({ page }) => {
    await page.goto('/#/new');
    await page.getByRole('link', { name: 'Quick game' }).first().click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByRole('radio', { name: 'Hard' }).check();

    await expect(page.getByRole('group', { name: 'What the app tells you' })).toHaveCount(0);
  },
);

test("a new campaign's first step: Night of the Zealot's cover with its key art, nothing else", async ({
  page,
}) => {
  await page.goto('/#/new');
  await page.getByRole('link', { name: 'New campaign' }).click();

  await expect(page.getByRole('radio', { name: 'Night of the Zealot' })).toBeChecked();
});

test('the investigator picker with its filter menu open', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('link', { name: 'Quick game' }).first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByRole('button', { name: 'Seeker', exact: true }).click();

  await expect(page.getByRole('list', { name: 'Investigators' })).toContainText('Fake Seeker');
});

test('the detail sheet of an investigator', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('link', { name: 'Quick game' }).first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: /Fake Seeker/ }).click();

  await expect(page.getByRole('dialog', { name: 'Fake Seeker' })).toBeVisible();
});

test('the investigators step with two picked, their names pinned beside the next step', async ({
  page,
}) => {
  await page.goto('/#/new');
  await page.getByRole('link', { name: 'Quick game' }).first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  const portraits = page.getByRole('list', { name: 'Investigators' });

  for (const name of ['Fake Guardian', 'Fake Seeker']) {
    await portraits.getByRole('button', { name: new RegExp(name) }).click();
    await page.getByRole('button', { name: 'Select', exact: true }).click();
  }

  await expect(page.getByText('Fake Guardian and Fake Seeker')).toBeVisible();
});

test('the summary of a quick game with two investigators', { tag: '@shot' }, async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('link', { name: 'Quick game' }).first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('radio', { name: 'Hard' }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  const portraits = page.getByRole('list', { name: 'Investigators' });
  for (const name of ['Fake Guardian', 'Fake Seeker']) {
    await portraits.getByRole('button', { name: new RegExp(name) }).click();
    await page.getByRole('button', { name: 'Select', exact: true }).click();
  }

  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByRole('region', { name: 'Summary' })).toContainText('Hard');
});
