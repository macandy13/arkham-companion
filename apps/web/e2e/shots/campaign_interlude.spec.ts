import { expect, test } from '../fixtures/test';
import {
  fakeSeeker,
  interludeDueEvents,
  openStoredCampaign,
  rolandBanks,
} from '../fixtures/saved_campaigns';

// The interlude dialog of the E2E build's test campaign, after The Gathering (coding
// guidelines §3): no campaign the app plays has an interlude yet.

test('the decision of an interlude', async ({ page }) => {
  await openStoredCampaign(page, 'Interlude – Roland and Fake Seeker', (id) =>
    interludeDueEvents(id, [rolandBanks, fakeSeeker]),
  );
  await page.getByRole('button', { name: 'Read the interlude A Sleepless Night' }).click();

  const dialog = page.getByRole('dialog', { name: 'A Sleepless Night' });
  await expect(
    dialog.getByRole('group', { name: 'How do the investigators spend the night?' }),
  ).toBeVisible();
});

test('what an interlude writes into the log', async ({ page }) => {
  await openStoredCampaign(page, 'Interlude – Roland and Fake Seeker', (id) =>
    interludeDueEvents(id, [rolandBanks, fakeSeeker]),
  );
  await page.getByRole('button', { name: 'Read the interlude A Sleepless Night' }).click();
  await page.getByRole('radio', { name: 'Press on through the night' }).check();
  await page.getByRole('button', { name: 'Next' }).click();

  const dialog = page.getByRole('dialog', { name: 'Into the campaign log' });
  await expect(dialog.getByText('Roland Banks earns 2 experience')).toBeVisible();
  await expect(
    dialog.getByRole('radio', { name: 'Fake Seeker earns Lita Chantler' }),
  ).toBeVisible();
});

test('the log after an interlude was written', async ({ page }) => {
  await openStoredCampaign(page, 'Interlude – Roland and Fake Seeker', (id) =>
    interludeDueEvents(id, [rolandBanks, fakeSeeker]),
  );
  await page.getByRole('button', { name: 'Read the interlude A Sleepless Night' }).click();
  await page.getByRole('radio', { name: 'Press on through the night' }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Write into the log' }).click();

  await expect(page.getByText('The interlude is in the campaign log.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set up The Midnight Masks' })).toBeVisible();
});
