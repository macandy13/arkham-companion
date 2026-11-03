import { expect, test } from '../fixtures/test';
import {
  fakeGuardian,
  fakeSeeker,
  gatheringKilledEvents,
  openStoredCampaign,
  rolandBanks,
  zealotWonEvents,
} from '../fixtures/saved_campaigns';

// How a campaign's log reads once the campaign is over (`@shot`, coding guidelines §3).

test('the log of a campaign lost for want of investigators', { tag: '@shot' }, async ({ page }) => {
  await openStoredCampaign(page, 'Zealot – everyone', (id) =>
    gatheringKilledEvents(id, [fakeSeeker, fakeGuardian, rolandBanks], fakeSeeker),
  );
  await page.getByRole('button', { name: 'Set up The Midnight Masks' }).click();
  await page.getByRole('button', { name: 'End the campaign' }).click();

  const over = page.getByRole('region', { name: 'Campaign over' });
  await expect(over).toContainText('Lost');
  await over.scrollIntoViewIfNeeded();
});

test('the log of Night of the Zealot, won', { tag: '@shot' }, async ({ page }) => {
  await openStoredCampaign(page, 'Zealot – Roland Banks', (id) =>
    zealotWonEvents(id, [rolandBanks]),
  );

  await expect(page.getByRole('region', { name: 'Campaign over' })).toContainText('Won');
  await expect(
    page.getByText('Read Resolution 1 of The Devourer Below in the campaign guide.'),
  ).toBeVisible();
});
