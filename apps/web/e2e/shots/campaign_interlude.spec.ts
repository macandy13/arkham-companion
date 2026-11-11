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
