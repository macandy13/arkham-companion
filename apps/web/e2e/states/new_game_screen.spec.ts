import { expect, isCardList, test } from '../fixtures/test';

// Corner cases of the new game wizard, checked by what the page holds, without a picture
// (coding guidelines §3).
test.use({ endPicture: false });

test("a quick game's setup step after the scenario: only the difficulty", async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('link', { name: 'Quick game' }).first().click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('radio', { name: 'Hard' }).check();

  await expect(page.getByRole('group', { name: 'What the app tells you' })).toHaveCount(0);
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

test('the investigators step when the card data could not be loaded, with its retry', async ({
  page,
}) => {
  // A first start without network: nothing is cached, so the wizard has no investigators.
  await page.route(isCardList, (route) => route.abort());
  await page.goto('/#/new');
  await page.getByRole('link', { name: 'Quick game' }).first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByRole('alert')).toContainText('could not be loaded');
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});
