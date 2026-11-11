import { expect, test } from '../fixtures/test';
import { stepInvestigatorCounter } from '../fixtures/counter_bubble';

// Corner cases of the campaign log,
// checked by what the page holds, without a picture (coding guidelines §3).
test.use({ endPicture: false });

test('the chaos bag on the log of a campaign just started, its tokens drawn', async ({ page }) => {
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
  const bag = page.getByRole('region', { name: 'Chaos Bag' });
  await bag.scrollIntoViewIfNeeded();

  await expect(bag.getByText('Skull')).toBeVisible();
});

test('the log right after that resolution was written', async ({ page }) => {
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

  await expect(page.getByRole('status', { name: 'Written into the log' })).toBeVisible();
});
